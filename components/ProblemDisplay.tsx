import React from 'react';
import { LightbulbIcon } from 'lucide-react';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type ProblemType = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed';

interface ProblemDisplayProps {
  problem: {
    problem_text: string;
  };
  difficulty: Difficulty;
  problemType: ProblemType;
  userAnswer: string;
  setUserAnswer: (answer: string) => void;
  submitAnswer: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export function ProblemDisplay({
  problem,
  difficulty,
  problemType,
  userAnswer,
  setUserAnswer,
  submitAnswer,
  isLoading
}: ProblemDisplayProps) {
  return <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-indigo-100">
    <div className="flex items-start mb-4">
      <div className="bg-indigo-100 p-2 rounded-full mr-3">
        <LightbulbIcon size={24} className="text-indigo-600" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Problem:</h2>
        <p className="text-sm text-gray-500 mb-2">
          Difficulty: <span className="font-medium">{difficulty}</span> •
          Type:{' '}
          <span className="font-medium">
            {problemType.charAt(0).toUpperCase() + problemType.slice(1)}
          </span>
        </p>
      </div>
    </div>
    <div className="bg-indigo-50 p-4 rounded-lg mb-6 text-center">
      <p className="text-xl text-gray-800 leading-relaxed font-medium">
        {problem.problem_text}
      </p>
    </div>
    <form onSubmit={submitAnswer} className="space-y-4">
      <div>
        <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">
          Your Answer:
        </label>
        <input type="number" id="answer" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors" placeholder="Enter your answer" required />
      </div>
      <button type="submit" disabled={!userAnswer || isLoading} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-102 flex items-center justify-center gap-2">
        {isLoading ? <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Checking...
          </> : 'Submit Answer'}
      </button>
    </form>
  </div>;
}