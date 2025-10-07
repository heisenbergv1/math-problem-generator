import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit') ?? 20);

    const query = supabase
      .from('math_problem_sessions')
      .select(`
        id,
        created_at,
        problem_text,
        correct_answer,
        difficulty,
        submissions:math_problem_submissions (
          id,
          created_at,
          user_answer,
          is_correct,
          feedback_text
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
      .order('created_at', { foreignTable: 'math_problem_submissions', ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const items = (data ?? []).map((row: any) => {
      const subs = Array.isArray(row.submissions) ? row.submissions : [];
      const latest = subs.length ? subs[0] : null;

      return {
        id: row.id,
        created_at: row.created_at,
        difficulty: row.difficulty ?? 'Medium',
        problem_text: row.problem_text,
        has_submission: subs.length > 0,
        last_submission: latest && {
          id: latest.id,
          created_at: latest.created_at,
          user_answer: latest.user_answer,
          is_correct: latest.is_correct,
          feedback_text: latest.feedback_text
        },
        submissions: subs.map((s: any) => ({
          id: s.id,
          created_at: s.created_at,
          user_answer: s.user_answer,
          is_correct: s.is_correct,
          feedback_text: s.feedback_text
        }))
      };
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
