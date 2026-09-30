import {
  buildInitialState,
  QUOTA_STEP_BYTES,
  MIN_CAPACITY_SHARE,
} from '../data/initialState.js'
import { analyseLibrary } from '../data/library.js'
import { layoutSky, separation } from '../lib/packing.js'
import { mulberry32, between, clamp } from '../lib/rng.js'

export const FULL_SKY_NUDGE = 'Your sky is full. Clean out a slate-blue cloud to make room.'
export const OUT_OF_SPACE_NUDGE =
  'No space left. Buy more storage, or clean out a slate-blue cloud.'
export const NOTHING_TO_RAIN_NUDGE = 'Clear skies. There is nothing left to rain about.'

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
      photos: 0,
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
 * Spread a change in capacity across the white clouds, in proportion to how much
 * each holds. Negative takes space away (photos consuming it), positive hands it
 * back. A cloud emptied below what is readable is marked to leave.
 */
function adjustFree(clouds, delta, floor, excludeId) {
  const free = clouds.filter(
    (c) => c.type === 'free' && c.phase !== 'leaving' && c.id !== excludeId,
  )
  if (!free.length || delta === 0) return clouds
  const total = free.reduce((sum, c) => sum + c.capacity, 0)

  return clouds.map((cloud) => {
    if (cloud.type !== 'free' || cloud.phase === 'leaving' || cloud.id === excludeId) return cloud
    const portion = total > 0 ? cloud.capacity / total : 1 / free.length
    const capacity = Math.max(0, cloud.capacity + delta * portion)
    return capacity < floor ? { ...cloud, capacity, phase: 'leaving' } : { ...cloud, capacity }
  })
}

/**
 * Hand spare capacity back to the sky.
 *
 * Normally it spreads across the white clouds. If there are none left — you have
 * filled every last one — the space has to *become* a white cloud, because space
 * that is in no cloud at all is space the sky has quietly stopped accounting
 * for, and the cloud areas would no longer add up to the quota.
 */
function returnCapacity(clouds, amount, rand, excludeId) {
  if (amount <= 0) return clouds
  const hasFree = clouds.some(
    (c) => c.type === 'free' && c.phase !== 'leaving' && c.id !== excludeId,
  )
  if (hasFree) return adjustFree(clouds, amount, 0, excludeId)

  const spot = seedSpot(rand, clouds)
  return [
    ...clouds,
    {
      id: `c-free-spill-${Math.floor(rand() * 1e6)}`,
      type: 'free',
      groupId: null,
      xPct: spot.x,
      yPct: spot.y,
      capacity: amount,
      bytes: 0,
      photos: 0,
      size: 12,
      seed: Math.floor(rand() * 1e6),
      phase: 'idle',
      entering: true,
    },
  ]
}

/** Give back what a white cloud had spare, or take the shortfall out of the
 *  others if it was too small for what just landed in it. */
function rebalance(clouds, delta, floor, rand, excludeId) {
  return delta >= 0
    ? returnCapacity(clouds, delta, rand, excludeId)
    : adjustFree(clouds, delta, floor, excludeId)
}

/** How many one-off photographs a press brings, and what they weigh. A quick
 *  handful alongside a burst, a proper afternoon's worth when they come alone. */
function uniqueIntake(rand, library, min, max) {
  const perSingle = library.singleBytes / Math.max(1, library.singleCount)
  const count = Math.round(between(rand, min, max))
  return { count, bytes: Math.round(perSingle * count) }
}

/** Which blue chunk of the library a new blue cloud shows, preferring one that no
 *  other cloud is already showing so two clouds don't open onto the same photos. */
function pickUniqueGroup(clouds, rand) {
  const { uniques } = analyseLibrary()
  const taken = new Set(clouds.filter((c) => c.type === 'unique').map((c) => c.groupId))
  const free = uniques.filter((u) => !taken.has(u.id))
  const pool = free.length ? free : uniques
  return pool[Math.floor(rand() * pool.length)].id
}

/** Put a batch of one-off photographs somewhere. `fresh` asks for a brand new blue
 *  cloud (a white one filling up); otherwise they go into the smallest existing
 *  blue cloud, which is also what happens whenever there is no white to fill.
 *  Returns null when there is nowhere for them to go. */
