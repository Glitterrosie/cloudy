import { useCallback, useEffect, useRef, useState } from 'react'
import { PhotoThumb, MoreTile } from './PhotoThumb.jsx'
import { SAMPLE_SIZE } from '../data/photoGroups.js'
import { formatCount, formatSize, photosToGb } from '../lib/format.js'

/**
 * The gallery opens with the outcome already staged: one photo kept, the rest
 * greyed out and marked for deletion, and a button that says exactly what will
 * happen. A visitor with thirty seconds and no instructions can just press it.
 * Tapping photos adjusts the keep set for anyone who wants to.
 */
export function GalleryModal({ group, originRect, reducedMotion, onCancel, onConfirm }) {
  const [kept, setKept] = useState(() => new Set([group.samples[0].id]))
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef(null)
  const primaryRef = useRef(null)
  const tiles = useRef(new Map())

  const deleteCount = Math.max(0, group.count - kept.size)

  const toggle = useCallback((id) => {
    setKept((prev) => {
      // Never let a visitor delete every last one — that isn't the point being made.
      if (prev.has(id) && prev.size === 1) return prev
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true })
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (busy) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll('button:not([disabled])')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])

  // Closing instantly would break the causal link between the tap and the sky
  // changing — which is the whole piece. So the deletion is shown happening.
  const confirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (!reducedMotion) {
        const doomed = group.samples
          .filter((s) => !kept.has(s.id))
          .map((s) => tiles.current.get(s.id))
          .filter(Boolean)
        await Promise.all(
          doomed.map((node, i) =>
            node.animate(
              [
                { transform: 'scale(1) rotate(0deg)', opacity: 1 },
                { transform: 'scale(0.15) rotate(-14deg)', opacity: 0 },
              ],
              { duration: 420, delay: i * 40, easing: 'ease-in', fill: 'forwards' },
            ).finished.catch(() => {}),
          ),
        )
        const dialog = dialogRef.current
        if (dialog && originRect) {
          const rect = dialog.getBoundingClientRect()
          const dx = originRect.left + originRect.width / 2 - (rect.left + rect.width / 2)
          const dy = originRect.top + originRect.height / 2 - (rect.top + rect.height / 2)
          await dialog
            .animate(
              [
                { transform: 'translate(0,0) scale(1)', opacity: 1 },
                { transform: `translate(${dx}px, ${dy}px) scale(0.15)`, opacity: 0 },
              ],
              { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
            )
            .finished.catch(() => {})
        }
      }
    } catch {
      // If the choreography fails, the deletion still has to happen.
    }
    onConfirm(Array.from(kept))
  }

  const freed = photosToGb(deleteCount)

  return (
    <div className={`modal ${busy ? 'is-leaving' : ''}`}>
      <button
        type="button"
        className="modal__scrim"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => !busy && onCancel()}
      />
      <div
        className="modal__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-title"
      >
        <header className="modal__head">
          <h2 className="modal__title" id="gallery-title">
            {group.label}
          </h2>
          <p className="modal__sub">{group.subline}</p>
          <p className="modal__meta">
            Showing {SAMPLE_SIZE} of {formatCount(group.count)} · {formatSize(group.gb)}
          </p>
        </header>

        <div className="modal__grid">
          {group.samples.map((item) => (
            <PhotoThumb
              key={item.id}
              item={item}
              group={group}
              kept={kept.has(item.id)}
              onToggle={() => toggle(item.id)}
              ref={(node) => {
                if (node) tiles.current.set(item.id, node)
                else tiles.current.delete(item.id)
              }}
            />
          ))}
          <MoreTile count={group.count - SAMPLE_SIZE} />
        </div>

        <footer className="modal__foot">
          <button
            type="button"
            className="btn btn--danger"
            ref={primaryRef}
            onClick={confirm}
            disabled={busy}
          >
            Delete {formatCount(deleteCount)} duplicates
            <span className="btn__note">frees {formatSize(freed)}</span>
          </button>
          <button type="button" className="btn btn--quiet" onClick={onCancel} disabled={busy}>
            Keep them all
          </button>
        </footer>
      </div>
    </div>
  )
}
