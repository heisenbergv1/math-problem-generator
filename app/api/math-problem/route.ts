import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.GOOGLE_MODEL || 'gemini-2.0-flash';

const Body = z.object({
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional().default('Medium'),
  problem_type: z.enum(['addition','subtraction','multiplication','division','mixed']).optional().default('addition')
});

const Output = z.object({
  problem_text: z.string().min(10),
  final_answer: z.number()
});

function extractJsonSnippet(text: string): string {
  const fenced = text.match(/```json([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1];
  const braces = text.match(/\{[\s\S]*\}/);
  return braces ? braces[0] : text;
}

function sanitizeToStrictJson(text: string): string {
  let s = extractJsonSnippet(text);
  s = s.replace(/```json|```/gi, '');
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  s = s.replace(/\r?\n+/g, ' ');
  return s.trim();
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 });

    const { difficulty, problem_type } = Body.parse(await req.json().catch(() => ({})));

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const typeInstruction = problem_type === 'mixed'
      ? 'The required operations may include addition, subtraction, multiplication, and division. Choose what fits naturally for the story.'
      : `The required operation used to solve must be ${problem_type}.`;

    const prompt = `
      You are generating ONE Primary 5 (Grade 5) math WORD PROBLEM.
      Difficulty: ${difficulty}
      Problem Type: ${problem_type}
      Rules:
      - ${typeInstruction}
      - One short paragraph (<= 80 words).
      - Topics: whole numbers, time/money, simple rates; keep numbers age-appropriate.
      - Return ONLY JSON:
      {"problem_text": "...", "final_answer": 123}
      Scale the numbers and steps to match the difficulty:
      - Easy: 1–2 steps, small integers.
      - Medium: 2–3 steps, moderate integers or simple fractions.
      - Hard: up to 3 steps, centered on the specified type if not mixed; if mixed, still Primary 5 and reasonable.
      `;

    const resp = await model.generateContent(prompt);
    const raw = resp.response.text().trim();
    const jsonText = sanitizeToStrictJson(raw);

    const parsed = Output.safeParse(JSON.parse(jsonText));
    if (!parsed.success) {
      return NextResponse.json({ error: 'AI JSON invalid', issues: parsed.error.format(), raw }, { status: 502 });
    }

    const { data, error } = await supabase
      .from('math_problem_sessions')
      .insert({
        problem_text: parsed.data.problem_text,
        correct_answer: parsed.data.final_answer,
        difficulty,
        problem_type
      })
      .select('id, problem_text, difficulty, problem_type')
      .single();

    if (error) throw error;

    return NextResponse.json({
      session_id: data.id,
      problem_text: data.problem_text,
      difficulty: data.difficulty,
      problem_type: data.problem_type
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
