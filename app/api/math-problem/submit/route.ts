import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';

const Body = z.object({
  session_id: z.string().uuid(),
  user_answer: z.number()
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, user_answer } = Body.parse(body);

    // Fetch session
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
    const model = genAI.getGenerativeModel({ model: process.env.GOOGLE_MODEL });

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

    const { data: submission, error: subErr } = await supabase
      .from('math_problem_submissions')
      .insert({
        session_id,
        user_answer,
        is_correct,
        feedback_text
      })
      .select('id, is_correct, feedback_text')
      .single();

    if (subErr) throw subErr;

    return NextResponse.json({
      submission_id: submission.id,
      is_correct: submission.is_correct,
      feedback: submission.feedback_text
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ error: 'Bad request', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
