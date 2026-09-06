import { useMemo } from 'react'
import { mulberry32 } from '../lib/rng.js'
import { MAX_DROPS } from '../state/useRain.js'

/**
 * A downpour, drawn like a comic: fat teardrops, and water that visibly fills up
 * the bottom of the sky before draining away again.
 *
 * The drops are a fixed pool built once and never rebuilt — a shower is a class
 * toggle, which resumes paused animations rather than mounting hundreds of nodes
 * every few seconds across an exhibition day.
 */
export function RainOverlay({ raining, drops, level }) {
  const pool = useMemo(() => {
    const rand = mulberry32(4242)
    return Array.from({ length: MAX_DROPS }, () => ({
      x: rand() * 100,
      duration: 0.5 + rand() * 0.35,
      delay: -rand() * 1.2,
      scale: 0.75 + rand() * 0.75,
      tilt: rand() * 10 - 5,
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
            '--scale': drop.scale,
            '--tilt': `${drop.tilt}deg`,
          }}
        />
      ))}

      {/* The water that gathers, then goes. */}
      <div className="flood" style={{ height: `${Math.round(level * 100)}%` }}>
        <svg className="flood__wave" viewBox="0 0 240 24" preserveAspectRatio="none">
          <path d="M0 12 Q 15 1 30 12 T 60 12 T 90 12 T 120 12 T 150 12 T 180 12 T 210 12 T 240 12 V24 H0 Z" />
        </svg>
        <span className="flood__body" />
      </div>
    </div>
  )
}
