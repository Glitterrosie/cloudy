import { LOBES } from './Cloud.jsx'

/** The legend teaches the shape cue as well as the colour, so the three types
 *  stay tellable apart in greyscale, under glare, or with colour-blindness. */
export function MiniCloud({ type }) {
  return (
    <svg viewBox="0 0 220 150" className={`mini cloud--${type}`} aria-hidden="true">
      <g className="cloud__body">
        {LOBES.map((lobe, i) => (
          <circle key={i} cx={lobe.cx} cy={lobe.cy} r={lobe.r} />
        ))}
      </g>
      {type === 'similar' && (
        <g className="cloud__motif">
          <rect x="76" y="58" width="34" height="26" rx="5" transform="rotate(-8 93 71)" />
          <rect x="86" y="62" width="34" height="26" rx="5" transform="rotate(4 103 75)" />
          <rect x="96" y="66" width="34" height="26" rx="5" className="cloud__motif-top" />
        </g>
      )}
      {type === 'unique' && (
        <g className="cloud__motif">
          <rect x="89" y="64" width="36" height="28" rx="5" className="cloud__motif-top" />
        </g>
      )}
    </svg>
  )
}

export function Legend({ onOpenInfo }) {
  return (
    <div className="legend">
      <span className="legend__chip">
        <MiniCloud type="free" />
        Free space
      </span>
      <span className="legend__chip legend__chip--flag">
        <MiniCloud type="similar" />
        Similar photos
      </span>
      <span className="legend__chip">
        <MiniCloud type="unique" />
        Unique photos
      </span>
      <button type="button" className="legend__info" onClick={onOpenInfo}>
        <span aria-hidden="true">?</span>
        <span className="visually-hidden">What am I looking at?</span>
      </button>
    </div>
  )
}
