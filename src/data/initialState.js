import { analyseLibrary, uniqueChunks } from './library.js'

// The demo library is 1,004 real photographs totalling about 220 MB. A quota a
// little above what the opening sky holds keeps the "nearly full" feeling
// honest rather than inventing a round number.
export const QUOTA_START_BYTES = 150e6
export const QUOTA_STEP_BYTES = 50e6
export const DEFAULT_CLOUD_CAP = 20

// Cloud width as a share of the sky panel's width. Scaled against a reference
// stack size so the range still works whatever the detector happens to find.
const MIN_SIZE = 18
const MAX_SIZE = 38

export function sizeForBytes(bytes, reference = 30e6) {
  const scale = Math.min(1, bytes / reference)
  return MIN_SIZE + (MAX_SIZE - MIN_SIZE) * Math.sqrt(scale)
}

export const MIN_FREE_SIZE = 13
export const DEFAULT_SKY_ASPECT = 1.7

// How many detected stacks the opening sky shows. The rest are photographs you
// have not taken yet, and arrive via "Take new pictures".
export const OPENING_STACKS = 4
const OPENING_UNIQUE = 3

// Laid out on five rows so no two clouds overlap: neighbours on a row are far
// enough apart horizontally, and rows are far enough apart vertically once the
// panel's aspect ratio is taken into account.
const OPENING_LAYOUT = [
  { key: 'free-a', type: 'free', x: 22, y: 10, size: 26, seed: 101 },
  { key: 'uni-a', type: 'unique', x: 68, y: 10, unique: 0, seed: 202 },
  { key: 'stack-0', type: 'similar', x: 38, y: 27, stack: 0, seed: 303 },
  { key: 'free-c', type: 'free', x: 84, y: 27, size: 21, seed: 111 },
  { key: 'uni-b', type: 'unique', x: 20, y: 44, unique: 1, seed: 404 },
  { key: 'stack-1', type: 'similar', x: 66, y: 44, stack: 1, seed: 707 },
  { key: 'stack-2', type: 'similar', x: 40, y: 61, stack: 2, seed: 505 },
  { key: 'free-b', type: 'free', x: 82, y: 61, size: 24, seed: 606 },
  { key: 'uni-c', type: 'unique', x: 22, y: 82, unique: 2, seed: 808 },
  { key: 'stack-3', type: 'similar', x: 68, y: 82, stack: 3, seed: 909 },
]

export function buildInitialState() {
  const { stacks } = analyseLibrary()
  const chunks = uniqueChunks(OPENING_UNIQUE)
  const opening = stacks.slice(0, OPENING_STACKS)

  const groups = {}
  opening.forEach((stack) => {
    groups[stack.id] = stack
  })

  const clouds = OPENING_LAYOUT.map((spec) => {
    const stack = spec.stack != null ? opening[spec.stack] : null
    const chunk = spec.unique != null ? chunks[spec.unique] : null
    const bytes = stack?.bytes ?? chunk?.bytes ?? 0
    return {
      id: `c-${spec.key}`,
      type: spec.type,
      groupId: stack?.id ?? null,
      xPct: spec.x,
      yPct: spec.y,
      size: spec.size ?? sizeForBytes(bytes),
      bytes,
      seed: spec.seed,
      phase: 'idle',
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
