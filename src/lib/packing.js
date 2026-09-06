import { clamp } from './rng.js'

/**
 * Lays the sky out like bubbles in a glass: every cloud's area is proportional to
 * the amount of storage it represents, and together they fill the panel.
 *
 * Because the areas sum to the quota, the sky *is* the storage. Buy 50 MB and a
 * cloud worth 50 MB appears; delete a stack and its cloud keeps exactly the space
 * it always had, now empty.
 *
 * Everything works in "percent of panel width" for both axes, so the panel is
 * 100 wide and 100 * aspect tall. Cloud drawings are about 0.68 as tall as they
 * are wide.
 */
const CLOUD_ASPECT = 0.68
// A cloud fills roughly this much of its own bounding box once drawn.
const SHAPE_FILL = 0.58
// Clouds are lumpy and never tile perfectly. Bounding boxes are allowed to add
// up to more than the panel, because a cloud only paints part of its own box —
// the shapes end up touching like bubbles while the boxes overlap.
const COVERAGE = 1.0

// Collision radii are pulled in slightly from the bounding ellipse so clouds can
// nestle into each other's corners instead of holding each other at arm's length.
const NESTLE = 0.88

const MIN_SIZE = 9
const MAX_SIZE = 54

export function sizeForShare(share, aspect) {
  const panelArea = 100 * (100 * aspect)
  const area = share * COVERAGE * panelArea
  return clamp(Math.sqrt(area / (CLOUD_ASPECT * SHAPE_FILL)), MIN_SIZE, MAX_SIZE)
}

/**
 * Nudge overlapping clouds apart until they sit shoulder to shoulder.
 *
 * Overlap is measured in normalised space — each axis divided by the sum of the
 * two clouds' radii on that axis — so wide, short cloud shapes are separated
 * correctly instead of being treated as circles and pushed too far apart
 * vertically.
 */
export function packSky(clouds, aspect, { iterations = 300 } = {}) {
  const height = 100 * aspect
  const nodes = clouds.map((cloud) => ({
    id: cloud.id,
    x: cloud.xPct,
    y: cloud.yPct * aspect,
    rx: (cloud.size / 2) * NESTLE,
    ry: ((cloud.size * CLOUD_ASPECT) / 2) * NESTLE,
  }))

  for (let step = 0; step < iterations; step += 1) {
    // Ease off as it settles, so the last passes only make fine corrections.
    const strength = 0.55 * (1 - step / iterations) + 0.12

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]
        const b = nodes[j]
        const sumX = a.rx + b.rx
        const sumY = a.ry + b.ry
        let dx = b.x - a.x
        let dy = b.y - a.y
        if (dx === 0 && dy === 0) {
          dx = (i % 2 ? 1 : -1) * 0.01
          dy = 0.01
        }
        const nx = dx / sumX
        const ny = dy / sumY
        const distance = Math.hypot(nx, ny)
        if (distance >= 1 || distance === 0) continue

        const push = ((1 - distance) / distance) * strength * 0.5
        const shiftX = nx * push * sumX
        const shiftY = ny * push * sumY
        a.x -= shiftX
        a.y -= shiftY
        b.x += shiftX
        b.y += shiftY
      }
    }

    // No pull toward the centre: on a tall panel that balls everything up in the
    // middle and leaves the top and bottom empty. Spreading comes from the
    // clouds having enough area between them to need the whole glass.

    // Keep the bubbles inside the glass.
    for (const node of nodes) {
      node.x = clamp(node.x, node.rx * 0.92, 100 - node.rx * 0.92)
      node.y = clamp(node.y, node.ry * 0.92, height - node.ry * 0.92)
    }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]))
  return clouds.map((cloud) => {
    const node = byId.get(cloud.id)
    return { ...cloud, xPct: node.x, yPct: node.y / aspect }
  })
}

/**
 * Full layout pass: size every cloud from its share of the quota, then pack.
 * Seeded from wherever the clouds already are, so adding or removing one nudges
 * its neighbours aside rather than rearranging the whole sky.
 */
export function layoutSky(clouds, aspect) {
  const totalCapacity = clouds.reduce((sum, c) => sum + Math.max(0, c.capacity), 0) || 1
  const sized = clouds.map((cloud) => ({
    ...cloud,
    size: sizeForShare(Math.max(0, cloud.capacity) / totalCapacity, aspect),
  }))
  return packSky(sized, aspect)
}
