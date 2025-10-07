// components\HintDisplay.tsx
import React from 'react'
import { LightbulbIcon } from 'lucide-react'

interface HintDisplayProps {
  hints: string[]
  isHintLoading: boolean
  requestHint: () => void
  sessionId: string | null
  maxHints?: number
}

export function HintDisplay({
  hints,
  isHintLoading,
  requestHint,
  sessionId,
  maxHints = 5,
}: HintDisplayProps) {
  const count = hints.length
  const disabled = !sessionId || isHintLoading || count >= maxHints

  return (
    <div className="mt-4 mb-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={requestHint}
          disabled={disabled}
          className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-white hover:bg-amber-600 disabled:bg-gray-400 transition-colors flex items-center gap-2"
        >
          <LightbulbIcon size={18} />
          {isHintLoading ? 'Getting hint...' : `Get Hint (${count}/${maxHints})`}
        </button>
        {count > 0 && (
          <span className="text-sm text-gray-600">Hints appear below</span>
        )}
      </div>

      {count > 0 && (
        <div className="mt-3 space-y-3">
          {hints.map((h, i) => (
            <div key={i} className="rounded-md border border-amber-200 bg-amber-50 p-4 text-gray-800 animate-fade-in shadow-sm">
              <div className="flex">
                <div className="mr-3 flex-shrink-0">
                  <LightbulbIcon size={20} className="text-amber-500" />
                </div>
                <div>
                  <p className="font-medium text-amber-800 mb-1">Hint {i + 1}</p>
                  <p className="text-gray-700">{h}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
