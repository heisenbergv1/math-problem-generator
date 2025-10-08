// components/ProblemDisplay.tsx

import React, { useEffect, useState } from 'react';
import { LightbulbIcon, ListChecks, Loader2 } from 'lucide-react';
import { Difficulty, ProblemType } from '@/lib/types';
import { FeedbackDisplay } from './FeedbackDisplay';

interface ProblemDisplayProps {
  problem: { problem_text: string };
  difficulty: Difficulty;
  problemType: ProblemType;
  userAnswer: string;
  setUserAnswer: (answer: string) => void;
  submitAnswer: (e: React.FormEvent) => void;
  isLoading: boolean;
  isDisabled: boolean;
  isCorrect: boolean;
  feedback?: string;
  sessionId: string;
  onSolutionRevealed?: () => void;
}

export function ProblemDisplay({
  problem,
  difficulty,
  problemType,
  userAnswer,
  setUserAnswer,
  submitAnswer,
  isLoading,
  isDisabled,
  isCorrect,
  feedback,
  sessionId,
  onSolutionRevealed,
}: ProblemDisplayProps) {
  const [steps, setSteps] = useState<string[] | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [isStepsLoading, setIsStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState<string>('');

  const revealSteps = async () => {
    if (!sessionId || isStepsLoading) return;
    if (showSteps) return;
    setIsStepsLoading(true);
    setStepsError('');
    try {
      const res = await fetch('/api/math-problem/solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data?.error === 'solution_revealed') {
          setShowSteps(true);
          if (Array.isArray(data.steps)) setSteps(data.steps);
          onSolutionRevealed?.();
          return;
        }
        throw new Error(data.error || 'Failed to get solution');
      }
      setSteps(Array.isArray(data.steps) ? data.steps : []);
      setShowSteps(true);
      onSolutionRevealed?.();
    } catch (e: any) {
      setStepsError(e.message ?? 'Unable to get the solution steps right now.');
    } finally {
      setIsStepsLoading(false);
    }
  };

  useEffect(() => {
    setShowSteps(false);
  }, [problem]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-indigo-100">
      <div className="flex items-start mb-4">
        <div className="bg-indigo-100 p-2 rounded-full mr-3">
          <LightbulbIcon size={24} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Problem:</h2>
          <p className="text-sm text-gray-500 mb-2">
          Difficulty: <span className="font-medium">{difficulty}</span> •
          Type:{' '}
          <span className="font-medium">
            {problemType.charAt(0).toUpperCase() + problemType.slice(1)}
          </span>
          </p>
        </div>
      </div>
      <div className="bg-indigo-50 p-4 rounded-lg mb-6 text-center">
        <p className="text-xl text-gray-800 leading-relaxed font-medium">
          {problem.problem_text}
        </p>
      </div>

      <div className="mt-4 mb-4">
        <button
          onClick={revealSteps}
          disabled={!sessionId || isStepsLoading || showSteps}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
        >
          {isStepsLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading steps…
            </>
          ) : (
            <>
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              {showSteps ? 'Solution Revealed' : 'Show Solution Steps'}
            </>
          )}
        </button>
      </div>

      {stepsError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
          {stepsError ?? "Something went wrong while fetching the solution."}
        </div>
      )}

      {showSteps && steps && steps.length > 0 && (
        <div className="mt-4 mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 animate-fade-in">
          <h3 className="mb-2 text-sm font-semibold text-emerald-800">Step-by-step solution</h3>
          <ol className="list-decimal pl-5 text-gray-800 space-y-1">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div className="mt-3 text-sm text-emerald-900/80">
            Solution revealed. Generate a new problem to continue submitting answers.
          </div>
        </div>
      )}

      {feedback && !isCorrect && (
        <FeedbackDisplay feedback={feedback} isCorrect={isCorrect} />
      )}

      <form onSubmit={submitAnswer} className="space-y-4">
        <div className="mt-3 text-sm text-blue-900/80">
          Always round up to 2 decimal places for non-integer answers (e.g., 3.14).
        </div>
        <div>
          <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">
            Your Answer:
          </label>
          <input
            type="number"
            id="answer"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            placeholder="Enter your answer"
            required
            disabled={isDisabled}
          />
        </div>
        <button
          type="submit"
          disabled={!userAnswer || isLoading || isDisabled}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-102 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Checking...
            </>
          ) : 'Submit Answer'}
        </button>
      </form>
    </div>
  );
}
