// Seeded PRNG so a spawned sky is reproducible and never surprises us on site.
export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)]
export const between = (rand, min, max) => min + rand() * (max - min)
export const lerp = (a, b, t) => a + (b - a) * t
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