function absorbUnique(clouds, intake, floor, rand, { fresh = false, reservedId } = {}) {
  const target = clouds
    .filter((c) => c.type === 'unique' && c.phase !== 'leaving')
    .sort((a, b) => a.capacity - b.capacity)[0]

  const host = clouds
    .filter((c) => c.type === 'free' && c.phase !== 'leaving' && c.id !== reservedId)
    .sort((a, b) => b.capacity - a.capacity)[0]

  if (target && !(fresh && host)) {
    const next = adjustFree(clouds, -intake.bytes, floor)
    return next.map((c) =>
      c.id === target.id
        ? {
            ...c,
            capacity: c.capacity + intake.bytes,
            bytes: c.bytes + intake.bytes,
            photos: c.photos + intake.count,
          }
        : c,
    )
  }

  if (!host) return null

  const groupId = pickUniqueGroup(clouds, rand)
  const next = clouds.map((c) =>
    c.id === host.id
      ? {
          ...c,
          type: 'unique',
          groupId,
          capacity: intake.bytes,
          bytes: intake.bytes,
          photos: intake.count,
          filling: (c.filling ?? 0) + 1,
        }
      : c,
  )
  return rebalance(next, host.capacity - intake.bytes, floor, rand, host.id)
}

/** Chance of each outcome for one press of "Take new pictures". */
const CHANCE_DUPES_ONLY = 0.34
const CHANCE_UNIQUE_ONLY = 0.28 // the rest, 0.38, is both

/**
 * Taking new pictures fills the space you already have — with whatever the
 * afternoon happened to produce.
 *
 * That is deliberately not the same thing every time. A press might bring a burst
 * of near-identical frames, or a handful of ordinary one-off photographs, or both
 * at once, and which burst it is comes up at random from the ones not yet in the
 * sky. `roll` is the randomness, supplied by the caller so the reducer stays pure.
 *
 * The only thing that can stop you is running out of room. Where the photos go
 * depends on what is up there: a white cloud big enough to hold a burst is filled
 * in and changes colour, because that is literally what happens to free space;
 * otherwise a new cloud appears. One-offs either grow a blue cloud or, some of the
 * time, fill a white one and make a new blue cloud of their own.
 */
