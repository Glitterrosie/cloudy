import { useMemo } from 'react'
import { mulberry32 } from '../lib/rng.js'
import { MAX_DROPS, POUR_MS, DRAIN_MS } from '../state/useRain.js'

/**
 * A downpour, drawn like a comic: fat inked teardrops with a highlight caught on
 * the shoulder, and water that visibly fills up the bottom of the sky before
 * draining away again.
 *
 * The drop is drawn once into a <symbol> and stamped 44 times, so the whole
 * shower costs one path. The pool itself is built once and never rebuilt — a
 * shower is a class toggle, which resumes paused animations rather than mounting
 * hundreds of nodes every few seconds across an exhibition day.
 */
export function RainOverlay({ raining, drops, level }) {
  const pool = useMemo(() => {
    const rand = mulberry32(4242)
    return Array.from({ length: MAX_DROPS }, () => ({
      x: rand() * 100,
      // Slower than gravity on purpose: a cartoon drop is legible as a drop,
      // which means you have to be able to see its shape on the way down.
      duration: 1.15 + rand() * 0.6,
      delay: -rand() * 1.8,
      scale: 0.75 + rand() * 0.75,
      tilt: rand() * 10 - 5,
    }))
  }, [])

  return (
    <div
      className={`rain ${raining ? 'is-on' : ''}`}
      aria-hidden="true"
      style={{ '--pour': `${POUR_MS}ms`, '--drain': `${DRAIN_MS}ms` }}
    >
      <svg className="rain__defs" aria-hidden="true" focusable="false">
        <symbol id="comic-drop" viewBox="0 0 24 34">
          {/* Pointed at the top, round at the bottom — the shape everybody
              draws when they draw rain, rather than a rotated square. */}
          <path
            className="drop__ink"
            d="M12 1.5c0 0-9.2 13.2-9.2 19.4a9.2 9.2 0 0 0 18.4 0C21.2 14.7 12 1.5 12 1.5Z"
          />
          <path
            className="drop__fill"
            d="M12 1.5c0 0-9.2 13.2-9.2 19.4a9.2 9.2 0 0 0 18.4 0C21.2 14.7 12 1.5 12 1.5Z"
          />
          {/* The one bright spot that makes it read as water and not as a leaf. */}
          <ellipse className="drop__shine" cx="8.4" cy="21.5" rx="2.4" ry="3.4" />
        </symbol>
      </svg>

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
        >
          <svg className="drop__art" viewBox="0 0 24 34" aria-hidden="true">
            <use href="#comic-drop" />
          </svg>
        </span>
      ))}

      {/* The water that gathers, then goes. */}
      <div className="flood" style={{ height: `${Math.round(level * 100)}%` }}>
        <svg className="flood__wave" viewBox="0 0 240 26" preserveAspectRatio="none">
          {/* Rounder and deeper than a sine wave: comic water is drawn in
              scallops, and the crest needs to survive being 20px tall. */}
          <path className="flood__crest" d="M0 13 C 10 0 20 0 30 13 C 40 26 50 26 60 13 C 70 0 80 0 90 13 C 100 26 110 26 120 13 C 130 0 140 0 150 13 C 160 26 170 26 180 13 C 190 0 200 0 210 13 C 220 26 230 26 240 13 V26 H0 Z" />
          {/* The ink is a separate, open path along the curve alone. Stroking the
              filled shape would also draw its straight bottom edge, leaving a
              hard line across the water. */}
          <path className="flood__ink" d="M0 13 C 10 0 20 0 30 13 C 40 26 50 26 60 13 C 70 0 80 0 90 13 C 100 26 110 26 120 13 C 130 0 140 0 150 13 C 160 26 170 26 180 13 C 190 0 200 0 210 13 C 220 26 230 26 240 13" />
        </svg>
        <span className="flood__body" />
      </div>
    </div>
  )
}
