import { useEffect, useRef, useState } from 'react'
import { lerp, clamp } from '../lib/rng.js'

const GAP_CALM = 90000 // a nearly-clean sky rains rarely
const GAP_HEAVY = 8000 // a sky full of duplicates rains often
const SHOWER_SHORT = 3000
const SHOWER_LONG = 12000
export const MAX_DROPS = 40
const FIRST_SHOWER_MS = 2600

const gapFor = (i) => lerp(GAP_CALM, GAP_HEAVY, clamp(i, 0, 1))
const durationFor = (i) => lerp(SHOWER_SHORT, SHOWER_LONG, clamp(i, 0, 1))
const dropsFor = (i) => Math.max(10, Math.round(lerp(8, MAX_DROPS, clamp(i, 0, 1))))

/**
 * Occasional rain, driven by how much of the sky is near-duplicate data.
 *
 * One timer handle, always cleared before it is set again: a second scheduler
 * chain forking off a state change is the classic way a kiosk ends up raining
 * forever by Wednesday.
 */
export function useRain(intensity, { enabled = true } = {}) {
  const [shower, setShower] = useState({ raining: false, drops: 0 })
  const timer = useRef(null)
  const intensityRef = useRef(intensity)
  // Tracks whether a shower has actually happened, not whether the effect has run
  // before: StrictMode mounts effects twice, which would otherwise burn the
  // opening shower and leave the first visitor waiting a minute for rain.
  const hasRained = useRef(false)
  intensityRef.current = intensity

  const active = enabled && intensity > 0

  useEffect(() => {
    if (!active) {
      clearTimeout(timer.current)
      timer.current = null
      setShower((s) => (s.raining ? { raining: false, drops: 0 } : s))
      return undefined
    }

    let cancelled = false

    const stopThenWait = () => {
      if (cancelled) return
      setShower((s) => ({ ...s, raining: false }))
      clearTimeout(timer.current)
      timer.current = setTimeout(startShower, gapFor(intensityRef.current))
    }

    function startShower() {
      if (cancelled) return
      try {
        const i = clamp(intensityRef.current, 0, 1)
        if (i <= 0) {
          setShower({ raining: false, drops: 0 })
          return
        }
        hasRained.current = true
        setShower({ raining: true, drops: dropsFor(i) })
        clearTimeout(timer.current)
        timer.current = setTimeout(stopThenWait, durationFor(i))
      } catch {
        // Never let a bad tick freeze the sky for the rest of the week.
        setShower({ raining: false, drops: 0 })
      }
    }

    // A visitor gives this thirty seconds. If the sky is heavy they need to see
    // the problem state early, or the clean-up has nothing to pay off against.
    const heavy = intensityRef.current > 0.35
    const firstDelay =
      !hasRained.current && heavy ? FIRST_SHOWER_MS : gapFor(intensityRef.current)

    clearTimeout(timer.current)
    timer.current = setTimeout(startShower, firstDelay)

    return () => {
      cancelled = true
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [active])

  return shower
}
