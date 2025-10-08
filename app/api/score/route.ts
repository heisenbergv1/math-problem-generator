// app/api/score/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 200;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchScoreWithRetry(clientId: string) {
  let lastErr: any = null;
  for (let i = 0; i <= MAX_RETRIES; i++) {
    const { data, error } = await supabase
      .from('score_summaries')
      .select('client_id,total_attempts,correct_count,current_streak,best_streak,points')
      .eq('client_id', clientId)
      .maybeSingle();
    if (!error) return data ?? null;
    lastErr = error;
    if (i < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (i + 1));
  }
  throw lastErr ?? new Error('score_fetch_failed');
}

export async function GET() {
  try {
    const cid = cookies().get('mpg_id')?.value;
    if (!cid) {
      return NextResponse.json(
        { score: null },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    const data = await fetchScoreWithRetry(cid);
    if (!data) {
      return NextResponse.json(
        { score: null },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    const total_attempts = Number(data.total_attempts ?? 0);
    const correct_count = Number(data.correct_count ?? 0);
    const accuracy = total_attempts ? +(correct_count * 100 / total_attempts).toFixed(1) : 0;

    return NextResponse.json(
      {
        score: {
          client_id: data.client_id,
          total_attempts,
          correct_count,
          current_streak: Number(data.current_streak ?? 0),
          best_streak: Number(data.best_streak ?? 0),
          points: Number(data.points ?? 0),
          accuracy
        }
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Unknown error' },
      { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  }
}
