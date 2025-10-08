// app/api/math-problem/submit/route.ts
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
  user_answer: z.number()
});

const FEEDBACK_TIMEOUT_MS = 7000;
const FEEDBACK_MAX_RETRIES = 2;
const POINTS_CORRECT = 10;
const POINTS_INCORRECT = -2;
const FEEDBACK_MAX_LEN = 600;

function getOrCreateClientId() {
  const jar = cookies();
  let cid = jar.get('mpg_id')?.value;
  if (!cid) {
    cid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  }
  return cid;
}

function buildFeedbackPrompt(problem_text: string, correct: number, user: number, isCorrect: boolean) {
  return `
    You are giving feedback to a Primary 5 (Grade 5) student. Be kind, specific, and short.

    Problem:
    """${problem_text}"""

    Correct answer: ${correct}
    Student answer: ${user}
    Result: ${isCorrect ? 'correct' : 'incorrect'}

    OUTPUT:
    - Return PLAIN TEXT only. No code blocks, no LaTeX, no lists, no emojis.
    - Use simple words a Primary 5 student understands.

    CONTENT RULES:
    - DO NOT USE LATEX.
    - Stay faithful to the numbers given above. Do not invent or change quantities.
    - Do not restate the full problem; summarize only what is needed.
    - If Result is "incorrect":
      - In 2–4 short sentences, point out the most likely mistake or missing step.
      - Give a tiny nudge on the correct method.
      - Do NOT reveal the final numeric answer.
    - If Result is "correct":
      - In 1–2 short sentences, say ${correct} is correct, then praise and briefly restate the key idea, the solution and the correct result.
      - Add exactly one concrete next level tip.
      - Do NOT ask a question and do NOT give a new problem.

    STYLE:
    - Keep sentences short and clear.
    - Avoid technical jargon unless needed; explain it simply if used.
    - 3–5 sentences total.
    `.trim();
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('feedback_timeout')), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

/**
 * @deprecated
 */
function redactAnswer(text: string, correct: number): string {
  const intForm = Number.isInteger(correct) ? String(correct) : String(Math.trunc(correct));
  const twoDpForm = (Math.round(correct * 100) / 100).toFixed(2);
  const patterns = Array.from(new Set([intForm, twoDpForm])).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (patterns.length === 0) return text;
  const re = new RegExp(`\\b(?:${patterns.join('|')})\\b`, 'g');
  return text.replace(re, '[redacted]');
}

/**
 * @deprecated
 */
function sanitizeFeedback(s: string, correct: number): string {
  const stripped = s.replace(/`{3,}[\s\S]*?`{3,}/g, '').replace(/\s+\n/g, '\n').trim();
  const redacted = redactAnswer(stripped, correct);
  return redacted.length > FEEDBACK_MAX_LEN ? redacted.slice(0, FEEDBACK_MAX_LEN).trim() : redacted;
}

async function generateFeedback(apiKey: string, modelName: string, prompt: string, isCorrect: boolean): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  let lastErr: any = null;
  for (let i = 0; i <= FEEDBACK_MAX_RETRIES; i++) {
    try {
      const resp = await withTimeout(model.generateContent(prompt), FEEDBACK_TIMEOUT_MS);
      const text = resp.response.text().trim();
      if (text) return text;
    } catch (e: any) {
      lastErr = e;
    }
  }

  const message = isCorrect 
    ? 'Well done on getting the correct answer! Keep up the great work and continue practicing to strengthen your skills.' 
    : 'Keep trying! Review your calculations and consider where you might have gone wrong. Practice makes perfect, so don\'t give up!';

  return message;
}


export async function POST(req: NextRequest) {
  try {

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const { session_id, user_answer } = Body.parse(await req.json());

    const { data: session, error: sErr } = await supabase
      .from('math_problem_sessions')
      .select('id, problem_text, correct_answer, revealed_at')
      .eq('id', session_id)
      .single();
    if (sErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    if (session.revealed_at) {
      return NextResponse.json(
        { error: 'solution_revealed', message: 'Solution already revealed. Submissions are disabled for this problem.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { data: solvedRow, error: solvedErr } = await supabase
      .from('math_problem_submissions')
      .select('id')
      .eq('session_id', session_id)
      .eq('is_correct', true)
      .limit(1)
      .maybeSingle();

    if (solvedErr) {
      return NextResponse.json({ error: solvedErr.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    if (solvedRow) {
      return NextResponse.json(
        { error: 'already_solved', message: 'This problem has already been solved.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const userAnswer = Number(user_answer)
    const correctAnswer = Number(session.correct_answer);
    const is_correct = userAnswer === correctAnswer;
    const client_id = getOrCreateClientId();
    const feedback = buildFeedbackPrompt(session.problem_text, correctAnswer, userAnswer, is_correct);

    const [feedback_text, existingScore] = await Promise.all([
      generateFeedback(
        apiKey,
        MODEL,
        feedback,
        is_correct
      ),
      supabase
        .from('score_summaries')
        .select('*')
        .eq('client_id', client_id)
        .maybeSingle()
        .then(({ data }) => data)
    ]);

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

    if (subErr) {
      const msg = subErr.message || '';
      if (msg.includes('duplicate key') || msg.includes('23505')) {
        return NextResponse.json(
          { error: 'already_solved', message: 'This problem has already been solved.' },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return NextResponse.json({ error: subErr.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    let total_attempts = (existingScore?.total_attempts ?? 0) + 1;
    let correct_count = (existingScore?.correct_count ?? 0) + (is_correct ? 1 : 0);
    let current_streak = is_correct ? (existingScore?.current_streak ?? 0) + 1 : 0;
    let best_streak = Math.max(existingScore?.best_streak ?? 0, current_streak);
    let points = Math.max(0, (existingScore?.points ?? 0) + (is_correct ? POINTS_CORRECT : POINTS_INCORRECT));

    const { error: scoreErr } = await supabase
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

    if (scoreErr) {
      return NextResponse.json({ error: scoreErr.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const res = NextResponse.json(
      {
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
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );

    const jar = cookies();
    if (!jar.get('mpg_id')) {
      res.cookies.set('mpg_id', client_id, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' });
    }

    return res;
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ error: 'Bad request', issues: e.issues }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
