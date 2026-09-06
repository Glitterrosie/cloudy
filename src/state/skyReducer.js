import {
  buildInitialState,
  QUOTA_STEP_BYTES,
  MIN_CAPACITY_SHARE,
} from '../data/initialState.js'
import { analyseLibrary } from '../data/library.js'
import { mulberry32, between, clamp } from '../lib/rng.js'

export const FULL_SKY_NUDGE = 'Your sky is full. Clean out a slate-blue cloud to make room.'
export const OUT_OF_SPACE_NUDGE =
  'No space left. Buy more storage, or clean out a slate-blue cloud.'
export const NOTHING_NEW_NUDGE = 'That is every stack of duplicates in the library.'

// The token re-triggers the message animation, so pressing a blocked button
// visibly does something rather than looking broken.
const withNudge = (state, nudge) => ({
  ...state,
  nudge,
  nudgeToken: (state.nudgeToken ?? 0) + 1,
})

/** Somewhere near an existing cloud, so a new one bubbles up into the pack
 *  rather than teleporting into a corner. Packing settles it from there. */
function seedSpot(rand, clouds) {
  if (!clouds.length) return { x: 50, y: 70 }
  const near = clouds[Math.floor(rand() * clouds.length)]
  return {
    x: clamp(near.xPct + between(rand, -14, 14), 14, 86),
    y: clamp(near.yPct + between(rand, 6, 26), 12, 94),
  }
}

/**
 * Buying storage adds clouds — and only empty ones, sized to what you bought.
 *
 * New capacity is space you have paid for and not yet filled, so it arrives as
 * white free-space clouds whose area is exactly the storage added. Your sky gets
 * busier without a single new photo in it.
 */
function spawnClouds(state) {
  const rand = mulberry32(state.spawnSeed)
  const clouds = [...state.clouds]
  const room = Math.max(0, state.cloudCap - clouds.length)
  const count = Math.max(1, Math.min(rand() < 0.5 ? 2 : 3, room))
  // The purchase is split between them, so together they are worth exactly the
  // storage bought — two clouds of 25 MB, not two token puffs.
  const share = QUOTA_STEP_BYTES / count

  for (let i = 0; i < count; i += 1) {
    const spot = seedSpot(rand, clouds)
    clouds.push({
      id: `c-free-${state.purchases}-${i}-${Math.floor(rand() * 1e6)}`,
      type: 'free',
      groupId: null,
      xPct: spot.x,
      yPct: spot.y,
      capacity: share,
      bytes: 0,
      size: 12,
      seed: Math.floor(rand() * 1e6),
      phase: 'idle',
      entering: true,
    })
  }

  return {
    ...state,
    clouds,
    quotaBytes: state.quotaBytes + QUOTA_STEP_BYTES,
    purchases: state.purchases + 1,
    spawnSeed: (state.spawnSeed * 1664525 + 1013904223) >>> 0,
    nudge: null,
    dirty: true,
  }
}

/**
 * Taking new photos fills the space you already have.
 *
 * The next stack the detector found becomes a slate-blue cloud, and that much
 * capacity is taken out of the white clouds — space does not come from nowhere.
 * A white cloud emptied below what is readable is marked to leave.
 */
function addPhotos(state) {
  const { stacks } = analyseLibrary()
  const next = stacks.find((s) => !state.usedStackIds.includes(s.id))
  if (!next) return withNudge(state, NOTHING_NEW_NUDGE)

  const stats = selectStats(state)
  if (stats.freeBytes < next.bytes) return withNudge(state, OUT_OF_SPACE_NUDGE)
  if (state.clouds.length >= state.cloudCap) return withNudge(state, FULL_SKY_NUDGE)

  const rand = mulberry32(state.spawnSeed)
  const floor = state.quotaBytes * MIN_CAPACITY_SHARE

  // Take the new photos' space out of the free clouds, each giving up the same
  // proportion. Scaling against a running remainder instead would not add up to
  // the space actually needed, and the sky would slowly stop matching the quota.
  const takeShare = clamp(next.bytes / Math.max(1, stats.freeBytes), 0, 1)
  const clouds = state.clouds.map((cloud) => {
    if (cloud.type !== 'free') return cloud
    const capacity = cloud.capacity * (1 - takeShare)
    return capacity < floor ? { ...cloud, capacity, phase: 'leaving' } : { ...cloud, capacity }
  })

  const spot = seedSpot(rand, clouds)
  clouds.push({
    id: `c-sim-${next.id}`,
    type: 'similar',
    groupId: next.id,
    xPct: spot.x,
    yPct: spot.y,
    capacity: next.bytes,
    bytes: next.bytes,
    size: 12,
    seed: Math.floor(rand() * 1e6),
    phase: 'idle',
    entering: true,
  })

  return {
    ...state,
    clouds,
    groups: { ...state.groups, [next.id]: next },
    usedStackIds: [...state.usedStackIds, next.id],
    spawnSeed: (state.spawnSeed * 1664525 + 1013904223) >>> 0,
    nudge: null,
    dirty: true,
  }
}

