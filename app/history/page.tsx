// app/history/page.tsx

'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Submission = {
  id: string;
  created_at: string;
  user_answer: number;
  is_correct: boolean;
  feedback_text: string;
};

type HistoryItem = {
  id: string;
  created_at: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  problem_text: string;
  has_submission: boolean;
  last_submission?: {
    id: string;
    created_at: string;
    user_answer: number;
    is_correct: boolean;
    feedback_text: string;
  } | null;
  submissions?: Submission[];
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

async function fetchWithRetry(url: string, init: RequestInit, retries = 2, delayMs = 400) {
  let err: unknown = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error('Failed to load history');
      return res.json();
    } catch (e) {
      err = e;
      if (i < retries) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
        continue;
      }
      throw err;
    }
  }
  throw err;
}

async function getHistory() {
  const data = await fetchWithRetry(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/history`, { cache: 'no-store' });
  return (data.items ?? []) as HistoryItem[];
}

function HistorySkeleton() {
  return (
    <div className="mt-6 space-y-4">
      {[0,1,2].map(i => (
        <div key={i} className="rounded-xl border bg-white p-5 shadow-md">
          <div className="h-4 w-32 bg-slate-200 rounded mb-3" />
          <div className="h-5 w-3/4 bg-slate-200 rounded" />
          <div className="h-16 w-full bg-slate-100 rounded mt-3" />
        </div>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getHistory();
        if (mounted) {
          setItems(data);
          setErrorMessage(null);
        }
      } catch (e: any) {
        if (mounted) setErrorMessage(e?.message ?? 'Unknown error while loading history.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleCleared = useCallback(() => {
    setItems([]);
    setErrorMessage(null);
  }, []);

  const itemsView = useMemo(() => {
    return items.map(it => ({
      ...it,
      createdAtLabel: dateFormatter.format(new Date(it.created_at)),
      lastSubmission: it.last_submission
        ? {
            ...it.last_submission,
            createdAtLabel: dateFormatter.format(new Date(it.last_submission.created_at))
          }
        : null,
      submissionsView: (it.submissions ?? []).map(s => ({
        ...s,
        createdAtLabel: dateFormatter.format(new Date(s.created_at))
      }))
    }));
  }, [items]);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-blue-50 to-indigo-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Problem History</h1>
          <div className="flex items-center gap-2">
            <Suspense fallback={null}>
              <ClearHistoryButton onCleared={handleCleared} />
            </Suspense>
            <Link
              href="/"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white"
            >
              Back
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <div className="font-semibold mb-1">Couldn’t load history</div>
            <div className="text-sm opacity-90">{errorMessage}</div>
          </div>
        )}

        {loading ? (
          <HistorySkeleton />
        ) : (
          <div className="mt-6 space-y-4">
            {itemsView.length === 0 && !errorMessage && (
              <div className="rounded-lg border bg-white p-6 text-gray-600">
                No history yet. Generate a problem and come back.
              </div>
            )}

            {itemsView.map((it) => (
              <div key={it.id} className="rounded-xl border bg-white p-5 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-gray-500">
                    {it.createdAtLabel}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {it.difficulty}
                    </span>
                    {it.has_submission ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${it.lastSubmission?.is_correct ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {it.lastSubmission?.is_correct ? 'Last: Correct' : 'Last: Try again'}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        No submissions
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-gray-900">{it.problem_text}</p>

                {it.lastSubmission && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-gray-700 hover:underline">
                      View latest feedback
                    </summary>
                    <div className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">
                      <div className="mb-1 text-xs text-gray-500">
                        Answer: <strong>{it.lastSubmission.user_answer}</strong> · {it.lastSubmission.createdAtLabel}
                      </div>
                      {it.lastSubmission.feedback_text}
                    </div>
                  </details>
                )}

                {(it.submissionsView.length ?? 0) > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-gray-700 hover:underline">
                      View all attempts ({it.submissionsView.length})
                    </summary>
                    <div className="mt-2 overflow-hidden rounded-md border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left w-48">When</th>
                            <th className="px-3 py-2 text-left">Answer</th>
                            <th className="px-3 py-2 text-left">Result</th>
                            <th className="px-3 py-2 text-left">Feedback</th>
                          </tr>
                        </thead>
                        <tbody>
                          {it.submissionsView.map((s) => (
                            <tr key={s.id} className="border-t">
                              <td className="px-3 py-2">{s.createdAtLabel}</td>
                              <td className="px-3 py-2">{s.user_answer}</td>
                              <td className="px-3 py-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.is_correct ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {s.is_correct ? 'Correct' : 'Incorrect'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-700 whitespace-pre-wrap">{s.feedback_text}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ClearHistoryButton({ onCleared }: { onCleared?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleCancel = useCallback(() => { if (!loading) setOpen(false); }, [loading]);
  const handleOverlayClick = useCallback(() => { if (!loading) setOpen(false); }, [loading]);
  const handleDialogClick = useCallback((e: React.MouseEvent) => { e.stopPropagation(); }, []);
  const handleConfirm = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/history', { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Failed to clear history');
      setOpen(false);
      if (onCleared) onCleared();
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to clear history');
    } finally {
      setLoading(false);
    }
  }, [router, onCleared]);

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded-lg border border-red-200 bg-white px-4 py-2 font-semibold text-red-700 hover:bg-red-50 transition-colors"
      >
        Clear History
      </button>

      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleOverlayClick}
      >
        <div
          className={`w-[90vw] max-w-md rounded-2xl border border-amber-300/80 bg-amber-50/95 shadow-2xl ring-1 ring-amber-200/70 transition-all duration-300 ease-out transform ${open ? 'opacity-100 scale-100 animate-pop' : 'opacity-0 scale-95'}`}
          onClick={handleDialogClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-desc"
        >
          <div className="flex items-start gap-3 p-6 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 ring-1 ring-amber-200">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-amber-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 id="modal-title" className="text-lg font-semibold text-amber-900">Clear History?</h3>
              <p id="modal-desc" className="mt-1 text-amber-900/80">This will permanently remove all problems and their attempts. This action cannot be undone.</p>
              {error && <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
            </div>
          </div>
          <div className="px-6">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
          </div>
          <div className="flex items-center justify-end gap-2 p-6 pt-4">
            <button
              onClick={handleCancel}
              className="rounded-lg px-4 py-2 font-semibold text-gray-800 hover:bg-amber-100 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 text-white font-semibold shadow hover:shadow-md transition-all duration-200 hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Clearing…' : 'Yes, clear'}
            </button>
          </div>
          <style jsx>{`
            @keyframes pop {
              0% { transform: scale(0.96); opacity: 0; }
              60% { transform: scale(1.04); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            .animate-pop { animation: pop 200ms var(--ease-pop, cubic-bezier(.2,.8,.2,1)) both; }
          `}</style>
        </div>
      </div>
    </>
  );
}
