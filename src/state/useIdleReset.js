import { useEffect, useRef } from 'react'

export const IDLE_MS = 60000

/**
 * The exhibition safety net.
 *
 * Visitors walk away mid-interaction constantly. Without this, the first person
 * cleans the sky, leaves, and everyone after them meets a calm screen with no
 * problem in it — the provocation simply doesn't exist for them. The Reset button
 * only helps people who already understood the piece.
 */
export function useIdleReset(armed, onIdle, delay = IDLE_MS) {
  const timer = useRef(null)
  const callback = useRef(onIdle)
  callback.current = onIdle

  useEffect(() => {
    if (!armed) {
      clearTimeout(timer.current)
      timer.current = null
      return undefined
    }

    const bump = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => callback.current(), delay)
    }

    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel']
    events.forEach((name) => window.addEventListener(name, bump, { passive: true }))
    bump()

    return () => {
      events.forEach((name) => window.removeEventListener(name, bump))
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [armed, delay])
}
