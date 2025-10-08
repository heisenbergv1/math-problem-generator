// components/SettingsPanel.tsx

import React, { useCallback, useMemo } from 'react'
import Link from 'next/link'
import { BrainIcon, HistoryIcon } from 'lucide-react'
import { Difficulty, ProblemType } from '@/lib/types'

interface SettingsPanelProps {
  difficulty: Difficulty
  setDifficulty: (difficulty: Difficulty) => void
  problemType: ProblemType
  setProblemType: (problemType: ProblemType) => void
  generateProblem: () => void
  isLoading: boolean
}

export const SettingsPanel = React.memo(function SettingsPanel({
  difficulty,
  setDifficulty,
  problemType,
  setProblemType,
  generateProblem,
  isLoading,
}: SettingsPanelProps) {
  const difficultyOptions = useMemo<Difficulty[]>(
    () => ['Easy', 'Medium', 'Hard'],
    []
  )

  const problemTypeOptions = useMemo<
    { value: ProblemType; label: string }[]
  >(
    () => [
      { value: 'addition', valueLabel: 'Addition' } as any,
      { value: 'subtraction', valueLabel: 'Subtraction' } as any,
      { value: 'multiplication', valueLabel: 'Multiplication' } as any,
      { value: 'division', valueLabel: 'Division' } as any,
      { value: 'mixed', valueLabel: 'Mixed' } as any,
    ].map(({ value, valueLabel }) => ({ value, label: valueLabel })),
    []
  )

  const onDifficultyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setDifficulty(e.target.value as Difficulty)
    },
    [setDifficulty]
  )

  const onProblemTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setProblemType(e.target.value as ProblemType)
    },
    [setProblemType]
  )

  const onGenerateClick = useCallback(() => {
    if (!isLoading) generateProblem()
  }, [generateProblem, isLoading])

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-4 border border-indigo-100 h-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Problem Settings</h2>

      <div>
        <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-2">
          Difficulty
        </label>
        <select
          id="difficulty"
          value={difficulty}
          onChange={onDifficultyChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
          aria-label="Select difficulty"
        >
          {difficultyOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="problemType" className="block text-sm font-medium text-gray-700 mb-2">
          Problem Type
        </label>
        <select
          id="problemType"
          value={problemType}
          onChange={onProblemTypeChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
          aria-label="Select problem type"
        >
          {problemTypeOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <button
          onClick={onGenerateClick}
          disabled={isLoading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out flex items-center justify-center gap-2"
          aria-busy={isLoading}
          aria-disabled={isLoading}
        >
          <BrainIcon size={18} />
          {isLoading ? 'Generating...' : 'Generate New Problem'}
        </button>

        <Link
          href="/history"
          className="rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          prefetch
        >
          <HistoryIcon size={18} />
          History
        </Link>
      </div>
    </div>
  )
})
