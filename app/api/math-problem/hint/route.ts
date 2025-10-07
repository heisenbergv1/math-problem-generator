// app\api\math-problem\hint\route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.GOOGLE_MODEL || 'gemini-2.0-flash';

const Body = z.object({
  session_id: z.string().uuid(),
  user_answer: z.number().optional()
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
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 });

    const { session_id, user_answer } = Body.parse(await req.json());

    const { data: session, error: sErr } = await supabase
      .from('math_problem_sessions')
      .select('id, problem_text, correct_answer, difficulty, problem_type')
      .eq('id', session_id)
      .single();

    if (sErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { count: existingCount = 0, error: cErr } = await supabase
      .from('math_problem_hints')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session_id);

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    if ((existingCount ?? 0) >= 5) {
      return NextResponse.json({ error: 'max_hints', message: 'Maximum number of hints reached for this problem.', hint_count: existingCount, max_hints: 5 }, { status: 429 });
    }

    const { data: priorHintsData, error: hListErr } = await supabase
      .from('math_problem_hints')
      .select('hint_text, created_at')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (hListErr) return NextResponse.json({ error: hListErr.message }, { status: 500 });

    const priorHints = Array.isArray(priorHintsData) ? priorHintsData.map(h => h.hint_text).filter(Boolean) : [];
    const historyBlock = priorHints.length
      ? `Previous hints (${priorHints.length}):\n${priorHints.map((h, i) => `${i + 1}) ${h}`).join('\n')}`
      : '';

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const prompt = `
      Provide a single, concise hint for a Primary 5 student.
      Explain it like you are talking to a 5 years old child.
      Do not reveal the final numeric answer.

      Problem:
      """${session.problem_text}"""

      Difficulty: ${session.difficulty ?? 'Medium'}
      Type: ${session.problem_type ?? 'addition'}
      ${typeof user_answer === 'number' ? `Student tried: ${user_answer}` : ''}

      ${historyBlock}

      Rules:
      - Produce the NEXT hint in a sequence. Do not repeat or rephrase any previous hint; add one new actionable idea that moves the student forward.
      - 1–2 sentences max.
      - Focus on the next micro-step or key representation (diagram/unit/operation) appropriate for ${session.problem_type ?? 'the operation'}.
      - No spoilers of the final answer. Return plain text only.
      Hint number to produce now: ${((existingCount ?? 0) + 1)}/5.
      `;

    const resp = await model.generateContent(prompt);
    const hint_text = resp.response.text().trim();

    const { data: hint, error: hErr } = await supabase
      .from('math_problem_hints')
      .insert({
        session_id,
        hint_text
      })
      .select('id, hint_text, created_at')
      .single();

    if (hErr) throw hErr;

    const nextIndex = (existingCount ?? 0) + 1;
    const penalties = [0, 2, 3, 4, 5];
    const deduction = penalties[Math.min(nextIndex - 1, penalties.length - 1)];

    const client_id = getOrCreateClientId();

    const { data: existing } = await supabase
      .from('score_summaries')
      .select('*')
      .eq('client_id', client_id)
      .maybeSingle();

    let points = Math.max(0, (existing?.points ?? 0) - deduction);
    const { data: scoreSaved, error: scoreErr } = await supabase
      .from('score_summaries')
      .upsert({
        client_id,
        total_attempts: existing?.total_attempts ?? 0,
        correct_count: existing?.correct_count ?? 0,
        current_streak: existing?.current_streak ?? 0,
        best_streak: existing?.best_streak ?? 0,
        points,
        last_updated: new Date().toISOString()
      })
      .select('*')
      .single();

    if (scoreErr) return NextResponse.json({ error: scoreErr.message }, { status: 500 });

    const res = NextResponse.json({
      hint_id: hint.id,
      hint_text: hint.hint_text,
      created_at: hint.created_at,
      hint_count: nextIndex,
      max_hints: 5,
      deduction_applied: deduction,
      score: scoreSaved ? {
        client_id: scoreSaved.client_id,
        total_attempts: scoreSaved.total_attempts,
        correct_count: scoreSaved.correct_count,
        current_streak: scoreSaved.current_streak,
        best_streak: scoreSaved.best_streak,
        points: scoreSaved.points,
        accuracy: scoreSaved.total_attempts ? +(scoreSaved.correct_count * 100 / scoreSaved.total_attempts).toFixed(1) : 0
      } : null
    });

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
