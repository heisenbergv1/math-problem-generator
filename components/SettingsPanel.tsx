import React from 'react'
import { BrainIcon, HistoryIcon } from 'lucide-react'

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type ProblemType = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed';

interface SettingsPanelProps {
  difficulty: Difficulty
  setDifficulty: (difficulty: Difficulty) => void
  problemType: ProblemType
  setProblemType: (problemType: ProblemType) => void
  generateProblem: () => void
  isLoading: boolean
}
export function SettingsPanel({
  difficulty,
  setDifficulty,
  problemType,
  setProblemType,
  generateProblem,
  isLoading,
}: SettingsPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 space-y-4 border border-indigo-100">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Difficulty
        </label>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
        >
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Problem Type
        </label>
        <select
          value={problemType}
          onChange={(e) => setProblemType(e.target.value as ProblemType)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
        >
          <option value="addition">Addition</option>
          <option value="subtraction">Subtraction</option>
          <option value="multiplication">Multiplication</option>
          <option value="division">Division</option>
          <option value="mixed">Mixed</option>
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={generateProblem}
          disabled={isLoading}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out flex items-center justify-center gap-2"
        >
          <BrainIcon size={18} />
          {isLoading ? 'Generating...' : 'Generate New Problem'}
        </button>
        <a
          href="/history"
          className="rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <HistoryIcon size={18} />
          History
        </a>
      </div>
    </div>
  )
}
