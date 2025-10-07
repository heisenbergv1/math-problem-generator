import React from 'react'
import { LightbulbIcon } from 'lucide-react'

interface HintDisplayProps {
  hint: string
  isHintLoading: boolean
  requestHint: () => void
  sessionId: string | null
}

export function HintDisplay({
  hint,
  isHintLoading,
  requestHint,
  sessionId,
}: HintDisplayProps) {
  return (
    <div className="mt-4 mb-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={requestHint}
          disabled={!sessionId || isHintLoading}
          className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-white hover:bg-amber-600 disabled:bg-gray-400 transition-colors flex items-center gap-2"
        >
          <LightbulbIcon size={18} />
          {isHintLoading ? 'Getting hint...' : 'Get Hint'}
        </button>
        {hint && (
          <span className="text-sm text-gray-600">Hint shown below</span>
        )}
      </div>
      {hint && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-gray-800 animate-fade-in shadow-sm">
          <div className="flex">
            <div className="mr-3 flex-shrink-0">
              <LightbulbIcon size={20} className="text-amber-500" />
            </div>
            <div>
              <p className="font-medium text-amber-800 mb-1">Hint:</p>
              <p className="text-gray-700">{hint}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
