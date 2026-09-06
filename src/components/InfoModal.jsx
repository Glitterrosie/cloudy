import { useEffect, useRef } from 'react'
import { MiniCloud } from './Legend.jsx'
import { analyseLibrary } from '../data/library.js'
import { formatCount, formatSize } from '../lib/format.js'

export function InfoModal({ onClose }) {
  const closeRef = useRef(null)
  const library = analyseLibrary()

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
            a stack out and its cloud turns white — the space is still yours, just empty again —
            the rain eases and the sky brightens.
          </p>

          <p>
            Take new pictures and they fill the white clouds up. Buy more storage and you get more
            clouds to fill. Either way, the sky gets busier.
          </p>

          <p>
            The photographs are real, and so is the sorting. Cloudy carries a library of{' '}
            {formatCount(library.totalPhotos)} freely-licensed photographs ({formatSize(library.totalBytes)}),
            and every time this page loads it compares all of them against each other and finds the
            near-identical ones itself — {library.stacks.length} stacks, in about {library.tookMs} ms.
            Nothing is decided in advance.
          </p>

          <p className="info__note">
            It never touches your own photos — it is a concept, not a utility. Sizes shown are the
            real file sizes of these images. Photo credits are listed in the project's CREDITS file.
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
