// components/ScoreDisplay.tsx
import React, { useMemo } from 'react';
import { TrendingUpIcon, CheckCircleIcon, ZapIcon, AwardIcon } from 'lucide-react';

export type Score = {
  client_id: string;
  total_attempts: number;
  correct_count: number;
  current_streak: number;
  best_streak: number;
  points: number;
  accuracy: number;
} | null;

interface ScoreDisplayProps {
  score: Score;
}

export const ScoreDisplay = React.memo(function ScoreDisplay({
  score
}: ScoreDisplayProps) {
  const safe = useMemo(
    () => ({
      points: score?.points ?? 0,
      accuracy: Number.isFinite(score?.accuracy) ? score!.accuracy : 0,
      current_streak: score?.current_streak ?? 0,
      best_streak: score?.best_streak ?? 0
    }),
    [score]
  );

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite">
      <div className="rounded-lg bg-white p-4 shadow-md border border-indigo-100 transition-transform hover:transform hover:scale-105">
        <div className="flex items-center gap-2 mb-1 text-indigo-600">
          <TrendingUpIcon size={16} />
          <div className="text-xs font-medium uppercase">Points</div>
        </div>
        <div className="text-2xl font-bold text-gray-800">{safe.points}</div>
      </div>
      <div className="rounded-lg bg-white p-4 shadow-md border border-indigo-100 transition-transform hover:transform hover:scale-105">
        <div className="flex items-center gap-2 mb-1 text-green-600">
          <CheckCircleIcon size={16} />
          <div className="text-xs font-medium uppercase">Accuracy</div>
        </div>
        <div className="text-2xl font-bold text-gray-800">{safe.accuracy}%</div>
      </div>
      <div className="rounded-lg bg-white p-4 shadow-md border border-indigo-100 transition-transform hover:transform hover:scale-105">
        <div className="flex items-center gap-2 mb-1 text-amber-600">
          <ZapIcon size={16} />
          <div className="text-xs font-medium uppercase">Streak</div>
        </div>
        <div className="text-2xl font-bold text-gray-800">{safe.current_streak}</div>
      </div>
      <div className="rounded-lg bg-white p-4 shadow-md border border-indigo-100 transition-transform hover:transform hover:scale-105">
        <div className="flex items-center gap-2 mb-1 text-purple-600">
          <AwardIcon size={16} />
          <div className="text-xs font-medium uppercase">Best</div>
        </div>
        <div className="text-2xl font-bold text-gray-800">{safe.best_streak}</div>
      </div>
    </div>
  );
});
