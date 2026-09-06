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
