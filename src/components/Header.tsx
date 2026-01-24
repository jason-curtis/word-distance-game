import { useState } from 'react'

interface HeaderProps {
  gameNumber: number
}

export function Header({ gameNumber }: HeaderProps) {
  const [showHelp, setShowHelp] = useState(false)

  return (
    <>
      <header className="w-full border-b border-gray-800 py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Semantle
            <span className="text-gray-500 text-sm ml-2 font-normal">
              #{gameNumber}
            </span>
          </h1>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowHelp(true)}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="How to play"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Help Modal */}
      {showHelp && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-white">How to Play</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-gray-300">
              <p>
                <strong className="text-white">Semantle</strong> is a word guessing game where you try to find the secret word based on <em>semantic similarity</em>.
              </p>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">🎯 Goal</h3>
                <p>Guess the secret word. Each guess shows you how semantically similar your word is to the target.</p>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">📊 Scoring</h3>
                <p>Words are ranked by how similar they are to the target word:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li><span className="text-green-400">🔥 Rank 1-10</span>: Very hot! Almost there!</li>
                  <li><span className="text-green-500">🥵 Rank 11-100</span>: Getting warm</li>
                  <li><span className="text-yellow-400">😅 Rank 101-500</span>: On the right track</li>
                  <li><span className="text-orange-400">😐 Rank 501-2500</span>: Lukewarm</li>
                  <li><span className="text-gray-400">🥶 Rank 2500+</span>: Cold</li>
                </ul>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">💡 Tips</h3>
                <ul className="space-y-1 text-sm">
                  <li>• Similarity is based on meaning, not spelling</li>
                  <li>• "Happy" and "joyful" are similar; "happy" and "hippy" are not</li>
                  <li>• Try different categories: emotions, objects, actions</li>
                  <li>• Use the visualization to see relationships</li>
                </ul>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">🗓️ Daily Word</h3>
                <p>A new word is chosen every day. Come back tomorrow for a new challenge!</p>
              </div>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  )
}
