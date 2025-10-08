// app/api/math-problem/hint/route.ts
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

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 180;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function retry<T>(fn: () => Promise<T>) {
  let lastErr: any = null;
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < MAX_RETRIES) {
        const jitter = Math.floor(Math.random() * RETRY_BASE_MS);
        await delay(RETRY_BASE_MS * Math.pow(2, i) + jitter);
      }
    }
  }
  throw lastErr ?? new Error('transient_failure');
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });

    const { session_id, user_answer } = Body.parse(await req.json());

    const [sessionResult, countResult, listResult] = await Promise.all([
      supabase
        .from('math_problem_sessions')
        .select('id, problem_text, correct_answer, difficulty, problem_type')
        .eq('id', session_id)
        .single(),
      supabase
        .from('math_problem_hints')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session_id),
      supabase
        .from('math_problem_hints')
        .select('hint_text, created_at')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true })
    ]);

    if (sessionResult.error || !sessionResult.data) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    if (countResult.error) {
      return NextResponse.json({ error: countResult.error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
    const existingCount = countResult.count ?? 0;
    if (existingCount >= 5) {
      return NextResponse.json(
        { error: 'max_hints', message: 'Maximum number of hints reached for this problem.', hint_count: existingCount, max_hints: 5 },
        { status: 429, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (listResult.error) {
      return NextResponse.json({ error: listResult.error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const priorHints = Array.isArray(listResult.data) ? listResult.data.map(h => h.hint_text).filter(Boolean) : [];
    const historyBlock = priorHints.length
      ? `Previous hints (${priorHints.length}):\n${priorHints.map((h, i) => `${i + 1}) ${h}`).join('\n')}`
      : '';

    const session = sessionResult.data;
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
      Hint number to produce now: ${existingCount + 1}/5.
    `;

    const resp = await retry(() => model.generateContent(prompt));
    const candidate = resp.response.text().trim();
    const hint_text = candidate || 'Think about which operation fits the question, then try one small step.';

    const savedHint = await retry(async () => {
      const { data, error } = await supabase
        .from('math_problem_hints')
        .insert({ session_id, hint_text })
        .select('id, hint_text, created_at')
        .single();
      if (error) throw error;
      return data!;
    });

    const nextIndex = existingCount + 1;
    const penalties = [0, 2, 3, 4, 5];
    const deduction = penalties[Math.min(nextIndex - 1, penalties.length - 1)];

    const client_id = getOrCreateClientId();

    const { data: existingScore } = await supabase
      .from('score_summaries')
      .select('*')
      .eq('client_id', client_id)
      .maybeSingle();

    const points = Math.max(0, (existingScore?.points ?? 0) - deduction);

    const scoreSaved = await retry(async () => {
      const { data, error } = await supabase
        .from('score_summaries')
        .upsert({
          client_id,
          total_attempts: existingScore?.total_attempts ?? 0,
          correct_count: existingScore?.correct_count ?? 0,
          current_streak: existingScore?.current_streak ?? 0,
          best_streak: existingScore?.best_streak ?? 0,
          points,
          last_updated: new Date().toISOString()
        })
        .select('*')
        .single();
      if (error) throw error;
      return data!;
    });

    const res = NextResponse.json(
      {
        hint_id: savedHint.id,
        hint_text: savedHint.hint_text,
        created_at: savedHint.created_at,
        hint_count: nextIndex,
        max_hints: 5,
        deduction_applied: deduction,
        score: scoreSaved
          ? {
              client_id: scoreSaved.client_id,
              total_attempts: scoreSaved.total_attempts,
              correct_count: scoreSaved.correct_count,
              current_streak: scoreSaved.current_streak,
              best_streak: scoreSaved.best_streak,
              points: scoreSaved.points,
              accuracy: scoreSaved.total_attempts
                ? +(scoreSaved.correct_count * 100 / scoreSaved.total_attempts).toFixed(1)
                : 0
            }
          : null
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
