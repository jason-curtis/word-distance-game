import { cosineSimilarity } from './similarity'
import type { GuessResult, GameState } from '../types'

// Deterministic daily word selection based on date
export function getDailyWordIndex(words: string[], date: Date = new Date()): number {
  // Use a simple hash of the date string
  const dateStr = date.toISOString().split('T')[0]
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash) % words.length
}

// Get game number (days since a reference date)
export function getGameNumber(date: Date = new Date()): number {
  const referenceDate = new Date('2024-01-01')
  const diffTime = date.getTime() - referenceDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return diffDays + 1
}

// Pre-compute all similarity rankings for the target word
export function computeRankings(
  targetIndex: number,
  vectors: number[][],
  words: string[]
): Map<string, { similarity: number; rank: number }> {
  const targetVector = vectors[targetIndex]

  // Compute similarities for all words
  const similarities: { word: string; similarity: number }[] = []
  for (let i = 0; i < words.length; i++) {
    similarities.push({
      word: words[i],
      similarity: cosineSimilarity(targetVector, vectors[i])
    })
  }

  // Sort by similarity (highest first)
  similarities.sort((a, b) => b.similarity - a.similarity)

  // Create ranking map
  const rankings = new Map<string, { similarity: number; rank: number }>()
  similarities.forEach((item, index) => {
    rankings.set(item.word, {
      similarity: item.similarity,
      rank: index + 1 // 1-indexed
    })
  })

  return rankings
}

// Process a guess
export function processGuess(
  word: string,
  rankings: Map<string, { similarity: number; rank: number }>,
  targetWord: string,
  guessNumber: number,
  variants?: Record<string, string>
): GuessResult | null {
  let normalizedWord = word.toLowerCase().trim()

  // Check if this is a variant that maps to a canonical word
  if (variants && normalizedWord in variants) {
    normalizedWord = variants[normalizedWord]
  }

  const result = rankings.get(normalizedWord)

  if (!result) {
    return null // Word not in vocabulary
  }

  return {
    word: normalizedWord,
    similarity: result.similarity,
    rank: result.rank,
    isCorrect: normalizedWord === targetWord,
    guessNumber
  }
}

// Local storage keys
const STORAGE_KEY = 'semantle-game-state'

// Save game state to local storage
export function saveGameState(state: GameState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// Load game state from local storage
export function loadGameState(): GameState | null {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return null

  try {
    const state = JSON.parse(saved) as GameState
    // Check if it's today's game
    const today = new Date().toISOString().split('T')[0]
    if (state.date !== today) {
      return null // Old game, start fresh
    }
    return state
  } catch {
    return null
  }
}

// Clear game state
export function clearGameState(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// Generate share text
export function generateShareText(state: GameState): string {
  const lines = [
    `🎯 Semantle #${state.gameNumber}`,
    `Guesses: ${state.guesses.length}`,
    '',
    'Guess progression:'
  ]

  // Show the journey - key guesses
  const sortedGuesses = [...state.guesses].sort((a, b) => a.guessNumber - b.guessNumber)
  const keyGuesses = sortedGuesses.filter((g, i) =>
    i === 0 || // First guess
    g.isCorrect || // Winning guess
    g.rank < sortedGuesses[i - 1].rank // Getting closer
  ).slice(0, 10) // Max 10 key guesses

  keyGuesses.forEach(g => {
    const bar = getProgressBar(g.rank, state.guesses.length > 0 ?
      Math.max(...state.guesses.map(x => x.rank)) : 10000)
    lines.push(`${g.guessNumber}. ${bar} #${g.rank}`)
  })

  lines.push('')
  lines.push('https://semantle.example.com')

  return lines.join('\n')
}

// Generate a visual progress bar
function getProgressBar(rank: number, maxRank: number): string {
  const totalBlocks = 10
  const filledBlocks = Math.max(1, Math.round((1 - rank / maxRank) * totalBlocks))
  return '🟩'.repeat(filledBlocks) + '⬜'.repeat(totalBlocks - filledBlocks)
}
