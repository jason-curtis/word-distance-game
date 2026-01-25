import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import type { GuessResult } from '../types'

interface BullseyeVisualizationProps {
  guesses: GuessResult[]
  rankings: Map<string, { similarity: number; rank: number }>
  targetWord: string
  totalWords: number
  wordVectors: { words: string[]; vectors: number[][] }
}

interface PlotPoint {
  word: string
  rank: number
  similarity: number
  // 3D coordinates (before rotation)
  x3d: number
  y3d: number
  z3d: number
  isGuessed: boolean
  isTarget: boolean
}

// Compute difference vectors (guess - target), then PCA on those
// Returns 3 principal components for 3D visualization
function computeDifferencePCA3D(
  targetVector: number[],
  guessVectors: number[][]
): { pc1: number[]; pc2: number[]; pc3: number[] } {
  const n = guessVectors.length
  const d = targetVector.length

  if (n === 0) {
    const pc1 = new Array(d).fill(0)
    const pc2 = new Array(d).fill(0)
    const pc3 = new Array(d).fill(0)
    pc1[0] = 1
    pc2[1] = 1
    pc3[2] = 1
    return { pc1, pc2, pc3 }
  }

  // Compute difference vectors
  const diffs = guessVectors.map(v => v.map((val, i) => val - targetVector[i]))

  // Compute mean
  const mean = new Array(d).fill(0)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      mean[j] += diffs[i][j]
    }
  }
  for (let j = 0; j < d; j++) {
    mean[j] /= n
  }

  // Center the difference vectors
  const centered = diffs.map(v => v.map((val, i) => val - mean[i]))

  // Handle small sample sizes
  if (n === 1) {
    let pc1 = diffs[0].slice()
    let norm = Math.sqrt(pc1.reduce((s, x) => s + x * x, 0))
    if (norm > 0) pc1 = pc1.map(x => x / norm)

    // Find orthogonal vectors
    let pc2 = new Array(d).fill(0)
    pc2[0] = 1
    let dot = pc1.reduce((s, x, i) => s + x * pc2[i], 0)
    pc2 = pc2.map((x, i) => x - dot * pc1[i])
    norm = Math.sqrt(pc2.reduce((s, x) => s + x * x, 0))
    if (norm > 0) pc2 = pc2.map(x => x / norm)

    let pc3 = new Array(d).fill(0)
    pc3[1] = 1
    dot = pc1.reduce((s, x, i) => s + x * pc3[i], 0)
    pc3 = pc3.map((x, i) => x - dot * pc1[i])
    dot = pc2.reduce((s, x, i) => s + x * pc3[i], 0)
    pc3 = pc3.map((x, i) => x - dot * pc2[i])
    norm = Math.sqrt(pc3.reduce((s, x) => s + x * x, 0))
    if (norm > 0) pc3 = pc3.map(x => x / norm)

    return { pc1, pc2, pc3 }
  }

  // Compute covariance matrix
  const cov: number[][] = Array(d).fill(0).map(() => Array(d).fill(0))
  for (let i = 0; i < d; i++) {
    for (let j = i; j < d; j++) {
      let sum = 0
      for (let k = 0; k < n; k++) {
        sum += centered[k][i] * centered[k][j]
      }
      cov[i][j] = sum / n
      if (i !== j) cov[j][i] = cov[i][j]
    }
  }

  // Power iteration helper
  const powerIteration = (matrix: number[][], orthogonalTo: number[][] = []) => {
    let v = new Array(d).fill(0).map((_, i) => Math.sin(i * 0.1 + orthogonalTo.length) + 0.5)
    let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
    v = v.map(x => x / norm)

    for (let iter = 0; iter < 30; iter++) {
      const newV = new Array(d).fill(0)
      for (let i = 0; i < d; i++) {
        for (let j = 0; j < d; j++) {
          newV[i] += matrix[i][j] * v[j]
        }
      }
      // Gram-Schmidt against all orthogonal vectors
      for (const ortho of orthogonalTo) {
        const dot = newV.reduce((s, x, i) => s + x * ortho[i], 0)
        for (let i = 0; i < d; i++) {
          newV[i] -= dot * ortho[i]
        }
      }
      norm = Math.sqrt(newV.reduce((s, x) => s + x * x, 0))
      if (norm > 1e-10) {
        v = newV.map(x => x / norm)
      }
    }
    return v
  }

  // Deflate matrix
  const deflate = (matrix: number[][], eigenvector: number[]): number[][] => {
    const lambda = eigenvector.reduce((s, x, i) => {
      let sum = 0
      for (let j = 0; j < d; j++) {
        sum += matrix[i][j] * eigenvector[j]
      }
      return s + x * sum
    }, 0)

    const newMatrix: number[][] = Array(d).fill(0).map(() => Array(d).fill(0))
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        newMatrix[i][j] = matrix[i][j] - lambda * eigenvector[i] * eigenvector[j]
      }
    }
    return newMatrix
  }

  // Find 3 principal components
  const pc1 = powerIteration(cov)
  const cov2 = deflate(cov, pc1)
  const pc2 = powerIteration(cov2, [pc1])
  const cov3 = deflate(cov2, pc2)
  const pc3 = powerIteration(cov3, [pc1, pc2])

  return { pc1, pc2, pc3 }
}

