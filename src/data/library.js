import libraryData from './library.json'
import { clusterPhotos, DUPLICATE_THRESHOLD } from '../lib/duplicates.js'

/** A cluster this size or larger is a "stack" worth showing as a duplicate cloud. */
const MIN_STACK = 3
// 11 samples plus the "+N more" tile fills a 3-across grid exactly.
const SAMPLE_LIMIT = 11

const asset = (file) => `${import.meta.env.BASE_URL}photos/${file}`

const sum = (photos) => photos.reduce((total, p) => total + p.b, 0)

function describe(cluster, index) {
  // A cluster's subject is whatever most of its photos came from. Clusters the
  // detector found on its own have no subject at all, and say so.
  const counts = new Map()
  cluster.forEach((p) => p.s && counts.set(p.s, (counts.get(p.s) ?? 0) + 1))
  const [subjectId] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
  const theme = subjectId ? libraryData.themes[subjectId] : null

  return {
    id: subjectId ?? `found-${index}`,
    label: theme
      ? `${cluster.length} photos of ${theme.subject}`
      : `${cluster.length} photos that look the same`,
    subline: theme?.subline ?? 'Different days. Nobody could tell them apart.',
    count: cluster.length,
    bytes: sum(cluster),
    samples: cluster
      .filter((p) => p.t)
      .slice(0, SAMPLE_LIMIT)
      .map((p, i) => ({
        id: p.i,
        filename: p.n,
        src: asset(`${p.i}.webp`),
        // Kept as a fallback tint if a thumbnail cannot load — a flaky hall
        // network should degrade to something drawn, not to a broken image.
        hue: ((i * 37) % 13) - 6,
        tilt: (((i * 53) % 9) - 4) * 0.35,
      })),
  }
}

let cache = null

/**
 * Runs near-duplicate detection over the whole library and returns what it
 * found. Real detection, in the browser, on load — the stacks below are not
 * written down anywhere, they are whatever the hashes turn out to say.
 */
export function analyseLibrary() {
  if (cache) return cache

  const started = typeof performance !== 'undefined' ? performance.now() : 0
  const clusters = clusterPhotos(libraryData.photos)
  const singles = clusters.filter((c) => c.length < MIN_STACK).flat()

  // One subject can legitimately break into more than one stack — a burst of
  // eighteen blurred concert frames splits where the blur stops bridging them,
  // and the detector is right to say so. But the id keys `groups` and
  // `usedStackIds`, so a repeat has to be made distinct or the second stack
  // would overwrite the first and never be reachable.
  const seen = new Set()
  const stacks = clusters
    .filter((c) => c.length >= MIN_STACK)
    .map(describe)
    .map((stack) => {
      if (!seen.has(stack.id)) {
        seen.add(stack.id)
        return stack
      }
      let n = 2
      while (seen.has(`${stack.id}-${n}`)) n += 1
      seen.add(`${stack.id}-${n}`)
      return { ...stack, id: `${stack.id}-${n}` }
    })

  cache = {
    stacks,
    singleCount: singles.length,
    singleBytes: sum(singles),
    totalPhotos: libraryData.photos.length,
    totalBytes: sum(libraryData.photos),
    threshold: DUPLICATE_THRESHOLD,
    tookMs: typeof performance !== 'undefined' ? Math.round(performance.now() - started) : 0,
  }
  return cache
}

/** Unique data: the photos with no duplicates, split into a few clouds. */
export function uniqueChunks(count) {
  const { singleBytes, singleCount } = analyseLibrary()
  return Array.from({ length: count }, (_, i) => ({
    bytes: Math.round(singleBytes / count),
    count: Math.round(singleCount / count),
    key: `unique-${i}`,
  }))
}
