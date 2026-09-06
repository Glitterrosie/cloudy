import {
  buildInitialState,
  QUOTA_STEP_BYTES,
  sizeForBytes,
  MIN_FREE_SIZE,
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

// A cloud drawn at `size` percent of panel width is about 0.68 as tall as it is
// wide, and only the middle band of that is solid shape.
const halfWidth = (size) => size * 0.5
const halfHeight = (size) => size * 0.3

/**
 * Place a new cloud in the roomiest gap available.
 *
 * Works in "percent of panel width" for both axes — y percentages are scaled by
 * the panel's aspect ratio first, otherwise vertical distances are compared
 * against horizontal ones on the wrong scale and clouds end up stacked. Scores
 * candidates by edge-to-edge clearance rather than centre distance, so a big
 * cloud is given the room it actually occupies.
 */
function clearanceAt(x, y, clouds, size, aspect) {
  let clearance = Infinity
  clouds.forEach((c) => {
    const dx = Math.abs(c.xPct - x) - (halfWidth(c.size) + halfWidth(size))
    const dy = Math.abs(c.yPct - y) * aspect - (halfHeight(c.size) + halfHeight(size)) * aspect
    // Positive on either axis means the two boxes already miss each other.
    clearance = Math.min(clearance, Math.max(dx, dy))
  })
  return clearance
}

function findSpot(rand, clouds, size, aspect, candidates = []) {
  let best = null
  let bestClearance = -Infinity

  // Any positions the caller already has in mind get considered first.
  for (const candidate of candidates) {
    const clearance = clearanceAt(candidate.x, candidate.y, clouds, size, aspect)
    if (clearance > bestClearance) {
      bestClearance = clearance
      best = candidate
    }
  }

  for (let i = 0; i < 48; i += 1) {
    const x = between(rand, 16, 84)
    const y = between(rand, 8, 92)
    const clearance = clearanceAt(x, y, clouds, size, aspect)
    if (clearance > bestClearance) {
      bestClearance = clearance
      best = { x, y }
      if (clearance > 4) break // roomy enough; stop looking
    }
  }

  return best ?? { x: 50, y: 50 }
}

/**
 * Buying storage adds clouds — and only empty ones.
 *
 * New capacity is space you have paid for and not yet filled, so it arrives as
 * white free-space clouds. Your sky gets more crowded without a single new photo
 * in it, which is the point the concept makes: more storage is more clouds.
 */
function spawnClouds(state) {
  const rand = mulberry32(state.spawnSeed)
  const clouds = [...state.clouds]
  const room = Math.max(0, state.cloudCap - clouds.length)
  const wanted = rand() < 0.5 ? 3 : 2

  for (let i = 0; i < Math.min(wanted, room); i += 1) {
    // Later purchases arrive as smaller slivers of free space, so a filling sky
    // stays legible instead of turning into overlapping blobs.
    const crowding = clamp(1 - clouds.length * 0.025, 0.55, 1)
    const size = Math.max(MIN_FREE_SIZE, between(rand, 21, 29) * crowding)
    const spot = findSpot(rand, clouds, size, state.skyAspect)
    clouds.push({
      id: `c-free-${state.purchases}-${i}-${Math.floor(rand() * 1e6)}`,
      type: 'free',
      groupId: null,
      xPct: spot.x,
      yPct: spot.y,
      size,
      bytes: 0,
      seed: Math.floor(rand() * 1e6),
      phase: 'idle',
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
 * Taking new photos fills the space you have.
 *
 * The next stack the detector found appears as a slate-blue cloud, and the white
 * free-space clouds shrink to pay for it — space does not come from nowhere. A
 * white cloud that shrinks past being readable has been used up, and goes.
 */
function addPhotos(state) {
  const { stacks } = analyseLibrary()
  const next = stacks.find((s) => !state.usedStackIds.includes(s.id))
  if (!next) return withNudge(state, NOTHING_NEW_NUDGE)

  const stats = selectStats(state)
  if (stats.freeBytes <= next.bytes * 0.25) return withNudge(state, OUT_OF_SPACE_NUDGE)
  if (state.clouds.length >= state.cloudCap) return withNudge(state, FULL_SKY_NUDGE)

  const rand = mulberry32(state.spawnSeed)

  // Free space shrinks by roughly what the new photos take up.
  const eaten = clamp(next.bytes / Math.max(1e6, stats.freeBytes), 0.12, 0.55)
  const shrunk = state.clouds.map((c) =>
    c.type === 'free' ? { ...c, size: c.size * (1 - eaten) } : c,
  )
  const usedUp = shrunk.filter((c) => c.type === 'free' && c.size < MIN_FREE_SIZE)
  const clouds = shrunk.filter((c) => c.type !== 'free' || c.size >= MIN_FREE_SIZE)

  const size = sizeForBytes(next.bytes)
  // New photos would naturally take the room the free space just gave up, so
  // those spots are offered first — but a used-up sliver is smaller than the
  // stack replacing it, so they only win if they are genuinely the roomiest.
  const spot = findSpot(
    rand,
    clouds,
    size,
    state.skyAspect,
    usedUp.map((c) => ({ x: c.xPct, y: c.yPct })),
  )
  clouds.push({
    id: `c-sim-${next.id}`,
    type: 'similar',
    groupId: next.id,
    xPct: spot.x,
    yPct: spot.y,
    size,
    bytes: next.bytes,
    seed: Math.floor(rand() * 1e6),
    phase: 'idle',
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

  // Deleting a stack keeps a favourite or two. Their share of the stack stays
  // in your library, so the storage bar keeps telling the truth.
  const keptCount = Math.max(1, keptIds.length)
  const perPhoto = group.bytes / group.count
  const keptBytes = Math.round(perPhoto * keptCount)

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
    // The cloud stays: it is storage you still own, now empty.
    if (c.id === target.id) return { ...c, type: 'free', phase: 'freed', bytes: 0 }
    if (c.id === nearestId) {
      const bytes = c.bytes + keptBytes
      return { ...c, bytes, size: sizeForBytes(bytes) }
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
    freedBytes: state.freedBytes + Math.max(0, group.bytes - keptBytes),
    freedPhotos: state.freedPhotos + Math.max(0, group.count - keptCount),
    nudge: null,
    dirty: true,
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

    // Only ends the transition animation — the emptied cloud itself stays.
    case 'SETTLE_CLOUD':
      return {
        ...state,
        clouds: state.clouds.map((c) => (c.id === action.id ? { ...c, phase: 'idle' } : c)),
      }

    case 'CLEAR_NUDGE':
      return state.nudge ? { ...state, nudge: null } : state

    default:
      return state
  }
}

// --- derived values -------------------------------------------------------

export function selectStats(state) {
  const live = state.clouds
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
