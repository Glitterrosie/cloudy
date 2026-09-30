import { useCallback, useEffect, useRef, useState } from 'react'
import { lerp, clamp } from '../lib/rng.js'

export const MAX_DROPS = 44

// One downpour, as a single gesture: it buckets down, the water rises, and then
// it all drains away. The overlay reads these straight out of JS as custom
// properties, so the water can never be filling on a different clock from the
// one that decides when the shower ends.
export const POUR_MS = 2150
export const HOLD_MS = 1150
export const DRAIN_MS = 1650

/** How hard it rains, given how many duplicate clouds are overhead. This is the
 *  whole point of the button: press it with a heavy sky and you get a deluge,
 *  press it once you have cleaned up and barely anything happens. */
export const rainForce = (similarCount) => clamp(similarCount / 8, 0.15, 1)

/**
 * Rain on demand.
 *
 * Nothing schedules itself: a downpour happens when something asks for one, and
 * lasts exactly as long as the choreography above.
 */
export function useRain({ enabled = true } = {}) {
  const [shower, setShower] = useState({ raining: false, drops: 0, level: 0 })
  const timer = useRef(null)

  const stop = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
    setShower((s) => (s.raining || s.level ? { raining: false, drops: 0, level: 0 } : s))
  }, [])

  const pour = useCallback((force) => {
    const intensity = clamp(force, 0, 1)
    clearTimeout(timer.current)
    setShower({
      raining: true,
      drops: Math.round(lerp(20, MAX_DROPS, intensity)),
      // How deep the water gets. Enough to be unmissable, not so much that the
      // sky disappears behind it.
      level: lerp(0.22, 0.62, intensity),
    })
    timer.current = setTimeout(() => {
      setShower({ raining: false, drops: 0, level: 0 })
    }, POUR_MS + HOLD_MS)
  }, [])

  // Leaving the tab mid-downpour should not leave water hanging there.
  useEffect(() => {
    if (!enabled) stop()
  }, [enabled, stop])

  useEffect(() => () => clearTimeout(timer.current), [])

  return { ...shower, pour, stop }
}
