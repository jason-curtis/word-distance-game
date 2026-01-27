import { useState, useRef, useEffect } from 'react'

interface GuessInputProps {
  onGuess: (word: string) => { success: boolean; error?: string }
  disabled?: boolean
  onCheatCode?: () => void
}

export function GuessInput({ onGuess, disabled = false, onCheatCode }: GuessInputProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressStartTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  // Long-press detection for cheat code (3 seconds)
  const handleTouchStart = () => {
    longPressStartTimeRef.current = Date.now()
    longPressTimerRef.current = window.setTimeout(() => {
      if (onCheatCode) {
        // Trigger haptic feedback if available
        if ('vibrate' in navigator) {
          navigator.vibrate(100)
        }
        onCheatCode()
      }
      longPressTimerRef.current = null
    }, 3000)
  }

  const handleTouchEnd = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  // Also support mouse for desktop testing
  const handleMouseDown = () => {
    handleTouchStart()
  }

  const handleMouseUp = () => {
    handleTouchEnd()
  }

  const handleMouseLeave = () => {
    handleTouchEnd()
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim()) return

    const result = onGuess(input.trim())

    if (result.success) {
      setInput('')
      setError(null)
    } else {
      setError(result.error || 'Invalid guess')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto mb-6">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError(null)
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          disabled={disabled}
          placeholder={disabled ? "You won!" : "Enter a word..."}
          className={`
            w-full px-4 py-3 text-lg
            bg-gray-800 border-2 rounded-lg
            text-white placeholder-gray-500
            focus:outline-none focus:border-blue-500
            transition-all duration-200
            ${error ? 'border-red-500' : 'border-gray-600'}
            ${shake ? 'animate-shake' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className={`
            absolute right-2 top-1/2 -translate-y-1/2
            px-4 py-1.5 rounded-md
            font-semibold text-sm
            transition-all duration-200
            ${disabled || !input.trim()
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }
          `}
        >
          Guess
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-400 text-center animate-bounce-in">
          {error}
        </p>
      )}
    </form>
  )
}
