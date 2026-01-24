import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useGame } from './hooks/useGame'
import {
  Header,
  GuessInput,
  GuessList,
  WinCelebration,
  BullseyeVisualization
} from './components'

function Game() {
  const {
    guesses,
    gameWon,
    gameNumber,
    totalWords,
    makeGuess,
    rankings,
    targetWord
  } = useGame()

  const [showCelebration, setShowCelebration] = useState(false)
  const [sortBy, setSortBy] = useState<'guess' | 'rank'>('guess')
  const [activeTab, setActiveTab] = useState<'list' | 'viz'>('list')

  const handleGuess = (word: string) => {
    const result = makeGuess(word)
    if (result.success && result.result?.isCorrect) {
      setShowCelebration(true)
    }
    return result
  }

  return (
    <div className="min-h-screen bg-game-bg flex flex-col">
      <Header gameNumber={gameNumber} />

      <main className="flex-1 px-4 py-6 max-w-4xl mx-auto w-full">
        {/* Game status */}
        {gameWon && !showCelebration && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-600 rounded-lg text-center">
            <p className="text-green-400 font-semibold">
              🎉 You found the word: <span className="uppercase">{targetWord}</span>!
            </p>
            <button
              onClick={() => setShowCelebration(true)}
              className="mt-2 text-sm text-green-500 hover:text-green-400 underline"
            >
              View results & share
            </button>
          </div>
        )}

        {/* Input */}
        <GuessInput onGuess={handleGuess} disabled={gameWon} />

        {/* Tab navigation */}
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => setActiveTab('list')}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${activeTab === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }
            `}
          >
            📋 Guess List
          </button>
          <button
            onClick={() => setActiveTab('viz')}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${activeTab === 'viz'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }
            `}
          >
            🎯 Visualization
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'list' ? (
          <GuessList
            guesses={guesses}
            totalWords={totalWords}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
        ) : (
          <BullseyeVisualization
            guesses={guesses}
            rankings={rankings}
            targetWord={targetWord}
            totalWords={totalWords}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-4 text-center text-gray-500 text-sm">
        <p>A semantic word guessing game powered by word embeddings</p>
      </footer>

      {/* Win celebration modal */}
      {showCelebration && (
        <WinCelebration
          guesses={guesses}
          gameNumber={gameNumber}
          targetWord={targetWord}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Game />} />
    </Routes>
  )
}

export default App
