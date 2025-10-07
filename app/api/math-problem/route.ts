import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';

const MODEL = process.env.GOOGLE_MODEL || 'gemini-2.0-flash';

const Body = z.object({
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional().default('Medium')
});

const Output = z.object({
  problem_text: z.string().min(10),
  final_answer: z.number()
});

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 });

    const { difficulty } = Body.parse(await req.json().catch(() => ({})));

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const prompt = `
      You are generating ONE Primary 5 (Grade 5) math WORD PROBLEM.
      Difficulty: ${difficulty}
      Rules:
      - One short paragraph (<= 80 words).
      - Topics: whole numbers, fractions, ratios, time/money, simple rates.
      - Return ONLY JSON:
      {"problem_text": "...", "final_answer": 123}
      Scale the numbers and steps to match the difficulty:
      - Easy: 1–2 steps, small integers.
      - Medium: 2–3 steps, moderate integers or simple fractions.
      - Hard: 3 steps, multi-operation or fraction/ratio composition, but still Primary 5.
      `;

    const resp = await model.generateContent(prompt);
    const raw = resp.response.text().trim();
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;

    const parsed = Output.safeParse(JSON.parse(json));
    if (!parsed.success) {
      return NextResponse.json({ error: 'AI JSON invalid', issues: parsed.error.format(), raw }, { status: 502 });
    }

    const { data, error } = await supabase
      .from('math_problem_sessions')
      .insert({
        problem_text: parsed.data.problem_text,
        correct_answer: parsed.data.final_answer,
        difficulty
      })
      .select('id, problem_text, difficulty')
      .single();

    if (error) throw error;

    return NextResponse.json({
      session_id: data.id,
      problem_text: data.problem_text,
      difficulty: data.difficulty
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
