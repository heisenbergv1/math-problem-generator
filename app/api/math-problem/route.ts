// app/api/math-problem/route.ts

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
  steps: z.array(z.string().min(1)).min(3).max(15),
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

function parseFinalFromSteps(steps: string[], fallback: number | null = null): number | null {
  const last = steps[steps.length - 1] ?? '';
  const m = last.match(/final\s*answer\s*:\s*(-?\d+(?:\.\d+)?)/i);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) return n;
  }
  return Number.isFinite(fallback as number) ? (fallback as number) : null;
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

    const p5TopicMenu = [
      'Fractions: add/subtract/multiply simple fractions and mixed numbers (no calculator)',
      'Percentage: find percentage part, discount or GST, or percentage increase/decrease',
      'Rate: constant rate problems (distance–time, work, unit price)',
      'Area of triangle or composite figures made of rectangles/squares/triangles',
      'Volume of cube/cuboid or liquid in a rectangular tank with cm³/ℓ relations',
      'Angles on a straight line/at a point/vertically opposite; properties of triangles',
      'Special quadrilaterals: parallelogram, rhombus, trapezium (properties without extra constructions)',
    ];

    const prompt = `
      You are generating ONE Primary 5 (Grade 5) math WORD PROBLEM aligned to the Singapore 2021 Primary Mathematics Syllabus (P5 level).

      Difficulty: ${difficulty}
      Problem Type: ${problem_type}

      Curriculum alignment:
      - Select exactly one focus from this P5 topic menu and make it central to the solution:
        - ${p5TopicMenu.join('\n  - ')}
      - Emphasise age-appropriate numeracy and real-world contexts (money, time, measures, everyday rates).
      - Respect the syllabus big ideas: Proportionality (ratios/rates/percentages), Equivalence (equal forms/values), Diagrams & Representations (clear quantities/units), Measures (with correct units), and Notations (concise symbols).

      Global rules:
      - ${typeInstruction}
      - One short paragraph (<= 80 words), self-contained, culturally neutral.
      - Use numbers and units suitable for Primary 5; avoid exotic contexts and multi-topic mashups.
      - Do not include code fences or commentary.

      OUTPUT REQUIREMENTS (STRICT; JSON ONLY, no extra text):
      {
        "problem_text": "...",
        "steps": ["Step 1 ...", "Step 2 ...", "...", "Final answer: <number>"],
        "final_answer": 123
      }

      STEPS RULES:
      - "steps" must be an array of 3–15 short strings (no markdown).
      - If any quantities are in fraction form, include one step showing both forms, e.g. "Convert: 3/4 = 0.75".
      - When converting to decimal, use round half-up to 2 decimal places (e.g., 1.245 → 1.25).
      - Do not repeat the full problem text in the steps.
      - Do not reveal multiple possible answers. Choose one correct result.
      - Keep each step short and actionable (<=160 characters).
      - THE FINAL STEP MUST BE EXACTLY "Final answer: <number>".

      FINAL ANSWER FORMAT:
      - The last step must be exactly "Final answer: <number>".
      - If the result is an integer, output it without decimals (e.g., 15).
      - Otherwise output exactly two decimal places (e.g., 12.50), using round half-up.
      - Do not include units or words after the number.

      Scaling by difficulty (strict; obey the line "Difficulty: ${difficulty}"):

      EASY:
      - Steps: 1–2.
      - Numbers: small integers 1–50 (avoid decimals and fractions).
      - STRICTLY MUST NOT include rates, fractions, percentages, multi-stage reasoning, or distracting extra data.

      MEDIUM:
      - Steps: 2–3.
      - Numbers: 10–500 (allow one simple fraction with denominator 2, 4, 5, 10 OR one decimal to 1 dp).
      - Operations: 
        - If PROBLEM TYPE is MIXED, may combine two operations or include regrouping; if division, keep exact results.
        - Otherwise, use the specified problem type (${problem_type})
      - May include a simple rate/percentage once; avoid multi-topic chains.

      HARD:
      - Steps: 2–3 (no more than 3).
      - Numbers: up to 1 000; allow simple fractions/decimals if needed.
      - Operations: 
        - If PROBLEM TYPE is MIXED, mixed operations or a two-stage reasoning (e.g., rate then total), still clean and solvable without advanced tricks.
        - Otherwise, use the specified problem type (${problem_type})
      - May include one distractor detail; keep arithmetic tidy (no unwieldy primes or messy remainders).

      Difficulty guard:
      - If your drafted problem violates any checklist item for the chosen Difficulty, silently fix/regenerate BEFORE returning JSON so that the final version matches the Difficulty exactly.
      - Ensure ${problem_type} is the operation pattern that leads to the solution (or naturally appears if "mixed").

      Uniqueness & answer:
      - The problem must have exactly one correct numeric answer.
      - Use a pure number unless a unit is completely obvious and standard (e.g., dollars, minutes).

      Return only the JSON object described above.
    `;

    const resp = await model.generateContent(prompt);
    const raw = resp.response.text().trim();
    const jsonText = sanitizeToStrictJson(raw);

    const parsedResult = Output.safeParse(JSON.parse(jsonText));
    if (!parsedResult.success) {
      return NextResponse.json({ error: 'AI JSON invalid', issues: parsedResult.error.format(), raw }, { status: 502 });
    }

    const steps = parsedResult.data.steps;
    const answerFromField = parsedResult.data.final_answer;
    const answerFromSteps = parseFinalFromSteps(steps, answerFromField);
    if (!Number.isFinite(answerFromSteps)) {
      return NextResponse.json({ error: 'Final answer missing or invalid in steps' }, { status: 502 });
    }

    const { data: sessionRow, error: insertErr } = await supabase
      .from('math_problem_sessions')
      .insert({
        problem_text: parsedResult.data.problem_text,
        correct_answer: answerFromSteps as number,
        difficulty,
        problem_type
      })
      .select('id, problem_text, difficulty, problem_type')
      .single();

    if (insertErr || !sessionRow) {
      return NextResponse.json({ error: insertErr?.message ?? 'Failed to create session' }, { status: 500 });
    }

    const { error: solErr } = await supabase
      .from('math_problem_solutions')
      .insert({
        session_id: sessionRow.id,
        steps
      });

    if (solErr && !String(solErr.message || '').toLowerCase().includes('duplicate')) {
      return NextResponse.json({ error: solErr.message }, { status: 500 });
    }

    return NextResponse.json({
      session_id: sessionRow.id,
      problem_text: sessionRow.problem_text,
      difficulty: sessionRow.difficulty,
      problem_type: sessionRow.problem_type
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
