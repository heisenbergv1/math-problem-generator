// components/ProblemDisplay.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export const ProblemDisplay = React.memo(function ProblemDisplay({
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
  onSolutionRevealed
}: ProblemDisplayProps) {
  const [steps, setSteps] = useState<string[] | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [isStepsLoading, setIsStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);

  const problemTypeLabel = useMemo(
    () => problemType.charAt(0).toUpperCase() + problemType.slice(1),
    [problemType]
  );

  const resetStepsState = useCallback(() => {
    setShowSteps(false);
    setSteps(null);
    setStepsError('');
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  useEffect(() => {
    resetStepsState();
  }, [problem, resetStepsState]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const fetchWithRetry = useCallback(
    async (url: string, init: RequestInit, retries = 2, backoffMs = 400) => {
      let lastErr: any = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await fetch(url, init);
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (res.status >= 500 && attempt < retries) {
              await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
              continue;
            }
            const errMsg = data?.error || 'Failed to get solution';
            const err: any = new Error(errMsg);
            err.status = res.status;
            err.data = data;
            throw err;
          }
          return data;
        } catch (e: any) {
          if (e?.name === 'AbortError') throw e;
          lastErr = e;
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
          }
        }
      }
      throw lastErr || new Error('Network error');
    },
    []
  );

  const revealSteps = useCallback(async () => {
    if (!sessionId || isStepsLoading || showSteps) return;
    setIsStepsLoading(true);
    setStepsError('');
    abortRef.current = new AbortController();
    try {
      const data = await fetchWithRetry(
        '/api/math-problem/solution',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
          signal: abortRef.current.signal
        },
        2,
        350
      );
      const returnedSteps = Array.isArray(data.steps) ? data.steps : [];
      setSteps(returnedSteps);
      setShowSteps(true);
      onSolutionRevealed?.();
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      const fallback = e?.data?.error || e?.message || 'Unable to get the solution steps right now.';
      setStepsError(fallback);
    } finally {
      setIsStepsLoading(false);
      abortRef.current = null;
    }
  }, [sessionId, isStepsLoading, showSteps, fetchWithRetry, onSolutionRevealed]);

  const handleAnswerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUserAnswer(e.target.value);
    },
    [setUserAnswer]
  );

  const canReveal = useMemo(
    () => Boolean(sessionId) && !isStepsLoading && !showSteps,
    [sessionId, isStepsLoading, showSteps]
  );

  const canSubmit = useMemo(
    () => Boolean(userAnswer) && !isLoading && !isDisabled,
    [userAnswer, isLoading, isDisabled]
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-indigo-100">
      <div className="flex items-start mb-4">
        <div className="bg-indigo-100 p-2 rounded-full mr-3">
          <LightbulbIcon size={24} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Problem:</h2>
          <p className="text-sm text-gray-500 mb-2">
            Difficulty: <span className="font-medium">{difficulty}</span> • Type:{' '}
            <span className="font-medium">{problemTypeLabel}</span>
          </p>
        </div>
      </div>

      <div className="bg-indigo-50 p-4 rounded-lg mb-6 text-center">
        <p className="text-xl text-gray-800 leading-relaxed font-medium">{problem.problem_text}</p>
      </div>

      <div className="mt-4 mb-4">
        <button
          onClick={revealSteps}
          disabled={!canReveal}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
          aria-disabled={!canReveal}
          aria-busy={isStepsLoading}
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

      {isStepsLoading && (
        <div className="mt-2 mb-4 space-y-2" aria-live="polite">
          <div className="h-3 w-2/3 bg-emerald-100 animate-pulse rounded" />
          <div className="h-3 w-3/4 bg-emerald-100 animate-pulse rounded" />
          <div className="h-3 w-1/2 bg-emerald-100 animate-pulse rounded" />
        </div>
      )}

      {stepsError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-800" role="alert" aria-live="assertive">
          {stepsError}
        </div>
      )}

      {showSteps && steps && steps.length > 0 && (
        <div className="mt-4 mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 animate-fade-in" aria-live="polite">
          <h3 className="mb-2 text-sm font-semibold text-emerald-800">Step-by-step solution</h3>
          <ol className="list-decimal pl-5 text-gray-800 space-y-1">
            {steps.map((s, i) => (
              <li key={`${i}-${s.slice(0, 24)}`}>{s}</li>
            ))}
          </ol>
          <div className="mt-3 text-sm text-emerald-900/80">
            Solution revealed. Generate a new problem to continue submitting answers.
          </div>
        </div>
      )}

      {feedback && !isCorrect && <FeedbackDisplay feedback={feedback} isCorrect={isCorrect} />}

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
            onChange={handleAnswerChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            placeholder="Enter your answer"
            required
            disabled={isDisabled}
            inputMode="decimal"
          />
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-102 flex items-center justify-center gap-2"
          aria-disabled={!canSubmit}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Checking...
            </>
          ) : (
            'Submit Answer'
          )}
        </button>
      </form>
    </div>
  );
});
