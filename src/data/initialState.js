import { makeGroup, OPENING_GROUP_IDS } from './photoGroups.js'

export const QUOTA_START_GB = 15
export const QUOTA_STEP_GB = 15
export const DEFAULT_CLOUD_CAP = 16

// Cloud width as a share of the sky panel's width, driven by how much data it holds.
export const sizeForGb = (gb) => Math.min(54, Math.max(26, 28 + gb * 9.5))

// The opening frame is composed by hand rather than generated: it is identical on
// every load and every reset, so the piece is well-composed every time and can be
// rehearsed and photographed. Random placement is only used for clouds bought later.
const OPENING_LAYOUT = [
  { key: 'free-a', type: 'free', x: 19, y: 9, size: 40, seed: 101 },
  { key: 'uni-a', type: 'unique', x: 73, y: 14, gb: 2.0, seed: 202 },
  { key: 'sunset', type: 'similar', x: 36, y: 27, groupId: 'sunset', seed: 303 },
  { key: 'uni-b', type: 'unique', x: 82, y: 34, gb: 1.5, seed: 404 },
  { key: 'dog', type: 'similar', x: 24, y: 45, groupId: 'dog', seed: 505 },
  { key: 'free-b', type: 'free', x: 67, y: 50, size: 36, seed: 606 },
  { key: 'screenshots', type: 'similar', x: 70, y: 64, groupId: 'screenshots', seed: 707 },
  { key: 'uni-c', type: 'unique', x: 22, y: 68, gb: 1.2, seed: 808 },
  { key: 'latte', type: 'similar', x: 45, y: 81, groupId: 'latte', seed: 909 },
  { key: 'free-c', type: 'free', x: 82, y: 88, size: 31, seed: 111 },
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
    freedGb: 0,
    freedPhotos: 0,
    purchases: 0,
    spawnSeed: 20260904,
    nudge: null,
    dirty: false,
  }
}
