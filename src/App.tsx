import { useState, useEffect, useRef } from 'react'
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
    targetWord,
    wordVectors,
    isLoading,
    loadingProgress,
    isRandomMode,
    randomWordSeed
  } = useGame()

  const [showCelebration, setShowCelebration] = useState(false)
  const [activeTab, setActiveTab] = useState<'list' | 'viz'>('viz')

  // Expose reset function globally for console access
  const hasShownConsoleHelp = useRef(false)
  useEffect(() => {
    (window as any).resetGame = () => {
      console.clear()
      console.log('%c🔄 RESETTING GAME STATE 🔄', 'color: #ef4444; font-size: 20px; font-weight: bold;')
      console.log('%cClearing localStorage and reloading...', 'color: #fbbf24')
      localStorage.clear()
      setTimeout(() => window.location.reload(), 500)
    };
    (window as any).showAnswer = () => {
      console.log(`%cTarget: %c${targetWord.toUpperCase()}`, 'color: #fbbf24', 'color: #22c55e; font-size: 20px; font-weight: bold')
    };

    // Only show help once per page load
    if (!hasShownConsoleHelp.current) {
      console.log('%c💡 Dev Tools Available:', 'color: #6b7280; font-weight: bold')
      console.log('  %cresetGame()%c - Clear game state and reload', 'color: #60a5fa', 'color: inherit')
      console.log('  %cshowAnswer()%c - Reveal target word', 'color: #60a5fa', 'color: inherit')
      console.log('  Or type %c"cheat"%c for full debug info, %c"reset"%c to restart', 'color: #22c55e', 'color: inherit', 'color: #ef4444', 'color: inherit')
      console.log('  📱 Mobile: Type "cheat" in the input box then backspace it all', 'color: #6b7280')
      hasShownConsoleHelp.current = true
    }

    return () => {
      delete (window as any).resetGame
      delete (window as any).showAnswer
    }
  }, [targetWord])

  // Cheat codes: type "cheat" to reveal target word, "reset" to clear game state
  const cheatCodeRef = useRef('')
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      // Only track alphanumeric keys
      if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
        cheatCodeRef.current += e.key.toLowerCase()

        // Keep only last 5 characters
        if (cheatCodeRef.current.length > 5) {
          cheatCodeRef.current = cheatCodeRef.current.slice(-5)
        }

        // Check for reset code
        if (cheatCodeRef.current === 'reset') {
          console.clear()
          console.log('%c🔄 RESETTING GAME STATE 🔄', 'color: #ef4444; font-size: 20px; font-weight: bold;')
          console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #ef4444')
          console.log('%cClearing localStorage and reloading...', 'color: #fbbf24')
          localStorage.clear()
          setTimeout(() => {
            window.location.reload()
          }, 500)
          cheatCodeRef.current = ''
          return
        }

        // Check for cheat code
        if (cheatCodeRef.current === 'cheat') {
          displayCheatInfo()
          cheatCodeRef.current = '' // Reset
        }
      }
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [targetWord, gameNumber, totalWords, guesses, rankings])

  const handleGuess = (word: string) => {
    const result = makeGuess(word)
    if (result.success && result.result?.isCorrect) {
      setShowCelebration(true)
    }
    return result
  }

  // Shared cheat code display logic
  const displayCheatInfo = () => {
    console.clear()
    console.log('%c🎯 CHEAT MODE ACTIVATED 🎯', 'color: #22c55e; font-size: 20px; font-weight: bold;')
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #22c55e')
    console.log(`%cTarget Word: %c${targetWord.toUpperCase()}`, 'color: #fbbf24; font-size: 16px', 'color: #22c55e; font-size: 20px; font-weight: bold')
    console.log(`%cGame Number: %c#${gameNumber}`, 'color: #fbbf24', 'color: white; font-weight: bold')
    console.log(`%cTotal Words: %c${totalWords.toLocaleString()}`, 'color: #fbbf24', 'color: white; font-weight: bold')
    console.log(`%cGuesses Made: %c${guesses.length}`, 'color: #fbbf24', 'color: white; font-weight: bold')
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #22c55e')

    if (guesses.length > 0) {
      const bestGuess = guesses.reduce((best, g) => g.rank < best.rank ? g : best)
      console.log(`%cBest Guess: %c"${bestGuess.word}" %c(rank #${bestGuess.rank})`,
        'color: #fbbf24', 'color: #60a5fa; font-weight: bold', 'color: #9ca3af')

      // Show top 10 closest words
      const sortedGuesses = [...guesses].sort((a, b) => a.rank - b.rank).slice(0, 10)
      console.log('\n%cTop 10 Closest Guesses:', 'color: #fbbf24; font-weight: bold')
      sortedGuesses.forEach((g, i) => {
        console.log(`  ${i + 1}. "${g.word}" - rank #${g.rank}`)
      })
    }

    console.log('\n%cHint: Top 1000 words to try:', 'color: #fbbf24; font-weight: bold')
    const topWords = Array.from(rankings.entries())
      .sort((a, b) => a[1].rank - b[1].rank)
      .slice(0, 20)
      .filter(([word]) => !guesses.some(g => g.word === word))
      .slice(0, 10)
      .map(([word, data]) => `"${word}" (#${data.rank})`)
    console.log('  ' + topWords.join(', '))

    console.log('\n%c💡 Tip: Type "reset" to clear game state and start over', 'color: #6b7280; font-style: italic')
  }

  // Callback for mobile cheat code
  const handleCheatCode = () => {
    displayCheatInfo()
  }

  const handleNewGame = () => {
    // Set a random seed to get a different word
    const randomSeed = Math.floor(Math.random() * 1000000)
    localStorage.clear()
    localStorage.setItem('randomWordSeed', randomSeed.toString())
    window.location.reload()
  }

  const handleDailyGame = () => {
    // Clear random seed to go back to daily word
    localStorage.removeItem('randomWordSeed')
    localStorage.removeItem('semantle-game-state')
    window.location.reload()
  }

  // Show loading screen while embeddings load
  if (isLoading) {
    return (
      <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Loading Game</h2>
          <p className="text-gray-400">{loadingProgress}</p>
          <p className="text-gray-500 text-sm mt-2">First load may take a few seconds...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-game-bg flex flex-col">
      <Header gameNumber={gameNumber} randomWordSeed={randomWordSeed} />

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
        <GuessInput onGuess={handleGuess} disabled={gameWon} onCheatCode={handleCheatCode} />

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
          />
        ) : (
          <BullseyeVisualization
            guesses={guesses}
            rankings={rankings}
            targetWord={targetWord}
            totalWords={totalWords}
            wordVectors={wordVectors}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-4 text-center text-gray-500 text-sm">
        <p className="mb-2">
          {isRandomMode ? '🎲 Playing random mode' : '📅 Daily puzzle'}
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={handleNewGame}
            className="text-xs text-gray-600 hover:text-gray-400 underline"
          >
            New random word
          </button>
          {isRandomMode && (
            <button
              onClick={handleDailyGame}
              className="text-xs text-gray-600 hover:text-gray-400 underline"
            >
              Back to daily
            </button>
          )}
        </div>
      </footer>

      {/* Win celebration modal */}
      {showCelebration && (
        <WinCelebration
          guesses={guesses}
          gameNumber={gameNumber}
          targetWord={targetWord}
          onClose={() => setShowCelebration(false)}
          isRandomMode={isRandomMode}
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
