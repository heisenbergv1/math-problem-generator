import React from 'react';
import { CheckCircleIcon, XCircleIcon } from 'lucide-react';
interface FeedbackDisplayProps {
  feedback: string;
  isCorrect: boolean | null;
}
export function FeedbackDisplay({
  feedback,
  isCorrect
}: FeedbackDisplayProps) {
  return <div className={`rounded-lg shadow-lg p-6 border-2 transition-all animate-fade-in ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
    <div className="flex items-center mb-4">
      {isCorrect ? <CheckCircleIcon size={24} className="text-green-600 mr-2" /> : <XCircleIcon size={24} className="text-amber-600 mr-2" />}
      <h2 className="text-xl font-semibold text-gray-700">
        {isCorrect ? 'Correct!' : 'Not quite right'}
      </h2>
    </div>
    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
      {feedback}
    </p>
    {!isCorrect && <div className="mt-4 text-sm text-gray-600">
        Try again or generate a new problem.
      </div>}
  </div>;
}