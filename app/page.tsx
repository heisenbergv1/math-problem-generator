// app/page.tsx

'use client'

import { useEffect, useState } from 'react'
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

export default function Home() {
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
  const [score, setScore] = useState<Score>(null)
  const [hints, setHints] = useState<string[]>([])
  const [isHintLoading, setIsHintLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [modalTitle, setModalTitle] = useState('')

  useEffect(() => {
    fetch('/api/score', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setScore(j.score ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowModal(false)
      }
    }
    if (showModal) window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [showModal])

  const generateProblem = async () => {
    setIsLoadingSettingsPanel(true)
    setFeedback('')
    setIsCorrect(null)
    setUserAnswer('')
    setHints([])
    try {
      const res = await fetch('/api/math-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty, problem_type: problemType })
      })
      const data = await res.json()
      // if (!res.ok) throw new Error(data.error || 'Something went wrong while generating.')
      if (!res.ok) throw new Error('Something went wrong while generating. Please try again later.')
      setIsSubmitDisabled(false)
      setSessionId(data.session_id)
      setProblem({ problem_text: data.problem_text })
    } catch (err: any) {
      setFeedback(err.message ?? 'Something went wrong while generating.')
      setIsCorrect(false)
    } finally {
      setIsLoadingSettingsPanel(false)
    }
  }

  const requestHint = async () => {
    if (!sessionId) return
    if (hints.length >= 5) return
    setIsHintLoading(true)
    try {
      const res = await fetch('/api/math-problem/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_answer: userAnswer ? Number(userAnswer) : undefined
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to get hint')
      const nextHints = [...hints, String(data.hint_text ?? '')]
      setHints(nextHints.slice(0, 5))
      if (data.score) setScore(data.score)
    } catch (e: any) {
      const nextHints = [...hints, e.message ?? 'Unable to get a hint right now.']
      setHints(nextHints.slice(0, 5))
    } finally {
      setIsHintLoading(false)
    }
  }

  const submitAnswer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionId) return
    if (isCorrect === true) {
      setModalTitle('Already Solved')
      setModalMessage('You already solved this one! Generate a new problem to answer again.')
      setShowModal(true)
      return
    }
    setIsLoadingSubmit(true)
    setFeedback('')
    setIsCorrect(null)
    try {
      const res = await fetch('/api/math-problem/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, user_answer: Number(userAnswer) })
      })
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
      setFeedback(err.message ?? 'Something went wrong while submitting.')
    } finally {
      setIsLoadingSubmit(false)
    }
  }

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

        {score && <ScoreDisplay score={score} />}

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
            {problem ? (
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
                  onSolutionRevealed={() => {
                    setIsSubmitDisabled(true)
                    setModalTitle('Solution Revealed')
                    setModalMessage('You revealed the solution steps. Submissions are disabled for this problem. Generate a new one to continue.')
                    if (!isCorrect) setShowModal(true)
                  }}
                />

                {!isSubmitDisabled ?
                  <HintDisplay
                    hints={hints}
                    isHintLoading={isHintLoading}
                    requestHint={requestHint}
                    sessionId={sessionId}
                    maxHints={5}
                  /> : null}
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

        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setShowModal(false)}
        >
          <div
            className={`w-[90vw] max-w-md rounded-2xl border border-emerald-200/70 bg-emerald-50/95 shadow-2xl ring-1 ring-emerald-100/60 transition-all duration-300 ease-out transform ${showModal ? 'opacity-100 scale-100 animate-pop' : 'opacity-0 scale-95'}`}
            onClick={(e) => e.stopPropagation()}
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
                onClick={() => setShowModal(false)}
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
