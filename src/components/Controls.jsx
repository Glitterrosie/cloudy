export function Controls({ onBuy, nudge, hint }) {
  return (
    <div className="controls">
      {nudge ? (
        <p className="controls__nudge" role="status">
          {nudge}
        </p>
      ) : (
        <p className="controls__hint">{hint}</p>
      )}
      {/* Buying more storage is the tempting wrong move — the poster's own idea. */}
      <button type="button" className="btn btn--primary" onClick={onBuy}>
        <span aria-hidden="true">+</span> Get more storage
      </button>
    </div>
  )
}
