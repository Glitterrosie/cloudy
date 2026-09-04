// Hex interpolation in JS rather than CSS color-mix(), which older exhibition
// tablets don't support. A plain background-color plus a transition works everywhere.
const parse = (hex) => {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function mixHex(from, to, t) {
  const a = parse(from)
  const b = parse(to)
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
