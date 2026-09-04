/** The reward, straight from the customization page of the concept poster:
 *  the sun comes out when you clear storage. */
export function SunBurst({ visible }) {
  return (
    <div className={`sunburst ${visible ? 'is-on' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 200 200" className="sunburst__rays">
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x="97" y="6" width="6" height="52" rx="3" transform={`rotate(${i * 30} 100 100)`} />
        ))}
      </svg>
      <span className="sunburst__disc" />
    </div>
  )
}

/** A short storm flash when new storage is bought — buying your way out is the
 *  wrong move, and the sky says so. */
export function StormFlash({ token }) {
  if (!token) return null
  return (
    <div className="storm" key={token} aria-hidden="true">
      <svg viewBox="0 0 60 100" className="storm__bolt">
        <path d="M34 4 L12 56 h16 L22 96 L48 40 H30 Z" />
      </svg>
    </div>
  )
}
