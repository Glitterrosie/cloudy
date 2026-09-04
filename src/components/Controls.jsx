/**
 * These sit outside the phone on purpose. They are not part of the widget — they
 * stand in for things you do in the real world, which the widget then reacts to.
 */
export function Controls({ onBuyStorage, onAddPhotos, nudge, nudgeToken }) {
  return (
    <div className="controls">
      <div className="controls__row">
        <button type="button" className="btn btn--primary" onClick={onAddPhotos}>
          <span aria-hidden="true">+</span> Take new pictures
        </button>
        <button type="button" className="btn btn--secondary" onClick={onBuyStorage}>
          <span aria-hidden="true">+</span> Get more storage
        </button>
      </div>
      {nudge && (
        <p className="controls__nudge" role="status" key={nudgeToken}>
          {nudge}
        </p>
      )}
    </div>
  )
}