function projectDifference3D(
  vector: number[],
  targetVector: number[],
  pc1: number[],
  pc2: number[],
  pc3: number[]
): { x: number; y: number; z: number } {
  let x = 0, y = 0, z = 0
  for (let i = 0; i < vector.length; i++) {
    const diff = vector[i] - targetVector[i]
    x += diff * pc1[i]
    y += diff * pc2[i]
    z += diff * pc3[i]
  }
  return { x, y, z }
}

// 3D rotation and projection
function rotatePoint(
  x: number, y: number, z: number,
  rotX: number, rotY: number
): { x: number; y: number; z: number } {
  // Rotate around Y axis
  const cosY = Math.cos(rotY)
  const sinY = Math.sin(rotY)
  const x1 = x * cosY - z * sinY
  const z1 = x * sinY + z * cosY

  // Rotate around X axis
  const cosX = Math.cos(rotX)
  const sinX = Math.sin(rotX)
  const y2 = y * cosX - z1 * sinX
  const z2 = y * sinX + z1 * cosX

  return { x: x1, y: y2, z: z2 }
}

// Get color based on rank
function getRankColor(rank: number, isTarget: boolean): string {
  if (isTarget) return '#22c55e'
  if (rank <= 10) return '#22c55e'
  if (rank <= 100) return '#84cc16'
  if (rank <= 1000) return '#eab308'
  if (rank <= 5000) return '#f97316'
  return '#ef4444'
}

// Compute cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Compute midpoint of two vectors
function vectorMidpoint(a: number[], b: number[]): number[] {
  return a.map((val, i) => (val + b[i]) / 2)
}

