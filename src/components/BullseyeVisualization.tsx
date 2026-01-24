import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import type { GuessResult } from '../types'

interface BullseyeVisualizationProps {
  guesses: GuessResult[]
  rankings: Map<string, { similarity: number; rank: number }>
  targetWord: string
  totalWords: number
}

interface PlotPoint {
  word: string
  rank: number
  similarity: number
  x: number
  y: number
  isGuessed: boolean
  isTarget: boolean
}

// Ring definitions: each ring contains words up to this rank
const RINGS = [
  { maxRank: 10, label: 'Top 10', color: '#22c55e' },
  { maxRank: 100, label: 'Top 100', color: '#84cc16' },
  { maxRank: 1000, label: 'Top 1K', color: '#eab308' },
  { maxRank: 5000, label: 'Top 5K', color: '#f97316' },
  { maxRank: 10000, label: 'Top 10K', color: '#ef4444' },
]

export function BullseyeVisualization({
  guesses,
  rankings,
  targetWord,
  totalWords
}: BullseyeVisualizationProps) {
  // Use rankings size for validation (rankings is available for future enhancements)
  void rankings
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [seed, setSeed] = useState(42)
  const [showLabels, setShowLabels] = useState(true)
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 })

  // Seeded random function for consistent but randomizable positions
  const seededRandom = useMemo(() => {
    let s = seed
    return () => {
      s = Math.sin(s * 9999) * 10000
      return s - Math.floor(s)
    }
  }, [seed])

  // Convert rank to radius (using log scale for better distribution)
  const rankToRadius = useMemo(() => {
    const maxRadius = Math.min(dimensions.width, dimensions.height) / 2 - 30
    const minRadius = 10

    return (rank: number) => {
      if (rank === 1) return 0 // Target at center
      // Use logarithmic scale for better distribution
      const logRank = Math.log10(rank)
      const logMax = Math.log10(totalWords)
      return minRadius + (logRank / logMax) * (maxRadius - minRadius)
    }
  }, [dimensions, totalWords])

  // Generate plot points for guessed words
  const plotPoints = useMemo(() => {
    const points: PlotPoint[] = []
    const guessedWords = new Set(guesses.map(g => g.word))

    // Add target word at center
    points.push({
      word: targetWord,
      rank: 1,
      similarity: 1,
      x: 0,
      y: 0,
      isGuessed: guessedWords.has(targetWord),
      isTarget: true
    })

    // Add guessed words
    const random = seededRandom
    guesses.forEach((guess) => {
      if (guess.word === targetWord) return

      const radius = rankToRadius(guess.rank)
      const angle = random() * Math.PI * 2

      points.push({
        word: guess.word,
        rank: guess.rank,
        similarity: guess.similarity,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        isGuessed: true,
        isTarget: false
      })
    })

    return points
  }, [guesses, targetWord, seededRandom, rankToRadius])

  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        const size = Math.min(width, 500)
        setDimensions({ width: size, height: size })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    const { width, height } = dimensions
    const centerX = width / 2
    const centerY = height / 2
    const maxRadius = Math.min(width, height) / 2 - 30

    svg.selectAll('*').remove()

    // Create main group centered
    const g = svg.append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`)

    // Draw rings
    RINGS.forEach((ring, i) => {
      const radius = rankToRadius(ring.maxRank)
      const prevRadius = i === 0 ? 0 : rankToRadius(RINGS[i - 1].maxRank)

      // Ring arc
      g.append('circle')
        .attr('r', radius)
        .attr('fill', 'none')
        .attr('stroke', ring.color)
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.3)
        .attr('stroke-dasharray', '4,4')

      // Ring fill
      g.append('circle')
        .attr('r', radius)
        .attr('fill', ring.color)
        .attr('fill-opacity', 0.05)

      // Label
      if (showLabels && radius > prevRadius + 30) {
        g.append('text')
          .attr('x', 0)
          .attr('y', -radius + 12)
          .attr('text-anchor', 'middle')
          .attr('fill', ring.color)
          .attr('font-size', '10px')
          .attr('opacity', 0.7)
          .text(ring.label)
      }
    })

    // Draw outer boundary
    g.append('circle')
      .attr('r', maxRadius)
      .attr('fill', 'none')
      .attr('stroke', '#4b5563')
      .attr('stroke-width', 2)

    // Draw crosshairs
    g.append('line')
      .attr('x1', -maxRadius)
      .attr('x2', maxRadius)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', '#374151')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,4')

    g.append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', -maxRadius)
      .attr('y2', maxRadius)
      .attr('stroke', '#374151')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,4')

    // Draw points
    const pointsGroup = g.append('g').attr('class', 'points')

    plotPoints.forEach((point) => {
      const pointG = pointsGroup.append('g')
        .attr('transform', `translate(${point.x}, ${point.y})`)
        .attr('class', 'point')
        .style('cursor', 'pointer')

      // Point circle
      const radius = point.isTarget ? 12 : 6
      const color = point.isTarget
        ? '#22c55e'
        : point.rank <= 10
          ? '#22c55e'
          : point.rank <= 100
            ? '#84cc16'
            : point.rank <= 1000
              ? '#eab308'
              : '#f97316'

      pointG.append('circle')
        .attr('r', radius)
        .attr('fill', color)
        .attr('stroke', 'white')
        .attr('stroke-width', point.isTarget ? 3 : 1)

      // Target icon
      if (point.isTarget && point.isGuessed) {
        pointG.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', '14px')
          .text('🎯')
      }

      // Label
      if (showLabels) {
        pointG.append('text')
          .attr('x', radius + 4)
          .attr('y', 0)
          .attr('dominant-baseline', 'central')
          .attr('fill', 'white')
          .attr('font-size', '11px')
          .attr('font-weight', point.isTarget ? 'bold' : 'normal')
          .text(point.isTarget && !point.isGuessed ? '???' : point.word)
      }

      // Tooltip on hover
      pointG.on('mouseenter', function () {
        d3.select(this).select('circle')
          .transition()
          .duration(150)
          .attr('r', radius * 1.5)
      })
      .on('mouseleave', function () {
        d3.select(this).select('circle')
          .transition()
          .duration(150)
          .attr('r', radius)
      })
    })

  }, [plotPoints, dimensions, showLabels, rankToRadius])

  return (
    <div className="w-full" ref={containerRef}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Similarity Map</h3>
        <div className="flex gap-2">
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
            onClick={() => setSeed(s => s + 1)}
            className="px-3 py-1 rounded-md text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            title="Randomize positions"
          >
            🔀 Shuffle
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-center">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="overflow-visible"
        />
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
        {RINGS.slice(0, 4).map((ring) => (
          <div key={ring.label} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: ring.color }}
            />
            <span className="text-gray-400">{ring.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
