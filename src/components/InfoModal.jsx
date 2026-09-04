import { useEffect, useRef } from 'react'
import { MiniCloud } from './Legend.jsx'
import { GB_PER_PHOTO } from '../lib/format.js'

export function InfoModal({ onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal">
      <button type="button" className="modal__scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div className="modal__dialog modal__dialog--info" role="dialog" aria-modal="true" aria-labelledby="info-title">
        <header className="modal__head">
          <h2 className="modal__title" id="info-title">
            What am I looking at?
          </h2>
          <p className="modal__sub">Your cloud storage, drawn as a sky.</p>
        </header>

        <div className="info">
          <p>
            Every cloud is a piece of your storage. The more you store, the more clouds there are,
            and the more crowded your sky gets.
          </p>

          <ul className="info__list">
            <li>
              <MiniCloud type="free" />
              <span>
                <strong>White</strong> — free space. Nothing in it.
              </span>
            </li>
            <li>
              <MiniCloud type="similar" />
              <span>
                <strong>Slate blue</strong> — full of near-identical photos. These are the ones
                worth your attention. Tap one.
              </span>
            </li>
            <li>
              <MiniCloud type="unique" />
              <span>
                <strong>Blue</strong> — full of photos that only exist once. Nothing to clean up
                here.
              </span>
            </li>
          </ul>

          <p>
            The more near-duplicate clouds you carry, the more often it rains on your screen. Clean
            a stack out and the cloud empties, lifts, and the sky brightens. Buy more storage
            instead and you simply get more clouds.
          </p>

          <p className="info__note">
            Nothing here touches your real photos — it is a concept, not a utility. Sizes assume{' '}
            {(GB_PER_PHOTO * 1024).toFixed(1)} MB per photo, about what a phone camera produces.
          </p>
        </div>

        <footer className="modal__foot">
          <button type="button" className="btn btn--primary" ref={closeRef} onClick={onClose}>
            Back to the sky
          </button>
        </footer>
      </div>
    </div>
  )
}
