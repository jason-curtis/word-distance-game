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

interface WordData {
  words: string[]
  vectors: number[][]
}

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
  isLoading: boolean
  loadingProgress: string
  isRandomMode: boolean
}

export function useGame(): UseGameReturn {
  const [guesses, setGuesses] = useState<GuessResult[]>([])
  const [gameWon, setGameWon] = useState(false)
  const [wordData, setWordData] = useState<WordData | null>(null)
  const [loadingProgress, setLoadingProgress] = useState('Loading embeddings...')

  const today = new Date()
  const gameNumber = getGameNumber(today)
  const dateStr = today.toISOString().split('T')[0]

  // Load word data asynchronously
  useEffect(() => {
    let cancelled = false

    async function loadWordData() {
      setLoadingProgress('Loading word embeddings...')

      try {
        // Dynamic import - Vite will code-split this
        const data = await import('../data/words.json')

        if (!cancelled) {
          setLoadingProgress('Processing...')
          // Small delay to show processing state
          await new Promise(resolve => setTimeout(resolve, 50))
          setWordData({
            words: data.words as string[],
            vectors: data.vectors as number[][]
          })
        }
      } catch (error) {
        console.error('Failed to load word data:', error)
        setLoadingProgress('Failed to load embeddings')
      }
    }

    loadWordData()
    return () => { cancelled = true }
  }, [])

  // Get words and vectors from the loaded data
  const words = wordData?.words ?? []
  const vectors = wordData?.vectors ?? []
  const totalWords = words.length

  // Get target word - either from random seed in localStorage or daily
  const targetIndex = useMemo(() => {
    if (words.length === 0) return 0

    // Check for custom random seed (set by "New random word" button)
    const randomSeed = localStorage.getItem('randomWordSeed')
    if (randomSeed) {
      return parseInt(randomSeed, 10) % words.length
    }

    // Otherwise use daily word
    return getDailyWordIndex(words, today)
  }, [words, today])

  const targetWord = words[targetIndex] ?? ''
  const isRandomMode = !!localStorage.getItem('randomWordSeed')

  // Compute rankings (memoized)
  const rankings = useMemo(() => {
    if (words.length === 0 || vectors.length === 0) {
      return new Map<string, { similarity: number; rank: number }>()
    }
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

    if (normalizedWord.length < 3) {
      return { success: false, error: 'Word must be at least 3 characters' }
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

  const isLoading = wordData === null

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
    wordVectors: { words, vectors },
    isLoading,
    loadingProgress,
    isRandomMode
  }
}
