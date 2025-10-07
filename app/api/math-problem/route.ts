import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';

const Output = z.object({
  problem_text: z.string().min(10),
  final_answer: z.number()
});

const prompt = `
  You are generating ONE Primary 5 (Grade 5) math WORD PROBLEM.
  - Keep it one short paragraph (<= 80 words).
  - Topics: whole numbers, fractions, ratios, time/money, simple rates.
  - Provide a single numeric final answer.
  Return ONLY JSON:
  {"problem_text": "...", "final_answer": 123}
  `;

export async function POST() {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GOOGLE_MODEL });

    const resp = await model.generateContent(prompt);
    const raw = resp.response.text().trim();
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;

    const parsed = Output.safeParse(JSON.parse(json));
    if (!parsed.success) {
      return NextResponse.json({ error: 'AI JSON invalid', issues: parsed.error.format(), raw }, { status: 502 });
    }

    // Map final_answer -> correct_answer (your schema)
    const { data, error } = await supabase
      .from('math_problem_sessions')
      .insert({
        problem_text: parsed.data.problem_text,
        correct_answer: parsed.data.final_answer
      })
      .select('id, problem_text, correct_answer')
      .single();

    if (error) throw error;

    return NextResponse.json({
      session_id: data.id,
      problem_text: data.problem_text
      // Intentionally not returning correct_answer to the UI
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
