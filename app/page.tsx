// app/page.tsx

'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { TrophyIcon, BrainIcon } from 'lucide-react'
import { ScoreDisplay } from '@/components/ScoreDisplay'
import { ProblemDisplay } from '@/components/ProblemDisplay'
import { SettingsPanel } from '@/components/SettingsPanel'
import { HintDisplay } from '@/components/HintDisplay'
import { Difficulty, ProblemType } from '@/lib/types'

interface MathProblem {
  problem_text: string
  final_answer?: number
}

type Score = {
  client_id: string
  total_attempts: number
  correct_count: number
  current_streak: number
  best_streak: number
  points: number
  accuracy: number
} | null

const MAX_HINTS = 5
const SCORE_ENDPOINT = '/api/score'
const GENERATE_ENDPOINT = '/api/math-problem'
const HINT_ENDPOINT = '/api/math-problem/hint'
const SUBMIT_ENDPOINT = '/api/math-problem/submit'
const STORAGE_KEY = 'mpg_session_v1'
const SCORE_DEFAULT = {
  client_id: "",
  total_attempts: 0,
  correct_count: 0,
  current_streak: 0,
  best_streak: 0,
  points: 0,
  accuracy: 0,
}

export default function Home() {
  const [isPending, startTransition] = useTransition()
  const [problem, setProblem] = useState<MathProblem | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false)
  const [isLoadingSettingsPanel, setIsLoadingSettingsPanel] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isSubmitDisabled, setIsSubmitDisabled] = useState<boolean | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium')
  const [problemType, setProblemType] = useState<ProblemType>('addition')
  const [score, setScore] = useState<Score>(SCORE_DEFAULT)
  const [hints, setHints] = useState<string[]>([])
  const [isHintLoading, setIsHintLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [modalTitle, setModalTitle] = useState('')

  const abortRefs = useRef<AbortController[]>([])

  const addAborter = useCallback((c: AbortController) => {
    abortRefs.current.push(c)
  }, [])

  const abortAll = useCallback(() => {
    abortRefs.current.forEach(c => c.abort())
    abortRefs.current = []
  }, [])

  const fetchWithRetry = useCallback(async (input: RequestInfo | URL, init?: RequestInit, retries = 2, backoff = 400): Promise<Response> => {
    let attempt = 0
    let lastErr: any
    while (attempt <= retries) {
      try {
        const res = await fetch(input, init)
        if (!res.ok && res.status >= 500) throw new Error(`Server error ${res.status}`)
        return res
      } catch (e: any) {
        lastErr = e
        if (attempt === retries) break
        await new Promise(r => setTimeout(r, backoff * Math.pow(2, attempt)))
        attempt++
      }
    }
    throw lastErr
  }, [])

  useEffect(() => {
    const c = new AbortController()
    addAborter(c)
    fetchWithRetry(SCORE_ENDPOINT, { cache: 'no-store', signal: c.signal }).then(r => r.json()).then(j => setScore(j.score ?? null)).catch(() => {})
    return abortAll
  }, [addAborter, abortAll, fetchWithRetry])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved && typeof saved === 'object') {
        setProblem(saved.problem ?? null)
        setSessionId(saved.sessionId ?? null)
        setUserAnswer(saved.userAnswer ?? '')
        setHints(Array.isArray(saved.hints) ? saved.hints.slice(0, MAX_HINTS) : [])
        setIsSubmitDisabled(saved.isSubmitDisabled ?? null)
        setIsCorrect(saved.isCorrect ?? null)
        setFeedback(saved.feedback ?? '')
        setDifficulty(saved.difficulty ?? 'Medium')
        setProblemType(saved.problemType ?? 'addition')
      }
    } catch {}
  }, [])

  const persisted = useMemo(() => ({
    problem, sessionId, userAnswer, hints, isSubmitDisabled, isCorrect, feedback, difficulty, problemType
  }), [problem, sessionId, userAnswer, hints, isSubmitDisabled, isCorrect, feedback, difficulty, problemType])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
    } catch {}
  }, [persisted])

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setShowModal(false)
  }, [])

  useEffect(() => {
    if (showModal) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showModal, handleEsc])

  const generateProblem = useCallback(async () => {
    abortAll()
    const c = new AbortController()
    addAborter(c)
    setIsLoadingSettingsPanel(true)
    setFeedback('')
    setIsCorrect(null)
    setUserAnswer('')
    setHints([])
    try {
      const res = await fetchWithRetry(GENERATE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty, problem_type: problemType }),
        signal: c.signal
      }, 2, 400)
      const data = await res.json()
      if (!res.ok) throw new Error('Something went wrong while generating. Please try again later.')
      startTransition(() => {
        setIsSubmitDisabled(false)
        setSessionId(data.session_id)
        setProblem({ problem_text: data.problem_text })
      })
    } catch (err: any) {
      setFeedback(err?.message ?? 'Something went wrong while generating.')
      setIsCorrect(false)
    } finally {
      setIsLoadingSettingsPanel(false)
    }
  }, [difficulty, problemType, abortAll, addAborter, fetchWithRetry, startTransition])

  const requestHint = useCallback(async () => {
    if (!sessionId) return
    if (hints.length >= MAX_HINTS) return
    const c = new AbortController()
    addAborter(c)
    setIsHintLoading(true)
    try {
      const res = await fetchWithRetry(HINT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_answer: userAnswer ? Number(userAnswer) : undefined
        }),
        signal: c.signal
      }, 2, 300)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to get hint')
      const nextHints = [...hints, String(data.hint_text ?? '')]
      setHints(nextHints.slice(0, MAX_HINTS))
      if (data.score) setScore(data.score)
    } catch (e: any) {
      const nextHints = [...hints, e?.message ?? 'Unable to get a hint right now.']
      setHints(nextHints.slice(0, MAX_HINTS))
    } finally {
      setIsHintLoading(false)
    }
  }, [sessionId, hints, userAnswer, addAborter, fetchWithRetry])

  const submitAnswer = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionId) return
    if (isCorrect === true) {
      setModalTitle('Already Solved')
      setModalMessage('You already solved this one! Generate a new problem to answer again.')
      setShowModal(true)
      return
    }
    const c = new AbortController()
    addAborter(c)
    setIsLoadingSubmit(true)
    setFeedback('')
    setIsCorrect(null)
    try {
      const res = await fetchWithRetry(SUBMIT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, user_answer: Number(userAnswer) }),
        signal: c.signal
      }, 2, 400)
      const data = await res.json()
      if (res.status === 409 && data?.error === 'already_solved') {
        setIsCorrect(true)
        setModalTitle('Already Solved')
        setModalMessage(String(data?.message ?? 'This problem has already been solved.'))
        setShowModal(true)
        return
      }
      if (res.status === 409 && data?.error === 'solution_revealed') {
        setIsSubmitDisabled(true)
        setModalTitle('Solution Revealed')
        setModalMessage('You revealed the solution steps. Submissions are disabled for this problem. Generate a new one to continue.')
        setShowModal(true)
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to submit answer')
      const correct = Boolean(data.is_correct)
      setIsCorrect(correct)
      if (correct) {
        setIsSubmitDisabled(true)
        setModalTitle('Correct Answer!')
        setModalMessage(String(data.feedback ?? 'Great job! That\'s the correct answer.'))
        setShowModal(true)
      } else {
        setFeedback(String(data.feedback ?? ''))
      }
      if (data.score) setScore(data.score)
    } catch (err: any) {
      setIsCorrect(false)
      setFeedback(err?.message ?? 'Something went wrong while submitting.')
    } finally {
      setIsLoadingSubmit(false)
    }
  }, [sessionId, isCorrect, userAnswer, addAborter, fetchWithRetry])

  const handleOverlayClick = useCallback(() => {
    setShowModal(false)
  }, [])

  const handleDialogClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  const handleSolutionRevealed = useCallback(() => {
    setIsSubmitDisabled(true)
    setModalTitle('Solution Revealed')
    setModalMessage('You revealed the solution steps. Submissions are disabled for this problem. Generate a new one to continue.')
    if (!isCorrect) setShowModal(true)
  }, [isCorrect])

  const showRightPaneSkeleton = useMemo(() => isLoadingSettingsPanel || isPending, [isLoadingSettingsPanel, isPending])

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50">
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="mb-8 text-center">
          <div className="inline-block p-2 bg-indigo-600 text-white rounded-lg mb-4">
            <TrophyIcon size={32} />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Math Problem Generator
          </h1>
          <p className="text-gray-600">Challenge yourself with math problems!</p>
        </header>

        <ScoreDisplay score={score} />

        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3 md:h-96 md:overflow-y-auto md:min-h-0">
            <SettingsPanel
              difficulty={difficulty}
              setDifficulty={setDifficulty}
              problemType={problemType}
              setProblemType={setProblemType}
              generateProblem={generateProblem}
              isLoading={isLoadingSettingsPanel}
            />
          </div>

          <div className="w-full md:w-2/3 flex flex-col">
            {showRightPaneSkeleton ? (
              <div className="bg-white rounded-lg shadow-lg p-8 border border-indigo-100 h-96 animate-pulse">
                <div className="h-6 w-40 bg-indigo-100 rounded mb-4" />
                <div className="h-6 w-64 bg-indigo-100 rounded mb-2" />
                <div className="h-24 w-full bg-indigo-50 rounded mb-6" />
                <div className="h-10 w-40 bg-indigo-100 rounded" />
              </div>
            ) : problem ? (
              <>
                <ProblemDisplay
                  problem={problem}
                  difficulty={difficulty}
                  problemType={problemType}
                  userAnswer={userAnswer}
                  setUserAnswer={setUserAnswer}
                  submitAnswer={submitAnswer}
                  isLoading={isLoadingSubmit}
                  feedback={feedback}
                  isCorrect={isCorrect}
                  isDisabled={isSubmitDisabled}
                  sessionId={sessionId ?? ''}
                  onSolutionRevealed={handleSolutionRevealed}
                />

                {!isSubmitDisabled ? (
                  <HintDisplay
                    hints={hints}
                    isHintLoading={isHintLoading}
                    requestHint={requestHint}
                    sessionId={sessionId}
                    maxHints={MAX_HINTS}
                  />
                ) : null}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-8 border border-indigo-100 text-center flex flex-col items-center justify-center h-96">
                <div className="text-indigo-500 mb-4">
                  <BrainIcon size={48} />
                </div>
                <h2 className="text-xl font-semibold text-gray-700 mb-2">
                  No Problem Generated Yet
                </h2>
                <p className="text-gray-600">
                  {feedback || 'Use the settings panel to generate a new math problem.'}
                </p>
              </div>
            )}
          </div>
        </div>

        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={handleOverlayClick}
        >
          <div
            className={`w-[90vw] max-w-md rounded-2xl border border-emerald-200/70 bg-emerald-50/95 shadow-2xl ring-1 ring-emerald-100/60 transition-all duration-300 ease-out transform ${showModal ? 'opacity-100 scale-100 animate-pop' : 'opacity-0 scale-95'}`}
            onClick={handleDialogClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-desc"
          >
            <div className="flex items-start gap-3 p-6 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 ring-1 ring-emerald-200">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="M22 4 12 14.01l-3-3" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 id="modal-title" className="text-lg font-semibold text-emerald-900">{modalTitle}</h3>
                <p id="modal-desc" className="mt-1 text-emerald-900/80">{modalMessage}</p>
              </div>
            </div>
            <div className="px-6">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-200/70 to-transparent" />
            </div>
            <div className="flex items-center justify-end gap-2 p-6 pt-4">
              <button
                onClick={handleOverlayClick}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-white font-semibold shadow hover:shadow-md transition-all duration-200 hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.98]"
              >
                OK
              </button>
            </div>
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
      </main>
    </div>
  )
}
