import { formatSize } from '../lib/format.js'

export function StorageBar({ similarGb, uniqueGb, freeGb, usedGb, quotaGb, freedGb }) {
  const pct = (gb) => `${Math.max(0, Math.min(100, (gb / quotaGb) * 100))}%`

  return (
    <div className="storage">
      <p className="storage__line">
        <strong>{formatSize(usedGb)}</strong> of {formatSize(quotaGb)} used
        {similarGb > 0.05 && (
          <>
            {' · '}
            <span className="storage__warn">{formatSize(similarGb)} of it is near-duplicates</span>
          </>
        )}
        {freedGb > 0.01 && (
          <>
            {' '}
            <span className="storage__freed">{formatSize(freedGb)} freed</span>
          </>
        )}
      </p>
      <div
        className="storage__bar"
        role="img"
        aria-label={`${formatSize(usedGb)} of ${formatSize(quotaGb)} used. ${formatSize(
          similarGb,
        )} near-duplicates, ${formatSize(uniqueGb)} unique, ${formatSize(freeGb)} free.`}
      >
        <span className="storage__seg storage__seg--similar" style={{ width: pct(similarGb) }} />
        <span className="storage__seg storage__seg--unique" style={{ width: pct(uniqueGb) }} />
      </div>
    </div>
  )
}