function cleanGroup(state, { groupId, keptIds }) {
  const group = state.groups[groupId]
  if (!group || group.cleaned) return state

  const target = state.clouds.find((c) => c.groupId === groupId)
  if (!target) return state

  // Deleting a stack keeps a favourite or two. Their share stays in the library,
  // so the storage bar keeps telling the truth.
  const keptCount = Math.max(1, keptIds.length)
  const keptBytes = Math.round((group.bytes / group.count) * keptCount)

  let nearestId = null
  let nearestDistance = Infinity
  state.clouds.forEach((c) => {
    if (c.type !== 'unique' || c.phase !== 'idle') return
    const distance = Math.hypot(c.xPct - target.xPct, (c.yPct - target.yPct) * state.skyAspect)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestId = c.id
    }
  })

  const clouds = state.clouds.map((c) => {
    // The cloud keeps every byte of space it had. It is simply empty now.
    if (c.id === target.id) return { ...c, type: 'free', phase: 'freed', bytes: 0 }
    if (c.id === nearestId) return { ...c, bytes: c.bytes + keptBytes }
    return c
  })

  return {
    ...state,
    clouds,
    groups: {
      ...state.groups,
      [groupId]: { ...group, cleaned: true, keptCount },
    },
    freedBytes: state.freedBytes + Math.max(0, group.bytes - keptBytes),
    freedPhotos: state.freedPhotos + Math.max(0, group.count - keptCount),
    nudge: null,
    dirty: true,
  }
}

/** A cloud that has finished leaving hands its space to the nearest free cloud,
 *  so the quota still adds up and the gap closes rather than staying a hole. */
function removeCloud(state, id) {
  const going = state.clouds.find((c) => c.id === id)
  if (!going) return state
  const others = state.clouds.filter((c) => c.id !== id)
  const heir = others.find((c) => c.type === 'free' && c.phase !== 'leaving')

  return {
    ...state,
    clouds: others.map((c) =>
      heir && c.id === heir.id ? { ...c, capacity: c.capacity + Math.max(0, going.capacity) } : c,
    ),
  }
}

export function skyReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return {
        ...buildInitialState(),
        cloudCap: state.cloudCap,
        skyAspect: state.skyAspect,
      }

    case 'SET_SKY':
      if (state.cloudCap === action.cap && state.skyAspect === action.aspect) return state
      return { ...state, cloudCap: action.cap, skyAspect: action.aspect }

    case 'BUY_STORAGE':
      if (state.clouds.length >= state.cloudCap) {
        return withNudge(state, FULL_SKY_NUDGE)
      }
      return spawnClouds(state)

    case 'ADD_PHOTOS':
      return addPhotos(state)

    case 'CLEAN_GROUP':
      return cleanGroup(state, action)

    // Ends an entrance or an emptying transition. The cloud itself stays.
    case 'SETTLE_CLOUD':
      return {
        ...state,
        clouds: state.clouds.map((c) =>
          c.id === action.id ? { ...c, phase: 'idle', entering: false } : c,
        ),
      }

    case 'REMOVE_CLOUD':
      return removeCloud(state, action.id)

    case 'CLEAR_NUDGE':
      return state.nudge ? { ...state, nudge: null } : state

    default:
      return state
  }
}

// --- derived values -------------------------------------------------------

export function selectStats(state) {
  const live = state.clouds.filter((c) => c.phase !== 'leaving')
  const similar = live.filter((c) => c.type === 'similar')
  const unique = live.filter((c) => c.type === 'unique')
  const similarBytes = similar.reduce((sum, c) => sum + c.bytes, 0)
  const uniqueBytes = unique.reduce((sum, c) => sum + c.bytes, 0)
  const usedBytes = similarBytes + uniqueBytes
  const freeBytes = Math.max(0, state.quotaBytes - usedBytes)

  // "The more clouds with similar data you have, the higher the probability of
  // being rained on" — so this counts duplicate clouds rather than taking their
  // share of the sky. Buying empty storage must not quietly stop the rain.
  const intensity = clamp(similar.length / 6, 0, 1)

  return {
    similarCount: similar.length,
    cloudCount: live.length,
    similarBytes,
    uniqueBytes,
    usedBytes,
    freeBytes,
    intensity,
    atCap: live.length >= state.cloudCap,
    cleared: state.dirty && similar.length === 0,
  }
}
