import { useState, useEffect, useCallback, useMemo } from 'react'
import type { GameState, GuessResult } from '../types'
import {
  getDailyWordIndex,
  getGameNumber,
  computeRankings,
  processGuess,
  saveGameState,
  loadGameState
} from '../utils/gameLogic'

// Sample word data - this will be replaced with actual processed GloVe data
import wordData from '../data/words.json'

interface UseGameReturn {
  targetWord: string
  guesses: GuessResult[]
  gameWon: boolean
  gameNumber: number
  totalWords: number
  makeGuess: (word: string) => { success: boolean; error?: string; result?: GuessResult }
  rankings: Map<string, { similarity: number; rank: number }>
  isValidWord: (word: string) => boolean
  getHint: () => string | null
  wordVectors: { words: string[]; vectors: number[][] }
}

export function useGame(): UseGameReturn {
  const [guesses, setGuesses] = useState<GuessResult[]>([])
  const [gameWon, setGameWon] = useState(false)

  const today = new Date()
  const gameNumber = getGameNumber(today)
  const dateStr = today.toISOString().split('T')[0]

  // Get words and vectors from the loaded data
  const words = wordData.words as string[]
  const vectors = wordData.vectors as number[][]
  const totalWords = words.length

  // Get today's target word
  const targetIndex = getDailyWordIndex(words, today)
  const targetWord = words[targetIndex]

  // Compute rankings (memoized)
  const rankings = useMemo(() => {
    return computeRankings(targetIndex, vectors, words)
  }, [targetIndex, vectors, words])

  // Load saved game state on mount
  useEffect(() => {
    const savedState = loadGameState()
    if (savedState && savedState.date === dateStr) {
      setGuesses(savedState.guesses)
      setGameWon(savedState.gameWon)
    }
  }, [dateStr])

  // Save game state when it changes
  useEffect(() => {
    if (guesses.length > 0) {
      const state: GameState = {
        targetWord,
        guesses,
        gameWon,
        gameNumber,
        date: dateStr
      }
      saveGameState(state)
    }
  }, [guesses, gameWon, targetWord, gameNumber, dateStr])

  // Check if a word is valid
  const isValidWord = useCallback((word: string): boolean => {
    return rankings.has(word.toLowerCase().trim())
  }, [rankings])

  // Make a guess
  const makeGuess = useCallback((word: string): { success: boolean; error?: string; result?: GuessResult } => {
    const normalizedWord = word.toLowerCase().trim()

    if (!normalizedWord) {
      return { success: false, error: 'Please enter a word' }
    }

    if (!isValidWord(normalizedWord)) {
      return { success: false, error: 'Word not in vocabulary' }
    }

    // Check if already guessed
    if (guesses.some(g => g.word === normalizedWord)) {
      return { success: false, error: 'Already guessed' }
    }

    const result = processGuess(normalizedWord, rankings, targetWord, guesses.length + 1)
    if (!result) {
      return { success: false, error: 'Word not in vocabulary' }
    }

    setGuesses(prev => [...prev, result])

    if (result.isCorrect) {
      setGameWon(true)
    }

    return { success: true, result }
  }, [guesses, rankings, targetWord, isValidWord])

  // Get a hint (closest unguessed word)
  const getHint = useCallback((): string | null => {
    if (gameWon) return null

    // Find the closest word that hasn't been guessed
    const guessedWords = new Set(guesses.map(g => g.word))

    // Get sorted entries by rank
    const sortedEntries = Array.from(rankings.entries())
      .sort((a, b) => a[1].rank - b[1].rank)

    for (const [word] of sortedEntries) {
      if (word !== targetWord && !guessedWords.has(word)) {
        // Return a hint about this word
        const data = rankings.get(word)!
        if (data.rank <= 100) {
          return `Try a word related to concepts like "${word.charAt(0)}..."`
        }
        break
      }
    }

    return null
  }, [guesses, rankings, targetWord, gameWon])

  return {
    targetWord,
    guesses,
    gameWon,
    gameNumber,
    totalWords,
    makeGuess,
    rankings,
    isValidWord,
    getHint,
    wordVectors: { words, vectors }
  }
}
