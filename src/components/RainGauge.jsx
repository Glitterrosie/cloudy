const WORDS = ['none', 'low', 'medium', 'high']

/** "Rain probability drops" has to be something a visitor can actually see. */
export function RainGauge({ intensity, raining }) {
  const level = Math.min(4, Math.ceil(intensity * 4))
  const word = level === 0 ? WORDS[0] : WORDS[Math.min(3, level - 1)]

  return (
    <div className={`gauge ${raining ? 'is-raining' : ''}`} title={`Chance of rain: ${word}`}>
      <svg viewBox="0 0 24 24" className="gauge__drop" aria-hidden="true">
        <path d="M12 2.5c3.6 4.6 6 7.9 6 10.7a6 6 0 0 1-12 0c0-2.8 2.4-6.1 6-10.7Z" />
      </svg>
      <span className="gauge__bars" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`gauge__bar ${i < level ? 'is-on' : ''}`} />
        ))}
      </span>
      <span className="visually-hidden">Chance of rain: {word}</span>
    </div>
  )
}
