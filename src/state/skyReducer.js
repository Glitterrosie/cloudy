import { buildInitialState, QUOTA_STEP_GB, sizeForGb } from '../data/initialState.js'
import { makeGroup, SPAWN_GROUP_IDS } from '../data/photoGroups.js'
import { mulberry32, between, clamp } from '../lib/rng.js'
import { photosToGb } from '../lib/format.js'

export const FULL_SKY_NUDGE =
  'More storage, more clouds. The slate-blue ones are still full of near-duplicates.'

// Spread new clouds out a little: try a few spots, keep the one furthest from
// everything already up there. Cheap, deterministic, and stops clouds stacking.
function findSpot(rand, clouds) {
  let best = null
  let bestDistance = -1
  for (let i = 0; i < 6; i += 1) {
    const x = between(rand, 18, 82)
    const y = between(rand, 10, 88)
    let nearest = Infinity
    clouds.forEach((c) => {
      const dx = c.xPct - x
      const dy = (c.yPct - y) * 0.55 // the panel is taller than it is wide
      nearest = Math.min(nearest, Math.hypot(dx, dy))
    })
    if (nearest > bestDistance) {
      bestDistance = nearest
      best = { x, y }
    }
  }
  return best
}

function spawnClouds(state) {
  const rand = mulberry32(state.spawnSeed)
  const groups = { ...state.groups }
  const clouds = [...state.clouds]
  const usedGroups = new Set(Object.keys(groups))
  const available = SPAWN_GROUP_IDS.filter((id) => !usedGroups.has(id))

  // New storage always arrives as free space...
  const freeSpot = findSpot(rand, clouds)
  clouds.push({
    id: `c-free-${state.purchases}-${Math.floor(rand() * 1e6)}`,
    type: 'free',
    groupId: null,
    xPct: freeSpot.x,
    yPct: freeSpot.y,
    size: between(rand, 27, 35),
    gb: 0,
    seed: Math.floor(rand() * 1e6),
    phase: 'idle',
  })

  // ...and then habits fill it. Mostly with more of what you already have too much of.
  const extra = rand() < 0.55 ? 2 : 1
  for (let i = 0; i < extra; i += 1) {
    const makeSimilar = available.length > 0 && rand() < 0.72
    const spot = findSpot(rand, clouds)
    if (makeSimilar) {
      const id = available.shift()
      const group = makeGroup(id)
      groups[id] = group
      clouds.push({
        id: `c-sim-${id}`,
        type: 'similar',
        groupId: id,
        xPct: spot.x,
        yPct: spot.y,
        size: sizeForGb(group.gb),
        gb: group.gb,
        seed: Math.floor(rand() * 1e6),
        phase: 'idle',
      })
    } else {
      const gb = between(rand, 0.4, 1.1)
      clouds.push({
        id: `c-uni-${state.purchases}-${i}-${Math.floor(rand() * 1e6)}`,
        type: 'unique',
        groupId: null,
        xPct: spot.x,
        yPct: spot.y,
        size: sizeForGb(gb),
        gb,
        seed: Math.floor(rand() * 1e6),
        phase: 'idle',
      })
    }
  }

  return {
    ...state,
    clouds,
    groups,
    quotaGb: state.quotaGb + QUOTA_STEP_GB,
    purchases: state.purchases + 1,
    spawnSeed: (state.spawnSeed * 1664525 + 1013904223) >>> 0,
    nudge: null,
    dirty: true,
  }
}

function cleanGroup(state, { groupId, keptIds }) {
  const group = state.groups[groupId]
  if (!group || group.cleaned) return state

  const keptCount = Math.max(1, keptIds.length)
  const keptGb = photosToGb(keptCount)
  const target = state.clouds.find((c) => c.groupId === groupId)
  if (!target) return state

  // The photos you keep don't evaporate — they become unique data on the nearest
  // blue cloud, so the storage bar keeps telling the truth.
  let nearestId = null
  let nearestDistance = Infinity
  state.clouds.forEach((c) => {
    if (c.type !== 'unique' || c.phase !== 'idle') return
    const distance = Math.hypot(c.xPct - target.xPct, (c.yPct - target.yPct) * 0.55)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestId = c.id
    }
  })

  const clouds = state.clouds.map((c) => {
    if (c.id === target.id) return { ...c, type: 'free', phase: 'freed', gb: 0 }
    if (c.id === nearestId) {
      const gb = c.gb + keptGb
      return { ...c, gb, size: sizeForGb(gb) }
    }
    return c
  })

  return {
    ...state,
    clouds,
    groups: {
      ...state.groups,
      [groupId]: { ...group, cleaned: true, keptCount },
    },
    freedGb: state.freedGb + Math.max(0, group.gb - keptGb),
    freedPhotos: state.freedPhotos + Math.max(0, group.count - keptCount),
    nudge: null,
    dirty: true,
  }
}

export function skyReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return { ...buildInitialState(), cloudCap: state.cloudCap }

    case 'SET_CAP':
      return state.cloudCap === action.cap ? state : { ...state, cloudCap: action.cap }

    case 'BUY_STORAGE':
      if (state.clouds.length >= state.cloudCap) {
        return { ...state, nudge: FULL_SKY_NUDGE }
      }
      return spawnClouds(state)

    case 'CLEAN_GROUP':
      return cleanGroup(state, action)

    case 'REMOVE_CLOUD':
      return { ...state, clouds: state.clouds.filter((c) => c.id !== action.id) }

    case 'CLEAR_NUDGE':
      return state.nudge ? { ...state, nudge: null } : state

    default:
      return state
  }
}

// --- derived values -------------------------------------------------------

export function selectStats(state) {
  const live = state.clouds.filter((c) => c.phase !== 'clearing')
  const similar = live.filter((c) => c.type === 'similar')
  const unique = live.filter((c) => c.type === 'unique')
  const similarGb = similar.reduce((sum, c) => sum + c.gb, 0)
  const uniqueGb = unique.reduce((sum, c) => sum + c.gb, 0)
  const usedGb = similarGb + uniqueGb
  const freeGb = Math.max(0, state.quotaGb - usedGb)

  // Rain follows the share of the sky that is near-duplicates.
  const intensity = clamp(similar.length / Math.max(1, live.length), 0, 1)

  return {
    similarCount: similar.length,
    cloudCount: live.length,
    similarGb,
    uniqueGb,
    usedGb,
    freeGb,
    intensity,
    atCap: live.length >= state.cloudCap,
    cleared: state.dirty && similar.length === 0,
  }
}