export function BullseyeVisualization({
  guesses,
  rankings,
  targetWord,
  totalWords,
  wordVectors
}: BullseyeVisualizationProps) {
  void rankings

  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [showHints, setShowHints] = useState(true)
  const [is3D, setIs3D] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 })
  const [rotation, setRotation] = useState({ x: 0.3, y: 0 }) // Initial tilt
  const [autoRotate, setAutoRotate] = useState(true)
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const animationRef = useRef<number | null>(null)
  const previousPointsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  // Build word index
  const wordIndex = useMemo(() => {
    const idx = new Map<string, number>()
    wordVectors.words.forEach((w, i) => idx.set(w, i))
    return idx
  }, [wordVectors.words])

  // Get target vector
  const targetVector = useMemo(() => {
    const idx = wordIndex.get(targetWord)
    return idx !== undefined ? wordVectors.vectors[idx] : null
  }, [wordIndex, targetWord, wordVectors.vectors])

  // Log scale for rank -> radius
  const logScale = useCallback((rank: number, maxRadius: number) => {
    const logRank = Math.log10(Math.max(1, rank))
    const logMax = Math.log10(totalWords)
    return (logRank / logMax) * maxRadius
  }, [totalWords])

  // Compute "hot pairs" - pairs of guesses where midpoint is closer to target
  // This hints that the answer might be a "combination" of those concepts
  const hotPairs = useMemo(() => {
    if (!targetVector || guesses.length < 2) return []

    const pairs: { word1: string; word2: string; improvement: number }[] = []

    // Get vectors for all guesses
    const guessData: { word: string; vector: number[]; similarity: number }[] = []
    for (const guess of guesses) {
      if (guess.word === targetWord) continue
      const idx = wordIndex.get(guess.word)
      if (idx !== undefined) {
        guessData.push({
          word: guess.word,
          vector: wordVectors.vectors[idx],
          similarity: guess.similarity
        })
      }
    }

    // Check all pairs
    for (let i = 0; i < guessData.length; i++) {
      for (let j = i + 1; j < guessData.length; j++) {
        const a = guessData[i]
        const b = guessData[j]

        // Compute midpoint
        const midpoint = vectorMidpoint(a.vector, b.vector)
        const midSimilarity = cosineSimilarity(midpoint, targetVector)

        // Check if midpoint is better than both guesses
        const minSimilarity = Math.min(a.similarity, b.similarity)
        const maxSimilarity = Math.max(a.similarity, b.similarity)

        // If midpoint is closer than the better of the two guesses
        // Threshold of 0.01 catches meaningful combinations
        if (midSimilarity > maxSimilarity + 0.01) {
          pairs.push({
            word1: a.word,
            word2: b.word,
            improvement: midSimilarity - maxSimilarity
          })
        }
      }
    }

    // Sort by improvement and take top pairs
    return pairs.sort((a, b) => b.improvement - a.improvement).slice(0, 5)
  }, [guesses, targetVector, targetWord, wordIndex, wordVectors.vectors])

  // Compute 3D plot points
  const plotPoints = useMemo((): PlotPoint[] => {
    if (!targetVector) {
      return [{
        word: targetWord,
        rank: 1,
        similarity: 1,
        x3d: 0,
        y3d: 0,
        z3d: 0,
        isGuessed: false,
        isTarget: true
      }]
    }

    const points: PlotPoint[] = [{
      word: targetWord,
      rank: 1,
      similarity: 1,
      x3d: 0,
      y3d: 0,
      z3d: 0,
      isGuessed: guesses.some(g => g.word === targetWord),
      isTarget: true
    }]

    if (guesses.length === 0) {
      return points
    }

    const guessVectors: number[][] = []
    const validGuesses: GuessResult[] = []

    for (const guess of guesses) {
      if (guess.word === targetWord) continue
      const idx = wordIndex.get(guess.word)
      if (idx !== undefined) {
        guessVectors.push(wordVectors.vectors[idx])
        validGuesses.push(guess)
      }
    }

    if (guessVectors.length === 0) {
      return points
    }

    // Compute 3D PCA
    const { pc1, pc2, pc3 } = computeDifferencePCA3D(targetVector, guessVectors)
    const projections = guessVectors.map(v => projectDifference3D(v, targetVector, pc1, pc2, pc3))

    // Get the direction in 3D space, but use log(rank) for radius
    validGuesses.forEach((guess, i) => {
      const proj = projections[i]
      // Normalize to get direction
      const projDist = Math.sqrt(proj.x * proj.x + proj.y * proj.y + proj.z * proj.z)
      const dirX = projDist > 0 ? proj.x / projDist : 1
      const dirY = projDist > 0 ? proj.y / projDist : 0
      const dirZ = projDist > 0 ? proj.z / projDist : 0

      // Use log(rank) for distance from center (normalized to 1)
      const normalizedRadius = logScale(guess.rank, 1)

      points.push({
        word: guess.word,
        rank: guess.rank,
        similarity: guess.similarity,
        x3d: dirX * normalizedRadius,
        y3d: dirY * normalizedRadius,
        z3d: dirZ * normalizedRadius,
        isGuessed: true,
        isTarget: false
      })
    })

    return points
  }, [guesses, targetWord, targetVector, wordIndex, wordVectors.vectors, logScale])

  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        const size = Math.min(width, 600)
        setDimensions({ width: size, height: size })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Auto-rotation effect
  useEffect(() => {
    if (!is3D || !autoRotate) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      return
    }

    let lastTime = performance.now()
    const animate = (time: number) => {
      const delta = time - lastTime
      lastTime = time

      // Rotate slowly with gentle wobble
      setRotation(prev => ({
        x: 0.3 + Math.sin(time * 0.0002) * 0.15, // Gentle wobble
        y: prev.y + delta * 0.0004
      }))

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [is3D, autoRotate])

  // Mouse handlers for 3D rotation
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!is3D) return
    isDragging.current = true
    setAutoRotate(false) // Stop auto-rotation when user drags
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }, [is3D])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !is3D) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }

    setRotation(prev => ({
      x: prev.x + dy * 0.01,
      y: prev.y + dx * 0.01
    }))
  }, [is3D])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false
  }, [])

  // Compute screen positions for points
  const screenPoints = useMemo(() => {
    const maxRadius = Math.min(dimensions.width, dimensions.height) / 2 - 50

    const points = plotPoints.map(p => {
      let screenX: number, screenY: number, screenZ: number

      if (is3D) {
        const rotated = rotatePoint(
          p.x3d * maxRadius,
          p.y3d * maxRadius,
          p.z3d * maxRadius,
          rotation.x,
          rotation.y
        )
        screenX = rotated.x
        screenY = rotated.y
        screenZ = rotated.z
      } else {
        const angle = Math.atan2(p.y3d, p.x3d)
        const radius = logScale(p.rank, maxRadius)
        screenX = p.isTarget ? 0 : Math.cos(angle) * radius
        screenY = p.isTarget ? 0 : Math.sin(angle) * radius
        screenZ = 0
      }

      return { ...p, screenX, screenY, screenZ }
    })

    // Sort by Z for proper depth ordering in 3D
    if (is3D) {
      points.sort((a, b) => a.screenZ - b.screenZ)
    }

    return points
  }, [plotPoints, dimensions, is3D, rotation, logScale])

  // D3 rendering - background elements
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    const { width, height } = dimensions
    const centerX = width / 2
    const centerY = height / 2
    const maxRadius = Math.min(width, height) / 2 - 50

    // Clear and set up
    svg.selectAll('*').remove()

    // Add defs for filters
    const defs = svg.append('defs')

    const glowFilter = defs.append('filter')
      .attr('id', 'pointGlow')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%')
    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur')
    const feMerge = glowFilter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    const g = svg.append('g')
      .attr('class', 'main')
      .attr('transform', `translate(${centerX}, ${centerY})`)

    // Rank thresholds
    const rankThresholds = [
      { rank: 10, color: '#22c55e', label: 'Top 10' },
      { rank: 100, color: '#84cc16', label: 'Top 100' },
      { rank: 1000, color: '#eab308', label: 'Top 1,000' },
      { rank: 5000, color: '#f97316', label: 'Top 5,000' },
      { rank: totalWords, color: '#ef4444', label: '' }
    ]

    // Background group
    const bgGroup = g.append('g').attr('class', 'background')

    if (is3D) {
      // 3D mode: draw wireframe spheres with great circles
      const sphereRadii = rankThresholds.slice(0, -1).map(t => logScale(t.rank, maxRadius))

      const drawGreatCircle = (
        radius: number, color: string,
        normalX: number, normalY: number, normalZ: number,
        opacity: number
      ) => {
        const points: { x: number; y: number; z: number }[] = []
        const segments = 64

        let ux = -normalY, uy = normalX, uz = 0
        const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz)
        if (uLen < 0.001) { ux = 1; uy = 0; uz = 0 }
        else { ux /= uLen; uy /= uLen; uz /= uLen }

        const vx = normalY * uz - normalZ * uy
        const vy = normalZ * ux - normalX * uz
        const vz = normalX * uy - normalY * ux

        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2
          points.push({
            x: radius * (Math.cos(theta) * ux + Math.sin(theta) * vx),
            y: radius * (Math.cos(theta) * uy + Math.sin(theta) * vy),
            z: radius * (Math.cos(theta) * uz + Math.sin(theta) * vz)
          })
        }

        const projected = points.map(p => rotatePoint(p.x, p.y, p.z, rotation.x, rotation.y))
        const pathData = projected.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

        bgGroup.append('path')
          .attr('d', pathData)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', 1.5)
          .attr('opacity', opacity)
      }

      sphereRadii.forEach((radius, idx) => {
        const color = rankThresholds[idx].color
        drawGreatCircle(radius, color, 0, 1, 0, 0.4)
        drawGreatCircle(radius, color, 1, 0, 0, 0.25)
        drawGreatCircle(radius, color, 0, 0, 1, 0.25)
        drawGreatCircle(radius, color, 0.7, 0.7, 0, 0.15)
      })

      bgGroup.append('circle')
        .attr('r', maxRadius)
        .attr('fill', 'none')
        .attr('stroke', '#374151')
        .attr('stroke-width', 1)
        .attr('opacity', 0.5)

    } else {
      // 2D mode: draw bullseye rings
      const logMax = Math.log10(totalWords)
      const logScaleLocal = (rank: number) => (Math.log10(Math.max(1, rank)) / logMax) * maxRadius

      for (let i = rankThresholds.length - 1; i >= 0; i--) {
        const threshold = rankThresholds[i]
        bgGroup.append('circle')
          .attr('r', logScaleLocal(threshold.rank))
          .attr('fill', threshold.color)
          .attr('opacity', 0.15)
      }

      rankThresholds.forEach((threshold, i) => {
        if (i === rankThresholds.length - 1) return
        const radius = logScaleLocal(threshold.rank)
        bgGroup.append('circle')
          .attr('r', radius)
          .attr('fill', 'none')
          .attr('stroke', threshold.color)
          .attr('stroke-width', 2)
          .attr('opacity', 0.6)

        if (threshold.label) {
          bgGroup.append('text')
            .attr('x', radius + 4)
            .attr('y', -4)
            .attr('fill', threshold.color)
            .attr('font-size', '10px')
            .attr('opacity', 0.8)
            .text(threshold.label)
        }
      })

      bgGroup.append('circle')
        .attr('r', maxRadius)
        .attr('fill', 'none')
        .attr('stroke', '#374151')
        .attr('stroke-width', 2)
    }

    // Hint arcs group (for "combination" hints)
    g.append('g').attr('class', 'hint-arcs')
    // Depth lines group (3D only)
    g.append('g').attr('class', 'depth-lines')
    // Points group
    g.append('g').attr('class', 'points')

  }, [dimensions, is3D, rotation, totalWords, logScale])

  // D3 rendering - points with transitions
  useEffect(() => {
    if (!svgRef.current || screenPoints.length === 0) return

    const svg = d3.select(svgRef.current)
    const g = svg.select<SVGGElement>('g.main')
    if (g.empty()) return

    const maxRadius = Math.min(dimensions.width, dimensions.height) / 2 - 50

    // Update hint arcs - show connections between guesses whose midpoint is closer to target
    const hintsGroup = g.select<SVGGElement>('g.hint-arcs')
    hintsGroup.selectAll('*').remove()

    if (showHints && hotPairs.length > 0 && !is3D) {
      // Create a map from word to screen position
      const posMap = new Map<string, { x: number; y: number }>()
      screenPoints.forEach(p => posMap.set(p.word, { x: p.screenX, y: p.screenY }))

      hotPairs.forEach((pair, idx) => {
        const pos1 = posMap.get(pair.word1)
        const pos2 = posMap.get(pair.word2)
        if (!pos1 || !pos2) return

        // Draw a curved arc between the two points
        // The arc curves toward the center (target)
        const midX = (pos1.x + pos2.x) / 2
        const midY = (pos1.y + pos2.y) / 2

        // Control point: pull toward center based on improvement
        const pullFactor = 0.5 + pair.improvement * 5
        const ctrlX = midX * (1 - pullFactor)
        const ctrlY = midY * (1 - pullFactor)

        const pathData = `M ${pos1.x} ${pos1.y} Q ${ctrlX} ${ctrlY} ${pos2.x} ${pos2.y}`

        // Glow effect
        hintsGroup.append('path')
          .attr('d', pathData)
          .attr('fill', 'none')
          .attr('stroke', '#fbbf24')
          .attr('stroke-width', 8)
          .attr('opacity', 0.15 - idx * 0.02)
          .attr('filter', 'url(#pointGlow)')

        // Main arc
        hintsGroup.append('path')
          .attr('d', pathData)
          .attr('fill', 'none')
          .attr('stroke', '#fbbf24')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '6,4')
          .attr('opacity', 0.6 - idx * 0.1)

        // Arrow pointing toward center at the midpoint
        const arrowSize = 6
        const midDist = Math.sqrt(midX * midX + midY * midY)
        if (midDist > 10) {
          const arrowX = midX * 0.7  // Point along the arc
          const arrowY = midY * 0.7
          const dirX = -midX / midDist
          const dirY = -midY / midDist
          // Perpendicular
          const perpX = -dirY
          const perpY = dirX

          hintsGroup.append('polygon')
            .attr('points', `
              ${arrowX + dirX * arrowSize},${arrowY + dirY * arrowSize}
              ${arrowX + perpX * arrowSize * 0.5},${arrowY + perpY * arrowSize * 0.5}
              ${arrowX - perpX * arrowSize * 0.5},${arrowY - perpY * arrowSize * 0.5}
            `)
            .attr('fill', '#fbbf24')
            .attr('opacity', 0.7 - idx * 0.1)
        }
      })
    }

    // Update depth lines in 3D mode
    const linesGroup = g.select<SVGGElement>('g.depth-lines')
    linesGroup.selectAll('*').remove()

    if (is3D) {
      screenPoints.forEach(p => {
        if (p.isTarget) return
        const depthScale = 0.7 + 0.3 * ((p.screenZ + maxRadius) / (2 * maxRadius))
        linesGroup.append('line')
          .attr('x1', 0).attr('y1', 0)
          .attr('x2', p.screenX).attr('y2', p.screenY)
          .attr('stroke', getRankColor(p.rank, false))
          .attr('stroke-width', 1)
          .attr('opacity', 0.15 * depthScale)
      })
    }

    // Points with data join
    const pointsGroup = g.select<SVGGElement>('g.points')

    interface ScreenPoint {
      word: string
      rank: number
      similarity: number
      x3d: number
      y3d: number
      z3d: number
      isGuessed: boolean
      isTarget: boolean
      screenX: number
      screenY: number
      screenZ: number
    }

    const pointSelection = pointsGroup
      .selectAll<SVGGElement, ScreenPoint>('g.point')
      .data(screenPoints, d => d.word)

    // Remove old points
    pointSelection.exit()
      .transition()
      .duration(500)
      .style('opacity', 0)
      .remove()

    // Add new points
    const enterPoints = pointSelection.enter()
      .append('g')
      .attr('class', 'point')
      .attr('transform', d => {
        // Start from previous position or center
        const prev = previousPointsRef.current.get(d.word)
        return `translate(${prev?.x ?? 0}, ${prev?.y ?? 0})`
      })
      .style('opacity', 0)

    // Create point structure for new points
    enterPoints.each(function(d) {
      const pointG = d3.select(this)
      const depthScale = is3D ? 0.7 + 0.3 * ((d.screenZ + maxRadius) / (2 * maxRadius)) : 1
      const baseRadius = d.isTarget ? 14 : 7
      const pointRadius = baseRadius * depthScale
      const color = getRankColor(d.rank, d.isTarget)

      if (is3D) {
        pointG.append('circle')
          .attr('class', 'glow')
          .attr('r', pointRadius * 1.5)
          .attr('fill', color)
          .attr('opacity', 0.3 * depthScale)
          .attr('filter', 'url(#pointGlow)')
      }

      pointG.append('circle')
        .attr('class', 'main')
        .attr('r', pointRadius)
        .attr('fill', color)
        .attr('stroke', 'white')
        .attr('stroke-width', d.isTarget ? 3 : 1.5)

      pointG.append('text')
        .attr('class', 'shadow')
        .attr('x', pointRadius + 6)
        .attr('y', 1)
        .attr('dominant-baseline', 'central')
        .attr('fill', 'black')
        .attr('font-size', `${12 * depthScale}px`)
        .attr('font-weight', d.isTarget ? 'bold' : 'normal')

      pointG.append('text')
        .attr('class', 'label')
        .attr('x', pointRadius + 5)
        .attr('y', 0)
        .attr('dominant-baseline', 'central')
        .attr('fill', 'white')
        .attr('font-size', `${12 * depthScale}px`)
        .attr('font-weight', d.isTarget ? 'bold' : 'normal')
    })

    // Merge and update all points
    const allPoints = enterPoints.merge(pointSelection)

    // Determine transition duration - fast for 3D rotation, slower for new guesses
    const duration = is3D && autoRotate ? 50 : 600

    allPoints
      .transition()
      .duration(duration)
      .ease(d3.easeCubicOut)
      .attr('transform', d => `translate(${d.screenX}, ${d.screenY})`)
      .style('opacity', 1)

    // Update point appearance
    allPoints.each(function(d) {
      const pointG = d3.select(this)
      const depthScale = is3D ? 0.7 + 0.3 * ((d.screenZ + maxRadius) / (2 * maxRadius)) : 1
      const baseRadius = d.isTarget ? 14 : 7
      const pointRadius = baseRadius * depthScale
      const color = getRankColor(d.rank, d.isTarget)
      const labelText = (d.isTarget && !d.isGuessed) ? '???' : d.word

      pointG.select('circle.glow')
        .attr('r', pointRadius * 1.5)
        .attr('fill', color)
        .attr('opacity', is3D ? 0.3 * depthScale : 0)

      pointG.select('circle.main')
        .attr('r', pointRadius)
        .attr('fill', color)
        .attr('opacity', is3D ? 0.7 + 0.3 * depthScale : 1)

      pointG.select('text.shadow')
        .attr('x', pointRadius + 6)
        .attr('font-size', `${12 * depthScale}px`)
        .attr('opacity', is3D && showLabels ? 0.5 * depthScale : 0)
        .text(labelText)

      pointG.select('text.label')
        .attr('x', pointRadius + 5)
        .attr('font-size', `${12 * depthScale}px`)
        .attr('opacity', showLabels ? (is3D ? 0.6 + 0.4 * depthScale : 1) : 0)
        .text(labelText)
    })

    // Hover effects
    allPoints
      .on('mouseenter', function(_, d) {
        const depthScale = is3D ? 0.7 + 0.3 * ((d.screenZ + maxRadius) / (2 * maxRadius)) : 1
        const baseRadius = d.isTarget ? 14 : 7
        const pointRadius = baseRadius * depthScale

        d3.select(this).select('circle.main')
          .transition().duration(150)
          .attr('r', pointRadius * 1.4)
        d3.select(this).select('circle.glow')
          .transition().duration(150)
          .attr('r', pointRadius * 2)
      })
      .on('mouseleave', function(_, d) {
        const depthScale = is3D ? 0.7 + 0.3 * ((d.screenZ + maxRadius) / (2 * maxRadius)) : 1
        const baseRadius = d.isTarget ? 14 : 7
        const pointRadius = baseRadius * depthScale

        d3.select(this).select('circle.main')
          .transition().duration(150)
          .attr('r', pointRadius)
        d3.select(this).select('circle.glow')
          .transition().duration(150)
          .attr('r', pointRadius * 1.5)
      })

    // Save positions for next render
    const newPositions = new Map<string, { x: number; y: number }>()
    screenPoints.forEach(p => newPositions.set(p.word, { x: p.screenX, y: p.screenY }))
    previousPointsRef.current = newPositions

  }, [screenPoints, dimensions, showLabels, showHints, hotPairs, is3D, autoRotate])

  return (
    <div className="w-full" ref={containerRef}>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {is3D ? '3D Semantic Space' : 'Bullseye'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {is3D
              ? 'Drag to rotate • Distance = log(rank) • Position = semantic direction'
              : 'Target at center • Distance = log(rank) • Angle = semantic direction'
            }
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setIs3D(!is3D)
              if (!is3D) setAutoRotate(true) // Start auto-rotate when entering 3D
            }}
            className={`
              px-3 py-1 rounded-md text-sm font-medium transition-colors
              ${is3D
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }
            `}
          >
            {is3D ? '3D' : '2D'}
          </button>
          {is3D && (
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`
                px-3 py-1 rounded-md text-sm font-medium transition-colors
                ${autoRotate
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }
              `}
            >
              {autoRotate ? '⏸' : '▶'}
            </button>
          )}
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`
              px-3 py-1 rounded-md text-sm font-medium transition-colors
              ${showLabels
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }
            `}
          >
            Labels
          </button>
          <button
            onClick={() => setShowHints(!showHints)}
            className={`
              px-3 py-1 rounded-md text-sm font-medium transition-colors
              ${showHints
                ? 'bg-amber-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }
            `}
            title="Show arcs between guesses whose combination might be closer to target"
          >
            Hints
          </button>
        </div>
      </div>

      <div
        className="bg-gray-900 rounded-lg p-4 flex items-center justify-center"
        style={{ cursor: is3D ? 'grab' : 'default' }}
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="overflow-visible"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: is3D ? (isDragging.current ? 'grabbing' : 'grab') : 'default' }}
        />
      </div>

      <div className="mt-3 text-center text-xs text-gray-500">
        {is3D
          ? 'Click and drag to rotate. Closer to center = higher rank.'
          : 'Closer to center = higher rank (more similar). Angle shows semantic relationship.'
        }
      </div>
    </div>
  )
}
