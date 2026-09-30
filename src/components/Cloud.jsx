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

function CloudComponent({ cloud, group, reducedMotion, onOpen, onSettled, onLeft }) {
  const shape = useCloudShape(cloud.seed)
  const evapRef = useRef(null)
  const interactive = cloud.type === 'similar' && cloud.phase === 'idle'
  // The group is the authority for a stack that is open to be cleaned; for every
  // other cloud the count lives on the cloud, because it is the running total of
  // whatever has been added to or taken out of it.
  const photoCount = cloud.type === 'similar' && group ? group.count : (cloud.photos ?? 0)

  // A new cloud bubbles up into place rather than appearing from nowhere.
  useEffect(() => {
    if (!cloud.entering) return undefined
    const timer = setTimeout(() => onSettled(cloud.id), reducedMotion ? 260 : 760)
    return () => clearTimeout(timer)
  }, [cloud.entering, cloud.id, reducedMotion, onSettled])

  // A cloud whose space has been used up shrinks away, then hands its space on.
  useEffect(() => {
    if (cloud.phase !== 'leaving') return undefined
    const timer = setTimeout(() => onLeft(cloud.id), reducedMotion ? 260 : 620)
    return () => clearTimeout(timer)
  }, [cloud.phase, cloud.id, reducedMotion, onLeft])

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
      {/* Shape as well as colour: a stack of photos marks a duplicate cloud, and
          nothing else carries a mark. */}
      {cloud.type === 'similar' && (
        <g className="cloud__motif">
          <rect x="76" y="46" width="34" height="26" rx="5" transform="rotate(-8 93 59)" />
          <rect x="86" y="50" width="34" height="26" rx="5" transform="rotate(4 103 63)" />
          <rect x="96" y="54" width="34" height="26" rx="5" className="cloud__motif-top" />
        </g>
      )}
      {/* Every cloud says how many photographs are in it, free space included —
          a nought is the plainest way to show that the room is there and empty,
          and it is what makes a handful of new one-off photos visible at all. */}
      <text
        x="110"
        y={cloud.type === 'similar' ? 112 : 92}
        className="cloud__count"
        textAnchor="middle"
      >
        {formatCount(photoCount)}
      </text>
    </svg>
  )

  const label = group
    ? `${group.label}. Open this stack to clean it up.`
    : 'A cloud of photos'

  return (
    <div
      className={[
        'cloud',
        `cloud--${cloud.type}`,
        cloud.phase === 'freed' ? 'is-clearing' : '',
        cloud.phase === 'leaving' ? 'is-leaving' : '',
        cloud.entering ? 'is-entering' : '',
      ]
        .filter(Boolean)
        .join(' ')}
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
