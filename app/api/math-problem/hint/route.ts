import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.GOOGLE_MODEL || 'gemini-2.0-flash';

const Body = z.object({
  session_id: z.string().uuid(),
  user_answer: z.number().optional()
});

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

      Rules:
      - 1–2 sentences.
      - Nudge the student toward the next step or the key operation (${session.problem_type ?? 'operation'}).
      - No spoilers of the final answer.
      Return plain text only.
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

    return NextResponse.json({
      hint_id: hint.id,
      hint_text: hint.hint_text,
      created_at: hint.created_at
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ error: 'Bad request', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
