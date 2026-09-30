import { forwardRef, useState } from 'react'

/**
 * A real photograph from the library.
 *
 * If it cannot load — a phone that lost the hall wifi mid-visit — the tile falls
 * back to a drawn tint rather than a broken image, so the gallery still reads
 * and the deletion still makes sense.
 */
export const PhotoThumb = forwardRef(function PhotoThumb(
  { item, kept, onToggle, readOnly = false },
  ref,
) {
  const [failed, setFailed] = useState(false)

  return (
    <button
      type="button"
      ref={ref}
      className={`thumb ${kept ? 'is-kept' : ''} ${readOnly ? 'is-view' : ''} ${failed ? 'is-blank' : ''}`}
      onClick={readOnly ? undefined : onToggle}
      aria-pressed={readOnly ? undefined : kept}
      tabIndex={readOnly ? -1 : undefined}
      style={{ '--tilt': `${item.tilt}deg`, '--hue': `${item.hue}deg` }}
    >
      {failed ? (
        <span className="thumb__img thumb__img--fallback" />
      ) : (
        <img
          className="thumb__img"
          src={item.src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable="false"
          onError={() => setFailed(true)}
        />
      )}
      <span className="thumb__badge" aria-hidden="true">
        {kept ? '♥' : '✕'}
      </span>
      <span className="thumb__name">{item.filename}</span>
      {!readOnly && (
        <span className="visually-hidden">{kept ? 'Keeping this one' : 'Will be deleted'}</span>
      )}
    </button>
  )
})

export function MoreTile({ count, label = 'more just like these' }) {
  return (
    <span className="thumb thumb--more" aria-hidden="true">
      <span className="thumb__more-count">+{count.toLocaleString('en-US')}</span>
      <span className="thumb__more-label">{label}</span>
    </span>
  )
}