function addPhotos(state, roll) {
  const library = analyseLibrary()
  const stats = selectStats(state)

  const seed = roll == null ? state.spawnSeed : (state.spawnSeed ^ Math.floor(roll * 4294967296)) >>> 0
  const rand = mulberry32(seed)

  const unused = library.stacks.filter((s) => !state.usedStackIds.includes(s.id))
  const next = unused.length ? unused[Math.floor(rand() * unused.length)] : null

  const r = rand()
  let mode = !next ? 'unique' : r < CHANCE_DUPES_ONLY ? 'dupes' : r < CHANCE_DUPES_ONLY + CHANCE_UNIQUE_ONLY ? 'unique' : 'both'
  const intake =
    mode === 'unique'
      ? uniqueIntake(rand, library, 5, 24)
      : uniqueIntake(rand, library, 3, 12)
  const stackBytes = next ? next.bytes : 0

  // If what was rolled does not fit, settle for whatever part of it does rather
  // than refusing the press outright.
  const fits = (need) => stats.freeBytes >= need
  if (mode === 'both' && !fits(stackBytes + intake.bytes)) mode = fits(stackBytes) ? 'dupes' : 'unique'
  if (mode === 'dupes' && !fits(stackBytes)) mode = 'unique'
  if (mode === 'unique' && !fits(intake.bytes)) return withNudge(state, OUT_OF_SPACE_NUDGE)

  const wantsStack = mode !== 'unique'
  const wantsUnique = mode !== 'dupes'

  const floor = state.quotaBytes * MIN_CAPACITY_SHARE
  const advance = (patch) => ({
    ...state,
    ...patch,
    spawnSeed: (state.spawnSeed * 1664525 + 1013904223) >>> 0,
    nudge: null,
    dirty: true,
  })

  let clouds = state.clouds
  let host = null

  if (wantsStack) {
    host = clouds
      .filter((c) => c.type === 'free' && c.phase !== 'leaving')
      .sort((a, b) => b.capacity - a.capacity)[0]

    // A white cloud that can hold the whole stack simply fills up and turns slate.
    const fillsAWhiteCloud = host && (host.capacity >= stackBytes || clouds.length >= state.cloudCap)

    if (fillsAWhiteCloud) {
      clouds = clouds.map((c) =>
        c.id === host.id
          ? {
              ...c,
              type: 'similar',
              groupId: next.id,
              capacity: stackBytes,
              bytes: stackBytes,
              photos: next.count,
              filling: (c.filling ?? 0) + 1,
            }
          : c,
      )
      // Whatever the white cloud had spare goes back to the others; if it was too
      // small, the shortfall comes out of them instead.
      clouds = rebalance(clouds, host.capacity - stackBytes, floor, rand, host.id)
    } else {
      host = null
      clouds = adjustFree(clouds, -stackBytes, floor)
      const spot = seedSpot(rand, clouds)
      clouds = [
        ...clouds,
        {
          id: `c-sim-${next.id}`,
          type: 'similar',
          groupId: next.id,
          xPct: spot.x,
          yPct: spot.y,
          capacity: stackBytes,
          bytes: stackBytes,
          photos: next.count,
          size: 12,
          seed: Math.floor(rand() * 1e6),
          phase: 'idle',
          entering: true,
        },
      ]
    }
  }

  if (wantsUnique) {
    // On their own the one-offs sometimes get a blue cloud of their own; next to a
    // burst they just top one up, so a single press never rearranges the whole sky.
    const fresh = mode === 'unique' && rand() < 0.4 && clouds.length < state.cloudCap
    const placed = absorbUnique(clouds, intake, floor, rand, { fresh, reservedId: host?.id })
    if (placed) clouds = placed
    else if (!wantsStack) return withNudge(state, OUT_OF_SPACE_NUDGE)
  }

  return advance(
    wantsStack
      ? {
          clouds,
          groups: { ...state.groups, [next.id]: next },
          usedStackIds: [...state.usedStackIds, next.id],
        }
      : { clouds },
  )
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
    if (c.id === target.id) return { ...c, type: 'free', phase: 'freed', bytes: 0, photos: 0 }
    if (c.id === nearestId) {
      return { ...c, bytes: c.bytes + keptBytes, photos: c.photos + keptCount }
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

/**
 * Below this separation two clouds of the same kind are so far inside one
 * another that reading them as two is a fiction. 1 is exactly touching.
 *
 * Measured against the real sky rather than picked: the opening layout sits at
 * 1.54 and above, one purchase brings the white clouds to about 0.97 and two to
 * about 0.91 — still legibly separate, and the sky is *supposed* to get busier
 * when you buy your way out. Only by the third purchase do they pile up around
 * 0.85, which is where merging starts to earn its place.
 */
const MERGE_SEPARATION = 0.88

/**
 * The gentler limit, used only for a cloud that has just been emptied: merely
 * touching is enough. Space you have just freed coalesces with the free space
 * beside it, the way deleting files does — the reward for cleaning out a stack
 * should be one honest expanse of white, not a litter of small clouds. Space you
 * have just *bought* deliberately does not coalesce, because a purchase is meant
 * to show up as more sky to fill.
 *
 * A cleared cloud settles at about 1.00 against its neighbours and the opening
 * sky's white clouds sit at 1.49 apart, so this catches the first and not the
 * second.
 */
const MERGE_CONTACT = 1.06

/**
 * Merge clouds of the same kind that have ended up in the same piece of sky.
 *
 * Only white and light-blue clouds do this, and it is not cosmetic: one white
 * cloud of 60 MB says the same thing as three of 20 MB stacked on top of each
 * other, and says it legibly. Slate-blue clouds never merge — each one is a
 * particular stack of photographs you can open, and fusing two would mean
 * inventing a stack that does not exist in the library.
 *
 * Merging is only ever triggered by genuine crowding: after a full packing pass
 * clouds sit shoulder to shoulder, so an overlap this deep means the packer ran
 * out of room, which is exactly when the sky needs simplifying.
 *
 * The absorbed cloud hands over everything it holds immediately and leaves as an
 * empty husk, so the storage bar never flickers down and back up again.
 */
function mergeCrowded(state, coalesceId = null) {
  const laid = layoutSky(state.clouds, state.skyAspect)
  const candidates = laid.filter(
    (c) => (c.type === 'free' || c.type === 'unique') && c.phase === 'idle' && !c.entering,
  )
  if (candidates.length < 2) return state

  const parent = new Map(candidates.map((c) => [c.id, c.id]))
  const find = (id) => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)
    while (parent.get(id) !== root) {
      const next = parent.get(id)
      parent.set(id, root)
      id = next
    }
    return root
  }

  let merged = false
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i]
      const b = candidates[j]
      if (a.type !== b.type) continue
      if (find(a.id) === find(b.id)) continue
      const limit =
        a.id === coalesceId || b.id === coalesceId ? MERGE_CONTACT : MERGE_SEPARATION
      if (separation(a, b, state.skyAspect) > limit) continue
      parent.set(find(b.id), find(a.id))
      merged = true
    }
  }
  if (!merged) return state

  // The biggest cloud in each group is the one that stays, so the merge reads as
  // its neighbours folding into it rather than as everything jumping somewhere new.
  const survivors = new Map()
  candidates.forEach((cloud) => {
    const root = find(cloud.id)
    const held = survivors.get(root)
    if (!held || cloud.capacity > held.capacity) survivors.set(root, cloud)
  })

  const gains = new Map()
  const absorbed = new Map()
  candidates.forEach((cloud) => {
    const keeper = survivors.get(find(cloud.id))
    if (!keeper || keeper.id === cloud.id) return
    const gain = gains.get(keeper.id) ?? { capacity: 0, bytes: 0, photos: 0 }
    gain.capacity += cloud.capacity
    gain.bytes += cloud.bytes
    gain.photos += cloud.photos
    gains.set(keeper.id, gain)
    absorbed.set(cloud.id, keeper.id)
  })
  if (!absorbed.size) return state

  return {
    ...state,
    clouds: state.clouds.map((cloud) => {
      const gain = gains.get(cloud.id)
      if (gain) {
        return {
          ...cloud,
          capacity: cloud.capacity + gain.capacity,
          bytes: cloud.bytes + gain.bytes,
          photos: cloud.photos + gain.photos,
        }
      }
      if (absorbed.has(cloud.id)) {
        return { ...cloud, capacity: 0, bytes: 0, photos: 0, phase: 'leaving' }
      }
      return cloud
    }),
  }
}

