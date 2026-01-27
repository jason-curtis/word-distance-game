import type { GuessResult } from '../types'
import { getRankColor, getRankEmoji } from '../utils/similarity'

interface GuessListProps {
  guesses: GuessResult[]
  totalWords: number
}

export function GuessList({ guesses, totalWords }: GuessListProps) {
  // Always sort by rank (best similarity first)
  const sortedGuesses = [...guesses].sort((a, b) => a.rank - b.rank)

  // Get the last guess (most recent)
  const lastGuess = guesses.length > 0 ? guesses[guesses.length - 1] : null

  if (guesses.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p className="text-lg">No guesses yet</p>
        <p className="text-sm mt-2">Enter a word above to start playing!</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Last guess display */}
      {lastGuess && (
        <>
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-semibold">
              Last Guess
            </div>
            <GuessRow
              guess={lastGuess}
              totalWords={totalWords}
            />
          </div>

          {/* Visual divider */}
          <div className="mb-6 border-t-2 border-gray-700" />
        </>
      )}

      {/* Guess list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {sortedGuesses.map((guess) => (
          <GuessRow
            key={guess.word}
            guess={guess}
            totalWords={totalWords}
          />
        ))}
      </div>

      {/* Stats */}
      <div className="mt-4 pt-4 border-t border-gray-700 text-center text-gray-400 text-sm">
        <p>{guesses.length} guesses | Best rank: #{Math.min(...guesses.map(g => g.rank))}</p>
      </div>
    </div>
  )
}

interface GuessRowProps {
  guess: GuessResult
  totalWords: number
}

function GuessRow({ guess, totalWords }: GuessRowProps) {
  const colorClass = getRankColor(guess.rank, totalWords)
  const emoji = getRankEmoji(guess.rank, totalWords)

  // Calculate progress bar width
  const progressWidth = Math.max(2, 100 - (guess.rank / totalWords) * 100)

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg p-3
        ${guess.isCorrect ? 'ring-2 ring-green-400' : ''}
        bg-gray-800
      `}
    >
      {/* Progress bar background */}
      <div
        className={`absolute inset-y-0 left-0 ${colorClass} opacity-30`}
        style={{ width: `${progressWidth}%` }}
      />

      {/* Content */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">{emoji}</span>
          <span className="font-medium text-white">
            {guess.word}
            {guess.isCorrect && ' 🎉'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`font-bold px-2 py-0.5 rounded ${colorClass}`}>
            #{guess.rank}
          </span>
        </div>
      </div>
    </div>
  )
}
