// Cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Euclidean distance between two vectors
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }

  return Math.sqrt(sum)
}

// Convert similarity to a percentage (0-100)
export function similarityToPercentage(similarity: number): number {
  // Cosine similarity ranges from -1 to 1
  // Map to 0-100 range
  return Math.round(((similarity + 1) / 2) * 100)
}

// Get color based on rank
export function getRankColor(rank: number, totalWords: number): string {
  const percentile = rank / totalWords

  if (percentile <= 0.001) {
    return 'bg-green-500 text-white' // Top 0.1% - very hot
  } else if (percentile <= 0.01) {
    return 'bg-green-600 text-white' // Top 1%
  } else if (percentile <= 0.05) {
    return 'bg-yellow-500 text-black' // Top 5%
  } else if (percentile <= 0.1) {
    return 'bg-yellow-600 text-white' // Top 10%
  } else if (percentile <= 0.25) {
    return 'bg-orange-500 text-white' // Top 25%
  } else if (percentile <= 0.5) {
    return 'bg-orange-600 text-white' // Top 50%
  } else {
    return 'bg-gray-600 text-white' // Bottom 50% - cold
  }
}

// Get temperature emoji based on rank
export function getRankEmoji(rank: number, totalWords: number): string {
  const percentile = rank / totalWords

  if (percentile <= 0.001) return '🔥'
  if (percentile <= 0.01) return '🥵'
  if (percentile <= 0.05) return '😅'
  if (percentile <= 0.1) return '😊'
  if (percentile <= 0.25) return '😐'
  if (percentile <= 0.5) return '😕'
  return '🥶'
}
