import { analyseLibrary, uniqueChunks } from './library.js'

// The demo library is 1,004 real photographs totalling about 220 MB. A quota a
// little above what the opening sky holds keeps the "nearly full" feeling
// honest rather than inventing a round number.
export const QUOTA_START_BYTES = 150e6
export const QUOTA_STEP_BYTES = 50e6
export const DEFAULT_CLOUD_CAP = 22

// Below this share of the quota a cloud is too small to read, and its space is
// folded back into its neighbours.
export const MIN_CAPACITY_SHARE = 0.012

export const DEFAULT_SKY_ASPECT = 1.7

// How many detected stacks the opening sky shows. The rest are photographs you
// have not taken yet, and arrive via "Take new pictures".
export const OPENING_STACKS = 4
const OPENING_UNIQUE = 3
const OPENING_FREE = 3

/**
 * Seed positions for the opening sky. Sizes are not set here — every cloud is
 * sized from its share of the quota and then packed (see lib/packing.js), so
 * these only decide roughly where each one starts before settling.
 */
const SEEDS = [
  { key: 'free-a', type: 'free', x: 24, y: 12, free: 0 },
  { key: 'uni-a', type: 'unique', x: 70, y: 11, unique: 0 },
  { key: 'stack-0', type: 'similar', x: 33, y: 31, stack: 0 },
  { key: 'free-c', type: 'free', x: 80, y: 30, free: 1 },
  { key: 'uni-b', type: 'unique', x: 22, y: 51, unique: 1 },
  { key: 'stack-1', type: 'similar', x: 68, y: 50, stack: 1 },
  { key: 'stack-2', type: 'similar', x: 34, y: 70, stack: 2 },
  { key: 'free-b', type: 'free', x: 78, y: 69, free: 2 },
  { key: 'uni-c', type: 'unique', x: 24, y: 88, unique: 2 },
  { key: 'stack-3', type: 'similar', x: 70, y: 88, stack: 3 },
]

export function buildInitialState() {
  const { stacks } = analyseLibrary()
  const chunks = uniqueChunks(OPENING_UNIQUE)
  const opening = stacks.slice(0, OPENING_STACKS)

  const groups = {}
  opening.forEach((stack) => {
    groups[stack.id] = stack
  })

  const usedBytes =
    opening.reduce((sum, s) => sum + s.bytes, 0) + chunks.reduce((sum, c) => sum + c.bytes, 0)
  const freeEach = Math.max(0, QUOTA_START_BYTES - usedBytes) / OPENING_FREE

  const clouds = SEEDS.map((spec) => {
    const stack = spec.stack != null ? opening[spec.stack] : null
    const chunk = spec.unique != null ? chunks[spec.unique] : null
    const bytes = stack?.bytes ?? chunk?.bytes ?? 0
    return {
      id: `c-${spec.key}`,
      type: spec.type,
      groupId: stack?.id ?? null,
      xPct: spec.x,
      yPct: spec.y,
      // capacity is the storage space this cloud *is*; bytes is the data in it.
      // They are equal for a full cloud and diverge the moment you delete.
      capacity: spec.type === 'free' ? freeEach : bytes,
      bytes,
      size: 20,
      seed: 101 + SEEDS.indexOf(spec) * 97,
      phase: 'idle',
      entering: true,
    }
  }).filter((cloud) => cloud.type !== 'similar' || cloud.groupId)

  return {
    clouds,
    groups,
    usedStackIds: opening.map((s) => s.id),
    quotaBytes: QUOTA_START_BYTES,
    cloudCap: DEFAULT_CLOUD_CAP,
    skyAspect: DEFAULT_SKY_ASPECT,
    freedBytes: 0,
    freedPhotos: 0,
    purchases: 0,
    spawnSeed: 20260904,
    nudge: null,
    nudgeToken: 0,
    dirty: false,
  }
}
