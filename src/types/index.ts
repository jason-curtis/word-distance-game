export interface WordData {
  word: string
  vector: number[]
}

export interface GuessResult {
  word: string
  similarity: number
  rank: number
  isCorrect: boolean
  guessNumber: number
}

export interface GameState {
  targetWord: string
  guesses: GuessResult[]
  gameWon: boolean
  gameNumber: number
  date: string
}

export interface WordEmbeddings {
  words: string[]
  vectors: number[][]
  dimensions: number
  variants?: Record<string, string>  // Map from variant -> canonical word
}

export interface VisualizationPoint {
  word: string
  x: number
  y: number
  similarity: number
  rank: number
  isGuessed: boolean
  isTarget: boolean
}
