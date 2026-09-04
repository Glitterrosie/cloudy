import { makeGroup, OPENING_GROUP_IDS } from './photoGroups.js'

export const QUOTA_START_GB = 15
export const QUOTA_STEP_GB = 15
export const DEFAULT_CLOUD_CAP = 20

// Cloud width as a share of the sky panel's width, driven by how much data it
// holds. Kept modest so ten-plus clouds can share the sky without piling up.
export const sizeForGb = (gb) => Math.min(38, Math.max(18, 20 + gb * 7))

export const MIN_FREE_SIZE = 13
export const DEFAULT_SKY_ASPECT = 1.7

// The opening frame is composed by hand rather than generated: it is identical on
// every load and every reset, so the piece is well-composed every time and can be
// rehearsed and photographed. Random placement is only used for clouds bought later.
// Laid out on six rows so no two clouds overlap: neighbours on a row are far
// enough apart horizontally, and rows are far enough apart vertically once the
// panel's aspect ratio is taken into account.
const OPENING_LAYOUT = [
  { key: 'free-a', type: 'free', x: 22, y: 10, size: 26, seed: 101 },
  { key: 'uni-a', type: 'unique', x: 68, y: 10, gb: 2.0, seed: 202 },
  { key: 'sunset', type: 'similar', x: 38, y: 27, groupId: 'sunset', seed: 303 },
  { key: 'free-c', type: 'free', x: 84, y: 27, size: 21, seed: 111 },
  { key: 'uni-b', type: 'unique', x: 20, y: 44, gb: 1.5, seed: 404 },
  { key: 'screenshots', type: 'similar', x: 66, y: 44, groupId: 'screenshots', seed: 707 },
  { key: 'dog', type: 'similar', x: 40, y: 61, groupId: 'dog', seed: 505 },
  { key: 'free-b', type: 'free', x: 82, y: 61, size: 24, seed: 606 },
  { key: 'uni-c', type: 'unique', x: 22, y: 78, gb: 1.2, seed: 808 },
  { key: 'latte', type: 'similar', x: 68, y: 78, groupId: 'latte', seed: 909 },
]

export function buildInitialState() {
  const groups = {}
  OPENING_GROUP_IDS.forEach((id) => {
    groups[id] = makeGroup(id)
  })

  const clouds = OPENING_LAYOUT.map((spec) => {
    const gb = spec.groupId ? groups[spec.groupId].gb : spec.gb ?? 0
    return {
      id: `c-${spec.key}`,
      type: spec.type,
      groupId: spec.groupId ?? null,
      xPct: spec.x,
      yPct: spec.y,
      size: spec.size ?? sizeForGb(gb),
      gb,
      seed: spec.seed,
      phase: 'idle', // idle | freed | clearing
    }
  })

  return {
    clouds,
    groups,
    quotaGb: QUOTA_START_GB,
    cloudCap: DEFAULT_CLOUD_CAP,
    skyAspect: DEFAULT_SKY_ASPECT,
    freedGb: 0,
    freedPhotos: 0,
    purchases: 0,
    spawnSeed: 20260904,
    nudge: null,
    dirty: false,
  }
}
