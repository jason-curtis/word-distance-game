/// <reference types="vite/client" />

declare module 'canvas-confetti' {
  interface ConfettiOptions {
    particleCount?: number
    spread?: number
    startVelocity?: number
    decay?: number
    gravity?: number
    drift?: number
    flat?: boolean
    ticks?: number
    origin?: { x?: number; y?: number }
    colors?: string[]
    shapes?: ('square' | 'circle')[]
    zIndex?: number
    disableForReducedMotion?: boolean
    scalar?: number
    angle?: number
  }

  interface ConfettiCannon {
    (options?: ConfettiOptions): Promise<null>
    reset: () => void
  }

  const confetti: ConfettiCannon
  export default confetti
}
