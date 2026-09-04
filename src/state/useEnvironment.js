import { useEffect, useState } from 'react'
import { clamp } from '../lib/rng.js'

/** Backgrounded tabs get their timers throttled to roughly one a minute on iOS.
 *  Pausing outright means a returning visitor doesn't walk into a burst of rain. */
export function usePageVisible() {
  const [visible, setVisible] = useState(() =>
    typeof document === 'undefined' ? true : !document.hidden,
  )
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return visible
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e) => setReduced(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** Keep the exhibition tablet awake. Unsupported or refused is fine — it's a nicety. */
export function useWakeLock(visible) {
  useEffect(() => {
    if (!visible || !('wakeLock' in navigator)) return undefined
    let lock = null
    let released = false
    navigator.wakeLock
      .request('screen')
      .then((l) => {
        if (released) l.release().catch(() => {})
        else lock = l
      })
      .catch(() => {})
    return () => {
      released = true
      if (lock) lock.release().catch(() => {})
    }
  }, [visible])
}

/**
 * How many clouds this sky can hold before it stops being readable.
 *
 * Generous on purpose. The opening sky is already 10 clouds, and a visitor needs
 * to be able to press "get more storage" enough times to watch the sky fill up —
 * that accumulation is the argument the piece is making. Clouds shrink as the
 * count rises (see Sky.jsx), so a full sky stays legible rather than becoming
 * a solid mass.
 */
export function useCloudCap(ref, onChange) {
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      if (!width || !height) return
      onChange({
        cap: clamp(Math.round(Math.sqrt(width * height) / 17), 18, 34),
        // Cloud x/size are percentages of panel width and y is a percentage of
        // panel height, so spacing maths needs this to compare the two axes.
        aspect: height / width,
      })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, onChange])
}
