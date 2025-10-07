// app/page.tsx

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { TrophyIcon, BookOpenIcon, BrainIcon } from 'lucide-react'
import { ScoreDisplay } from '@/components/ScoreDisplay'
import { ProblemDisplay } from '@/components/ProblemDisplay'
import { FeedbackDisplay } from '@/components/FeedbackDisplay'
import { SettingsPanel } from '@/components/SettingsPanel'
import { HintDisplay } from '@/components/HintDisplay'

interface MathProblem {
  problem_text: string
  final_answer?: number
}

type Difficulty = 'Easy' | 'Medium' | 'Hard'
type ProblemType = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed'

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
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium')
  const [problemType, setProblemType] = useState<ProblemType>('addition')
  const [score, setScore] = useState<Score>(null)
  const [hint, setHint] = useState<string>('')
  const [isHintLoading, setIsHintLoading] = useState(false)

  useEffect(() => {
    fetch('/api/score', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setScore(j.score ?? null))
      .catch(() => {})
  }, [])

  const generateProblem = async () => {
    setIsLoading(true)
    setFeedback('')
    setIsCorrect(null)
    setUserAnswer('')
    setHint('')
    try {
      const res = await fetch('/api/math-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty, problem_type: problemType })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate problem')
      setSessionId(data.session_id)
      setProblem({ problem_text: data.problem_text })
    } catch (err: any) {
      setFeedback(err.message ?? 'Something went wrong while generating.')
      setIsCorrect(false)
    } finally {
      setIsLoading(false)
    }
  }

  const requestHint = async () => {
    if (!sessionId) return
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
      setHint(String(data.hint_text ?? ''))
    } catch (e: any) {
      setHint(e.message ?? 'Unable to get a hint right now.')
    } finally {
      setIsHintLoading(false)
    }
  }

  const submitAnswer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionId) return
    setIsLoading(true)
    setFeedback('')
    setIsCorrect(null)
    try {
      const res = await fetch('/api/math-problem/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_answer: Number(userAnswer)
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit answer')
      setIsCorrect(Boolean(data.is_correct))
      setFeedback(String(data.feedback ?? ''))
      if (data.score) setScore(data.score)
    } catch (err: any) {
      setIsCorrect(false)
      setFeedback(err.message ?? 'Something went wrong while submitting.')
    } finally {
      setIsLoading(false)
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
          <div className="w-full md:w-1/3">
            <SettingsPanel
              difficulty={difficulty}
              setDifficulty={setDifficulty}
              problemType={problemType}
              setProblemType={setProblemType}
              generateProblem={generateProblem}
              isLoading={isLoading}
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
                  isLoading={isLoading}
                />
                <HintDisplay
                  hint={hint}
                  isHintLoading={isHintLoading}
                  requestHint={requestHint}
                  sessionId={sessionId}
                />
                {feedback && (
                  <FeedbackDisplay feedback={feedback} isCorrect={isCorrect} />
                )}
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
                  Use the settings panel to generate a new math problem.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/history"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium"
            prefetch
          >
            <BookOpenIcon size={18} />
            View Problem History
          </Link>
        </div>
      </main>
    </div>
  )
}
