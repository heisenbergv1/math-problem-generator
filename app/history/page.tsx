import Link from 'next/link';

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

async function getHistory() {
  // If running on Vercel, leave empty and rely on relative fetch in client components.
  // In a server component, relative works too since Next maps it.
  // For absolute robustness across envs, you can set NEXT_PUBLIC_BASE_URL.
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/history`, {
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error('Failed to load history');
  }
  const data = await res.json();
  return (data.items ?? []) as HistoryItem[];
}

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const items = await getHistory();

  return (
    <main className="min-h-dvh bg-gradient-to-b from-blue-50 to-indigo-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Problem History</h1>
          <Link
            href="/"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white"
          >
            Back
          </Link>
        </div>

        <div className="mt-6 space-y-4">
          {items.length === 0 && (
            <div className="rounded-lg border bg-white p-6 text-gray-600">
              No history yet. Generate a problem and come back.
            </div>
          )}

          {items.map((it) => (
            <div key={it.id} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-gray-500">
                  {new Date(it.created_at).toLocaleString()}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {it.difficulty}
                  </span>
                  {it.has_submission ? (
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${it.last_submission?.is_correct ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {it.last_submission?.is_correct ? 'Last: Correct' : 'Last: Try again'}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      No submissions
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-3 text-gray-900">{it.problem_text}</p>

              {it.last_submission && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-gray-700 hover:underline">
                    View latest feedback
                  </summary>
                  <div className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">
                    <div className="mb-1 text-xs text-gray-500">
                      Answer: <strong>{it.last_submission.user_answer}</strong> · {new Date(it.last_submission.created_at).toLocaleString()}
                    </div>
                    {it.last_submission.feedback_text}
                  </div>
                </details>
              )}

              {(it.submissions?.length ?? 0) > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-gray-700 hover:underline">
                    View all attempts ({it.submissions?.length})
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
                        {it.submissions!.map((s) => (
                          <tr key={s.id} className="border-t">
                            <td className="px-3 py-2">{new Date(s.created_at).toLocaleString()}</td>
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
      </div>
    </main>
  );
}