/** A cloud that has finished leaving hands its space to the nearest free cloud,
 *  so the quota still adds up and the gap closes rather than staying a hole. */
function removeCloud(state, id) {
  const going = state.clouds.find((c) => c.id === id)
  if (!going) return state
  const others = state.clouds.filter((c) => c.id !== id)
  // A white cloud by preference. Failing that, anything still standing — the
  // space has to land somewhere, or the sky stops adding up to the quota.
  const heir =
    others.find((c) => c.type === 'free' && c.phase !== 'leaving') ??
    others
      .filter((c) => c.phase !== 'leaving')
      .sort((a, b) => b.capacity - a.capacity)[0]

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
      return addPhotos(state, action.roll)

    case 'CLEAN_GROUP':
      return cleanGroup(state, action)

    // Ends an entrance or an emptying transition. The cloud itself stays — and
    // this is where a cloud first counts as settled, so it is the moment to ask
    // whether it has landed on top of one of its own kind. A cloud arriving from
    // the "freed" phase has just been emptied, and gets the gentler limit.
    case 'SETTLE_CLOUD': {
      const settling = state.clouds.find((c) => c.id === action.id)
      return mergeCrowded(
        {
          ...state,
          clouds: state.clouds.map((c) =>
            c.id === action.id ? { ...c, phase: 'idle', entering: false } : c,
          ),
        },
        settling?.phase === 'freed' ? action.id : null,
      )
    }

    case 'REMOVE_CLOUD':
      return mergeCrowded(removeCloud(state, action.id))

    case 'NUDGE':
      return withNudge(state, action.message)

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

  return {
    similarCount: similar.length,
    cloudCount: live.length,
    similarBytes,
    uniqueBytes,
    usedBytes,
    freeBytes,
    atCap: live.length >= state.cloudCap,
    cleared: state.dirty && similar.length === 0,
  }
}
