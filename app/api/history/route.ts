// app/api/history/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type SubmissionRow = {
  id: string;
  created_at: string;
  user_answer: number;
  is_correct: boolean;
  feedback_text: string;
};

type SessionRow = {
  id: string;
  created_at: string;
  problem_text: string;
  correct_answer: number;
  difficulty: string | null;
  submissions: SubmissionRow[] | null;
};

function clampLimit(raw: string | null): number {
  const n = Number(raw ?? DEFAULT_LIMIT);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.trunc(n), MAX_LIMIT);
}

function parseBefore(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function mapSubmission(s: SubmissionRow) {
  return {
    id: s.id,
    created_at: s.created_at,
    user_answer: s.user_answer,
    is_correct: s.is_correct,
    feedback_text: s.feedback_text
  };
}

function mapSession(row: SessionRow) {
  const subs = Array.isArray(row.submissions) ? row.submissions : [];
  const latest = subs.length ? subs[0] : null;

  return {
    id: row.id,
    created_at: row.created_at,
    difficulty: (row.difficulty as 'Easy' | 'Medium' | 'Hard') ?? 'Medium',
    problem_text: row.problem_text,
    has_submission: subs.length > 0,
    last_submission: latest
      ? {
          id: latest.id,
          created_at: latest.created_at,
          user_answer: latest.user_answer,
          is_correct: latest.is_correct,
          feedback_text: latest.feedback_text
        }
      : null,
    submissions: subs.map(mapSubmission)
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = clampLimit(searchParams.get('limit'));
    const before = parseBefore(searchParams.get('before'));

    let query = supabase
      .from('math_problem_sessions')
      .select(
        `
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
      `
      )
      .order('created_at', { ascending: false })
      .limit(limit)
      .order('created_at', { foreignTable: 'math_problem_submissions', ascending: false });

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = (data as SessionRow[] | null)?.map(mapSession) ?? [];

    const nextCursor =
      items.length > 0 ? items[items.length - 1].created_at : null;

    return NextResponse.json({ items, next_cursor: nextCursor, limit });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Unknown error', items: [], next_cursor: null },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const { error } = await supabase
      .from('math_problem_sessions')
      .delete()
      .gt('created_at', '1970-01-01T00:00:00Z');

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
