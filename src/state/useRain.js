import { useEffect, useRef, useState } from 'react'
import { lerp, clamp } from '../lib/rng.js'

/** Below this many duplicate clouds it does not rain at all. Rain is a
 *  consequence you bring on yourself by hoarding, not weather that was always
 *  there — so crossing this line is the moment the piece makes its point. */
export const RAIN_THRESHOLD = 5

const GAP_LIGHT = 26000 // just over the line: an occasional downpour
const GAP_HEAVY = 9000 // well over it: barely a break
export const MAX_DROPS = 44

// One downpour, as a single gesture: it buckets down, the water rises, and then
// it all drains away.
export const POUR_MS = 1700
export const HOLD_MS = 900
export const DRAIN_MS = 1300
const FIRST_POUR_MS = 900

const over = (count) => clamp((count - RAIN_THRESHOLD + 1) / 4, 0.25, 1)

export function useRain(similarCount, { enabled = true } = {}) {
  const [shower, setShower] = useState({ raining: false, drops: 0, level: 0 })
  const timer = useRef(null)
  const countRef = useRef(similarCount)
  countRef.current = similarCount

  const active = enabled && similarCount >= RAIN_THRESHOLD

  useEffect(() => {
    if (!active) {
      clearTimeout(timer.current)
      timer.current = null
      setShower((s) => (s.raining || s.level ? { raining: false, drops: 0, level: 0 } : s))
      return undefined
    }

    let cancelled = false

    const drain = () => {
      if (cancelled) return
      // Stop the rain and let the water fall away.
      setShower({ raining: false, drops: 0, level: 0 })
      clearTimeout(timer.current)
      timer.current = setTimeout(
        pour,
        DRAIN_MS + lerp(GAP_LIGHT, GAP_HEAVY, over(countRef.current)),
      )
    }

    function pour() {
      if (cancelled) return
      try {
        const intensity = over(countRef.current)
        setShower({
          raining: true,
          drops: Math.round(lerp(24, MAX_DROPS, intensity)),
          // How deep the water gets. Enough to be unmissable, not so much that
          // the sky disappears behind it.
          level: lerp(0.34, 0.62, intensity),
        })
        clearTimeout(timer.current)
        timer.current = setTimeout(drain, POUR_MS + HOLD_MS)
      } catch {
        setShower({ raining: false, drops: 0, level: 0 })
      }
    }

    clearTimeout(timer.current)
    timer.current = setTimeout(pour, FIRST_POUR_MS)

    return () => {
      cancelled = true
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [active])

  return shower
}
