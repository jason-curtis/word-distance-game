import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import type { GuessResult } from '../types'
import { generateShareText } from '../utils/gameLogic'

interface WinCelebrationProps {
  guesses: GuessResult[]
  gameNumber: number
  targetWord: string
  onClose: () => void
  isRandomMode?: boolean
}

export function WinCelebration({ guesses, gameNumber, targetWord, onClose, isRandomMode = false }: WinCelebrationProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Trigger confetti animation
    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        clearInterval(interval)
        return
      }

      const particleCount = 50 * (timeLeft / duration)

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      })
    }, 250)

    return () => clearInterval(interval)
  }, [])

  const handleShare = async () => {
    const shareText = isRandomMode
      ? generateShareText({
          targetWord,
          guesses,
          gameWon: true,
          gameNumber: 0, // Use 0 for random mode to indicate no game number
          date: new Date().toISOString().split('T')[0]
        }).replace(/🎯 Semantle #0/, '🎯 Random Semantle')
      : generateShareText({
          targetWord,
          guesses,
          gameWon: true,
          gameNumber,
          date: new Date().toISOString().split('T')[0]
        })

    try {
      if (navigator.share) {
        await navigator.share({
          title: isRandomMode ? 'Random Semantle' : `Semantle #${gameNumber}`,
          text: shareText
        })
      } else {
        await navigator.clipboard.writeText(shareText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // Fallback to clipboard
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const winningGuess = guesses.find(g => g.isCorrect)

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full text-center animate-bounce-in">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold text-white mb-2">You got it!</h2>
        <p className="text-xl text-green-400 font-semibold mb-4">
          The word was: <span className="uppercase">{targetWord}</span>
        </p>

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-white">{guesses.length}</p>
              <p className="text-gray-400 text-sm">Guesses</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">
                #{winningGuess?.guessNumber || '-'}
              </p>
              <p className="text-gray-400 text-sm">Winning Guess</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleShare}
            className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
          >
            {copied ? '✓ Copied to clipboard!' : 'Share Results'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
          >
            Keep Playing
          </button>
        </div>

        <p className="mt-6 text-gray-500 text-sm">
          {isRandomMode
            ? 'Random Word • Play another random word anytime!'
            : `Semantle #${gameNumber} • Come back tomorrow for a new word!`
          }
        </p>
      </div>
    </div>
  )
}
