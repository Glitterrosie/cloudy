/**
 * Near-duplicate detection.
 *
 * This is the real thing, running in the browser on load: it compares the
 * perceptual hash of every photo in the library against every other, and groups
 * the ones that are structurally near-identical. Nothing about which photos are
 * duplicates is decided in advance — the stacks you see in the sky are whatever
 * this finds.
 */

/** Bits that may differ before two photos are considered different pictures.
 *
 *  Chosen by measuring this library: at 50, no two different subjects are ever
 *  linked, while the frames within a burst still connect into one stack. Pushing
 *  it to 70 starts welding sunsets to beach photos — they really do look alike
 *  to a structural hash — and because grouping is transitive, one bad link would
 *  merge two whole stacks. */
export const DUPLICATE_THRESHOLD = 50

const POPCOUNT = new Uint8Array(256)
for (let i = 0; i < 256; i += 1) {
  POPCOUNT[i] = (i & 1) + POPCOUNT[i >> 1]
}

export function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return out
}

/** Hamming distance, abandoning early once the pair cannot possibly match. */
export function hamming(a, b, limit = Infinity) {
  let distance = 0
  for (let i = 0; i < a.length; i += 1) {
    distance += POPCOUNT[a[i] ^ b[i]]
    if (distance > limit) return distance
  }
  return distance
}

/**
 * Group photos by structural similarity (union-find over pairs within the
 * threshold). Roughly half a million comparisons for a thousand photos, which
 * the early exit above keeps to a few tens of milliseconds.
 */
export function clusterPhotos(photos, threshold = DUPLICATE_THRESHOLD) {
  const hashes = photos.map((p) => hexToBytes(p.h))
  const parent = photos.map((_, i) => i)

  const find = (i) => {
    let root = i
    while (parent[root] !== root) root = parent[root]
    while (parent[i] !== root) {
      const next = parent[i]
      parent[i] = root
      i = next
    }
    return root
  }

  for (let i = 0; i < photos.length; i += 1) {
    for (let j = i + 1; j < photos.length; j += 1) {
      if (find(i) === find(j)) continue
      if (hamming(hashes[i], hashes[j], threshold) <= threshold) {
        parent[find(j)] = find(i)
      }
    }
  }

  const groups = new Map()
  photos.forEach((photo, i) => {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(photo)
  })

  return [...groups.values()].sort((a, b) => b.length - a.length)
}
