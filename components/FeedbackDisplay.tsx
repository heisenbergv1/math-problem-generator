// components/FeedbackDisplay.tsx
import React, { useMemo } from 'react';
import { CheckCircleIcon, XCircleIcon } from 'lucide-react';

interface FeedbackDisplayProps {
  feedback: string;
  isCorrect: boolean | null;
}

export const FeedbackDisplay = React.memo(function FeedbackDisplay({
  feedback,
  isCorrect
}: FeedbackDisplayProps) {
  const styleClasses = useMemo(
    () =>
      `mb-6 rounded-lg shadow-lg p-6 border-2 transition-all animate-fade-in ${
        isCorrect ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
      }`,
    [isCorrect]
  );

  const title = isCorrect ? 'Correct!' : 'Not quite right';
  const Icon = isCorrect ? CheckCircleIcon : XCircleIcon;
  const iconColor = isCorrect ? 'text-green-600' : 'text-amber-600';

  return (
    <div className={styleClasses} aria-live="polite">
      <div className="flex items-center mb-4">
        <Icon size={24} className={`${iconColor} mr-2`} />
        <h2 className="text-xl font-semibold text-gray-700">{title}</h2>
      </div>
      <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{feedback}</p>
      {!isCorrect && (
        <div className="mt-4 text-sm text-gray-600">Try again or generate a new problem.</div>
      )}
    </div>
  );
});
