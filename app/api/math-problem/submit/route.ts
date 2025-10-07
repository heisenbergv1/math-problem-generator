// app/api/math-problem/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';

const MODEL = process.env.GOOGLE_MODEL || 'gemini-2.0-flash';

const Body = z.object({
  session_id: z.string().uuid(),
  user_answer: z.number()
});

function getOrCreateClientId() {
  const jar = cookies();
  let cid = jar.get('mpg_id')?.value;
  if (!cid) {
    cid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  }
  return cid;
}

export async function POST(req: NextRequest) {
  try {
    const { session_id, user_answer } = Body.parse(await req.json());

    const { data: session, error: sErr } = await supabase
      .from('math_problem_sessions')
      .select('id, problem_text, correct_answer')
      .eq('id', session_id)
      .single();
    if (sErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const is_correct = Number(user_answer) === Number(session.correct_answer);

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 });
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const feedbackPrompt = `
      Provide brief, encouraging feedback for a Primary 5 student.

      Problem:
      """${session.problem_text}"""

      Correct answer: ${session.correct_answer}
      Student answer: ${user_answer}
      Result: ${is_correct ? 'correct' : 'incorrect'}

      Rules:
      - If incorrect: suggest the likely mistake and outline a short correct method (2–4 sentences).
      - If correct: praise and suggest one small next step (1–2 sentences).
      Return plain text only.
      `;

    const feedbackResp = await model.generateContent(feedbackPrompt);
    const feedback_text = feedbackResp.response.text().trim();

    // Store submission
    const { data: sub, error: subErr } = await supabase
      .from('math_problem_submissions')
      .insert({
        session_id,
        user_answer,
        is_correct,
        feedback_text
      })
      .select('id, is_correct, feedback_text, created_at')
      .single();
    if (subErr) throw subErr;

    // ---- Score tracking (anonymous client) ----
    const client_id = getOrCreateClientId();

    // Fetch current summary if exists
    const { data: existing } = await supabase
      .from('score_summaries')
      .select('*')
      .eq('client_id', client_id)
      .maybeSingle();

    let total_attempts = (existing?.total_attempts ?? 0) + 1;
    let correct_count = (existing?.correct_count ?? 0) + (is_correct ? 1 : 0);
    let current_streak = is_correct ? (existing?.current_streak ?? 0) + 1 : 0;
    let best_streak = Math.max(existing?.best_streak ?? 0, current_streak);
    let points = Math.max(0, (existing?.points ?? 0) + (is_correct ? 10 : -2));

    // Upsert summary
    const { data: scoreRow, error: scoreErr } = await supabase
      .from('score_summaries')
      .upsert({
        client_id,
        total_attempts,
        correct_count,
        current_streak,
        best_streak,
        points,
        last_updated: new Date().toISOString()
      })
      .select()
      .single();
    if (scoreErr) throw scoreErr;

    // Build response and set cookie if new
    const res = NextResponse.json({
      submission_id: sub.id,
      is_correct: sub.is_correct,
      feedback: sub.feedback_text,
      score: {
        client_id,
        total_attempts,
        correct_count,
        current_streak,
        best_streak,
        points,
        accuracy: total_attempts ? +(correct_count * 100 / total_attempts).toFixed(1) : 0
      }
    });

    // Persist anonymous id for future requests (30 days)
    const jar = cookies();
    if (!jar.get('mpg_id')) {
      res.cookies.set('mpg_id', client_id, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' });
    }

    return res;
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ error: 'Bad request', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
