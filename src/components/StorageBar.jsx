import { formatSize } from '../lib/format.js'

export function StorageBar({ similarBytes, uniqueBytes, freeBytes, usedBytes, quotaBytes, freedBytes }) {
  const pct = (bytes) => `${Math.max(0, Math.min(100, (bytes / quotaBytes) * 100))}%`

  return (
    <div className="storage">
      <p className="storage__line">
        <strong>{formatSize(usedBytes)}</strong> of {formatSize(quotaBytes)} used
        {similarBytes > 1e5 && (
          <>
            {' · '}
            <span className="storage__warn">{formatSize(similarBytes)} of it is near-duplicates</span>
          </>
        )}
        {freedBytes > 1e5 && (
          <>
            {' '}
            <span className="storage__freed">{formatSize(freedBytes)} freed</span>
          </>
        )}
      </p>
      <div
        className="storage__bar"
        role="img"
        aria-label={`${formatSize(usedBytes)} of ${formatSize(quotaBytes)} used. ${formatSize(
          similarBytes,
        )} near-duplicates, ${formatSize(uniqueBytes)} unique, ${formatSize(freeBytes)} free.`}
      >
        <span className="storage__seg storage__seg--similar" style={{ width: pct(similarBytes) }} />
        <span className="storage__seg storage__seg--unique" style={{ width: pct(uniqueBytes) }} />
      </div>
    </div>
  )
}
