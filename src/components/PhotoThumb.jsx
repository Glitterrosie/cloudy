import { forwardRef } from 'react'

/**
 * Placeholder photos are drawn, not downloaded: a per-stack gradient with a small
 * per-photo hue and framing wobble. Near-identical but not identical — which is
 * exactly what a pile of duplicates looks like — and nothing to load over the
 * exhibition wifi.
 */
export const PhotoThumb = forwardRef(function PhotoThumb({ item, group, kept, onToggle }, ref) {
  return (
    <button
      type="button"
      ref={ref}
      className={`thumb ${kept ? 'is-kept' : ''}`}
      onClick={onToggle}
      aria-pressed={kept}
      style={{ '--tilt': `${item.tilt}deg` }}
    >
      <span
        className="thumb__img"
        style={{
          backgroundImage: `${group.accent}, ${group.base}`,
          backgroundPosition: `${item.shift}% ${item.shift}%`,
          '--hue': `${item.hue}deg`,
        }}
      />
      <span className="thumb__badge" aria-hidden="true">
        {kept ? '♥' : '✕'}
      </span>
      <span className="thumb__name">{item.filename}</span>
      <span className="visually-hidden">{kept ? 'Keeping this one' : 'Will be deleted'}</span>
    </button>
  )
})

export function MoreTile({ count }) {
  return (
    <span className="thumb thumb--more" aria-hidden="true">
      <span className="thumb__more-count">+{count.toLocaleString('en-US')}</span>
      <span className="thumb__more-label">more just like these</span>
    </span>
  )
}
