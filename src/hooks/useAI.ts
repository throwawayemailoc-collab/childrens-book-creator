import { useState, useCallback, useRef } from 'react'

interface UseAIReturn<T> {
  result: T | null;
  isLoading: boolean;
  error: string | null;
  run: (...args: Parameters<(...args: never[]) => Promise<T>>) => Promise<T | null>;
  cancel: () => void;
  reset: () => void;
}

export function useAI<T>(
  fn: (...args: never[]) => Promise<T>
): UseAIReturn<T> {
  const [result, setResult] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsLoading(false)
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
    setIsLoading(false)
  }, [])

  const run = useCallback(
    async (...args: Parameters<typeof fn>) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsLoading(true)
      setError(null)

      try {
        const value = await fn(...args)
        if (!controller.signal.aborted) {
          setResult(value)
          setIsLoading(false)
          return value
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const message = err instanceof Error ? err.message : 'An error occurred'
          setError(message)
          setIsLoading(false)
        }
      }
      return null
    },
    [fn]
  )

  return { result, isLoading, error, run, cancel, reset }
}
