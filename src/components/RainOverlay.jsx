import { useMemo } from 'react'
import { mulberry32 } from '../lib/rng.js'
import { MAX_DROPS } from '../state/useRain.js'

/**
 * A fixed pool of drops, built once and never rebuilt.
 *
 * Mounting and unmounting drops per shower would be roughly 300,000 node
 * create/destroy cycles across an exhibition day. Instead a shower is a class
 * toggle: the overlay fades in, paused animations resume, and intensity decides
 * how many drops are visible. Zero allocation, zero JavaScript per frame.
 */
export function RainOverlay({ raining, drops }) {
  const pool = useMemo(() => {
    const rand = mulberry32(4242)
    return Array.from({ length: MAX_DROPS }, () => ({
      x: rand() * 100,
      duration: 0.85 + rand() * 0.75,
      delay: -rand() * 2,
      length: 9 + rand() * 15,
      opacity: 0.3 + rand() * 0.4,
      drift: rand() * 6 - 3,
    }))
  }, [])

  return (
    <div className={`rain ${raining ? 'is-on' : ''}`} aria-hidden="true">
      {pool.map((drop, i) => (
        <span
          key={i}
          className={`drop ${i < drops ? 'is-active' : ''}`}
          style={{
            left: `${drop.x}%`,
            '--fall': `${drop.duration}s`,
            '--delay': `${drop.delay}s`,
            '--len': `${drop.length}px`,
            '--o': drop.opacity,
            '--drift': `${drop.drift}px`,
          }}
        />
      ))}
    </div>
  )
}
