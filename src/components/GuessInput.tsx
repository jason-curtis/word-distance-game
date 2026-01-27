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
  const cheatProgressRef = useRef(0) // Tracks progress: 0-5 for typing "cheat", 6-10 for backspacing

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  // Track cheat code pattern: type "cheat" then backspace 5 times
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const cheatSequence = 'cheat'

    if (e.key === 'Backspace') {
      // If we've typed "cheat" completely (progress = 5), start counting backspaces
      if (cheatProgressRef.current === 5) {
        cheatProgressRef.current = 6
      } else if (cheatProgressRef.current >= 6 && cheatProgressRef.current < 10) {
        cheatProgressRef.current++

        // If we've backspaced all 5 characters
        if (cheatProgressRef.current === 10 && input.length === 1) {
          // Trigger cheat code!
          if (onCheatCode) {
            onCheatCode()
          }
          cheatProgressRef.current = 0
        }
      } else {
        // Reset if backspacing at wrong time
        cheatProgressRef.current = 0
      }
    } else if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
      // Track typing "cheat"
      const expectedChar = cheatSequence[cheatProgressRef.current]
      if (e.key.toLowerCase() === expectedChar) {
        cheatProgressRef.current++
        if (cheatProgressRef.current > 5) {
          cheatProgressRef.current = 0 // Went past "cheat"
        }
      } else {
        // Wrong character, reset
        cheatProgressRef.current = e.key.toLowerCase() === cheatSequence[0] ? 1 : 0
      }
    }
  }

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
          onKeyDown={handleKeyDown}
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
