import React from 'react';
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
export function ScoreDisplay({
  score
}: ScoreDisplayProps) {
  if (!score) return null;
  return <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div className="rounded-lg bg-white p-4 shadow-md border border-indigo-100 transition-transform hover:transform hover:scale-105">
      <div className="flex items-center gap-2 mb-1 text-indigo-600">
        <TrendingUpIcon size={16} />
        <div className="text-xs font-medium uppercase">Points</div>
      </div>
      <div className="text-2xl font-bold text-gray-800">{score.points}</div>
    </div>
    <div className="rounded-lg bg-white p-4 shadow-md border border-indigo-100 transition-transform hover:transform hover:scale-105">
      <div className="flex items-center gap-2 mb-1 text-green-600">
        <CheckCircleIcon size={16} />
        <div className="text-xs font-medium uppercase">Accuracy</div>
      </div>
      <div className="text-2xl font-bold text-gray-800">
        {score.accuracy}%
      </div>
    </div>
    <div className="rounded-lg bg-white p-4 shadow-md border border-indigo-100 transition-transform hover:transform hover:scale-105">
      <div className="flex items-center gap-2 mb-1 text-amber-600">
        <ZapIcon size={16} />
        <div className="text-xs font-medium uppercase">Streak</div>
      </div>
      <div className="text-2xl font-bold text-gray-800">
        {score.current_streak}
      </div>
    </div>
    <div className="rounded-lg bg-white p-4 shadow-md border border-indigo-100 transition-transform hover:transform hover:scale-105">
      <div className="flex items-center gap-2 mb-1 text-purple-600">
        <AwardIcon size={16} />
        <div className="text-xs font-medium uppercase">Best</div>
      </div>
      <div className="text-2xl font-bold text-gray-800">
        {score.best_streak}
      </div>
    </div>
  </div>;
}