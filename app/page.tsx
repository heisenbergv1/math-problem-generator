// app/page.tsx

'use client'

import { useState } from 'react'

interface MathProblem {
  problem_text: string
  final_answer?: number
}

type Difficulty = 'Easy' | 'Medium' | 'Hard'

export default function Home() {
  const [problem, setProblem] = useState<MathProblem | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium')

  const generateProblem = async () => {
    setIsLoading(true)
    setFeedback('')
    setIsCorrect(null)
    setUserAnswer('')
    try {
      const res = await fetch('/api/math-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty })
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
    } catch (err: any) {
      setIsCorrect(false)
      setFeedback(err.message ?? 'Something went wrong while submitting.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          Math Problem Generator
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={generateProblem}
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
            >
              {isLoading ? 'Generating...' : 'Generate New Problem'}
            </button>
            <a
              href="/history"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50"
            >
              History
            </a>
          </div>
        </div>

        {problem && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2 text-gray-700">Problem:</h2>
            <p className="text-sm text-gray-500 mb-2">Difficulty: {difficulty}</p>
            <p className="text-lg text-gray-800 leading-relaxed mb-6">
              {problem.problem_text}
            </p>

            <form onSubmit={submitAnswer} className="space-y-4">
              <div>
                <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Answer:
                </label>
                <input
                  type="number"
                  id="answer"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your answer"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!userAnswer || isLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
              >
                {isLoading ? 'Checking…' : 'Submit Answer'}
              </button>
            </form>
          </div>
        )}

        {feedback && (
          <div className={`rounded-lg shadow-lg p-6 ${isCorrect ? 'bg-green-50 border-2 border-green-200' : 'bg-yellow-50 border-2 border-yellow-200'}`}>
            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              {isCorrect ? '✅ Correct!' : '❌ Not quite right'}
            </h2>
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{feedback}</p>
          </div>
        )}
      </main>
    </div>
  )
}