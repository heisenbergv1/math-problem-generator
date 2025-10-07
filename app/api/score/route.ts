// app/api/score/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cid = cookies().get('mpg_id')?.value;
    if (!cid) return NextResponse.json({ score: null });

    const { data, error } = await supabase
      .from('score_summaries')
      .select('*')
      .eq('client_id', cid)
      .maybeSingle();
    if (error) throw error;

    if (!data) return NextResponse.json({ score: null });

    const accuracy = data.total_attempts
      ? +(data.correct_count * 100 / data.total_attempts).toFixed(1)
      : 0;

    return NextResponse.json({
      score: {
        client_id: data.client_id,
        total_attempts: data.total_attempts,
        correct_count: data.correct_count,
        current_streak: data.current_streak,
        best_streak: data.best_streak,
        points: data.points,
        accuracy
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
