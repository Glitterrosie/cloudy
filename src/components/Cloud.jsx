import { memo, useEffect, useMemo, useRef } from 'react'
import { mulberry32 } from '../lib/rng.js'
import { formatCount } from '../lib/format.js'

// Overlapping circles with one flat fill and no outline — the silhouette from the
// Figma. Because every lobe shares a fill and nothing is stroked, the union reads
// as a single bubbly cloud.
export const LOBES = [
  { cx: 66, cy: 80, r: 36 },
  { cx: 106, cy: 58, r: 44 },
  { cx: 152, cy: 78, r: 37 },
  { cx: 92, cy: 100, r: 33 },
  { cx: 132, cy: 100, r: 32 },
]

function useCloudShape(seed) {
  return useMemo(() => {
    const rand = mulberry32(seed)
    const lobes = LOBES.map((lobe) => ({
      cx: lobe.cx + (rand() * 12 - 6),
      cy: lobe.cy + (rand() * 10 - 5),
      r: lobe.r + (rand() * 8 - 4),
    }))
    return {
      lobes,
      drift: {
        '--dur': `${(26 + rand() * 26).toFixed(1)}s`,
        '--amp': (10 + rand() * 14).toFixed(1),
        '--bob-dur': `${(9 + rand() * 8).toFixed(1)}s`,
        '--rot': (rand() * 5 - 2.5).toFixed(2),
      },
      // Negative delays start every cloud mid-drift, so nothing is ever in step.
      offsets: { drift: -rand(), bob: -rand() },
    }
  }, [seed])
}

function CloudComponent({ cloud, group, reducedMotion, onOpen, onSettled }) {
  const shape = useCloudShape(cloud.seed)
  const evapRef = useRef(null)
  const interactive = cloud.type === 'similar' && cloud.phase === 'idle'

  // The clearing beat: a pulse to catch the eye while the fill transitions to
  // white, and a small puff of the data leaving. The cloud itself stays — it is
  // storage you still own, now empty.
  useEffect(() => {
    if (cloud.phase !== 'freed') return undefined
    const node = evapRef.current
    let cancelled = false
    let timer = null

    const settle = () => {
      if (!cancelled) onSettled(cloud.id)
    }

    const run = async () => {
      try {
        if (node && typeof node.animate === 'function' && !reducedMotion) {
          await node.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.07)' }, { transform: 'scale(1)' }],
            { duration: 360, easing: 'ease-out' },
          ).finished
        }
      } catch {
        // An interrupted animation must never strand a cloud mid-transition.
      }
      if (cancelled) return
      timer = setTimeout(settle, reducedMotion ? 400 : 900)
    }
    run()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [cloud.phase, cloud.id, reducedMotion, onSettled])

  const style = {
    left: `${cloud.xPct}%`,
    top: `${cloud.yPct}%`,
    width: `${cloud.size}%`,
    ...shape.drift,
    '--drift-delay': `${(shape.offsets.drift * parseFloat(shape.drift['--dur'])).toFixed(1)}s`,
    '--bob-delay': `${(shape.offsets.bob * parseFloat(shape.drift['--bob-dur'])).toFixed(1)}s`,
  }

  const svg = (
    <svg viewBox="0 0 220 150" className="cloud__svg" aria-hidden="true" focusable="false">
      <g className="cloud__body">
        {shape.lobes.map((lobe, i) => (
          <circle key={i} cx={lobe.cx} cy={lobe.cy} r={lobe.r} />
        ))}
      </g>
      {/* Shape as well as colour: a stack of photos for duplicates, a single photo
          for unique data, nothing at all for free space. */}
      {cloud.type === 'similar' && (
        <g className="cloud__motif">
          <rect x="76" y="58" width="34" height="26" rx="5" transform="rotate(-8 93 71)" />
          <rect x="86" y="62" width="34" height="26" rx="5" transform="rotate(4 103 75)" />
          <rect x="96" y="66" width="34" height="26" rx="5" className="cloud__motif-top" />
          {group && (
            <text x="113" y="118" className="cloud__count" textAnchor="middle">
              {formatCount(group.count)}
            </text>
          )}
        </g>
      )}
      {cloud.type === 'unique' && (
        <g className="cloud__motif">
          <rect x="89" y="64" width="36" height="28" rx="5" className="cloud__motif-top" />
        </g>
      )}
    </svg>
  )

  const label = group
    ? `${group.label}. Open this stack to clean it up.`
    : 'A cloud of photos'

  return (
    <div
      className={`cloud cloud--${cloud.type} ${cloud.phase !== 'idle' ? 'is-clearing' : ''}`}
      style={style}
    >
      <div className="cloud__drift">
        <div className="cloud__bob">
          <div className="cloud__evap" ref={evapRef}>
            {interactive ? (
              <button
                type="button"
                className="cloud__hit"
                onClick={(e) => onOpen(cloud, e.currentTarget.getBoundingClientRect())}
                title={label}
              >
                <span className="visually-hidden">{label}</span>
                {svg}
              </button>
            ) : (
              <div className="cloud__hit" aria-hidden="true">
                {svg}
              </div>
            )}
            {cloud.phase === 'freed' && (
              <span className="cloud__puffs" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="puff" style={{ '--i': i }} />
                ))}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const Cloud = memo(CloudComponent)
