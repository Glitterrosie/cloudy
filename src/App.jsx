import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { buildInitialState } from './data/initialState.js'
import { skyReducer, selectStats, NOTHING_TO_RAIN_NUDGE } from './state/skyReducer.js'
import { useRain, rainForce } from './state/useRain.js'
import { useIdleReset } from './state/useIdleReset.js'
import {
  usePageVisible,
  useReducedMotion,
  useWakeLock,
  useCloudCap,
} from './state/useEnvironment.js'
import { Sky } from './components/Sky.jsx'
import { StorageBar } from './components/StorageBar.jsx'
import { Legend } from './components/Legend.jsx'
import { Controls } from './components/Controls.jsx'
import { GalleryModal } from './components/GalleryModal.jsx'
import { clamp } from './lib/rng.js'

const formatClock = (d) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

/** The current time, refreshed each time the minute changes. */
function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer
    const tick = () => {
      setNow(new Date())
      timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50)
    }
    timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50)
    return () => clearTimeout(timer)
  }, [])
  return formatClock(now)
}

const WIN_HOLD_MS = 14000

export default function App() {
  const [state, dispatch] = useReducer(skyReducer, undefined, buildInitialState)
  const [openCloudId, setOpenCloudId] = useState(null)
  const [originRect, setOriginRect] = useState(null)
  const skyRef = useRef(null)

  const visible = usePageVisible()
  const reducedMotion = useReducedMotion()
  useWakeLock(visible)

  const stats = useMemo(() => selectStats(state), [state])
  const { raining, drops, level, pour, stop: stopRain } = useRain({ enabled: visible })

  const setSky = useCallback(({ cap, aspect }) => dispatch({ type: 'SET_SKY', cap, aspect }), [])
  useCloudCap(skyRef, setSky)

  const reset = useCallback(() => {
    stopRain()
    setOpenCloudId(null)
    setOriginRect(null)
    dispatch({ type: 'RESET' })
  }, [stopRain])

  // Back to the opening frame for the next visitor, whether they pressed Reset,
  // reloaded, or the last person simply walked away.
  useIdleReset(state.dirty, reset)

  useEffect(() => {
    if (!stats.cleared) return undefined
    const timer = setTimeout(reset, WIN_HOLD_MS)
    return () => clearTimeout(timer)
  }, [stats.cleared, reset])

  // One uncaught error on Tuesday morning shouldn't mean a dead sky until Friday.
  useEffect(() => {
    let last = 0
    const recover = () => {
      const now = Date.now()
      if (now - last < 10000) return
      last = now
      reset()
    }
    window.addEventListener('error', recover)
    window.addEventListener('unhandledrejection', recover)
    return () => {
      window.removeEventListener('error', recover)
      window.removeEventListener('unhandledrejection', recover)
    }
  }, [reset])

  const openCloud = useCallback((cloud, rect) => {
    setOriginRect(rect)
    setOpenCloudId(cloud.id)
  }, [])

  const settleCloud = useCallback((id) => dispatch({ type: 'SETTLE_CLOUD', id }), [])
  const removeCloud = useCallback((id) => dispatch({ type: 'REMOVE_CLOUD', id }), [])

  const buyStorage = useCallback(() => dispatch({ type: 'BUY_STORAGE' }), [])

  // What a press of "Take new pictures" brings is random, and the randomness is
  // drawn here rather than in the reducer, which has to stay pure.
  const addPhotos = useCallback(() => dispatch({ type: 'ADD_PHOTOS', roll: Math.random() }), [])

  // Rain is asked for now, and how hard it comes down is decided by how many
  // duplicate clouds are overhead.
  const makeItRain = useCallback(() => {
    if (stats.similarCount === 0) {
      dispatch({ type: 'NUDGE', message: NOTHING_TO_RAIN_NUDGE })
      return
    }
    pour(rainForce(stats.similarCount))
  }, [pour, stats.similarCount])

  const openGroup = useMemo(() => {
    const cloud = openCloudId ? state.clouds.find((c) => c.id === openCloudId) : null
    const group = cloud?.groupId ? state.groups[cloud.groupId] : null
    if (!group) return null
    // A blue cloud's contents change as photos are added to it or it swallows a
    // neighbour, so its count and size come from the cloud, not from the chunk
    // it started as. Only the thumbnails are the chunk's own.
    if (cloud.type === 'unique') {
      return {
        ...group,
        count: cloud.photos,
        bytes: cloud.bytes,
        label: `${cloud.photos} photos that only exist once`,
      }
    }
    return group
  }, [openCloudId, state.clouds, state.groups])
  const confirmDelete = useCallback(
    (keptIds) => {
      dispatch({ type: 'CLEAN_GROUP', groupId: openGroup?.id, keptIds })
      setOpenCloudId(null)
      setOriginRect(null)
    },
    [openGroup],
  )

  const modalOpen = Boolean(openGroup)

  // Weighted by how many duplicate clouds are left rather than by their share, so
  // the opening sky reads as genuinely heavy and clearing it really lifts the light.
  const clearness = 1 - clamp(stats.similarCount / 6, 0, 1)

  const clock = useClock()

  return (
    <div className="app">
      <div className="device" inert={modalOpen ? '' : undefined}>
        <div className="device__status" aria-hidden="true">
          <span>{clock}</span>
          <span className="device__status-icons">
            <i className="bar" />
            <i className="bar" />
            <i className="wifi" />
            <i className="battery" />
          </span>
        </div>

        <div className="screen">
          <header className="topbar">
            <h1 className="wordmark">Cloudy</h1>
            <button type="button" className="btn btn--ghost" onClick={reset}>
              Reset
            </button>
          </header>

          <StorageBar
            similarBytes={stats.similarBytes}
            uniqueBytes={stats.uniqueBytes}
            freeBytes={stats.freeBytes}
            usedBytes={stats.usedBytes}
            quotaBytes={state.quotaBytes}
            freedBytes={state.freedBytes}
          />

          <Legend />

          <Sky
            ref={skyRef}
            clouds={state.clouds}
            groups={state.groups}
            skyAspect={state.skyAspect}
            clearness={clearness}
            raining={raining}
            drops={drops}
            level={level}
            cleared={stats.cleared}
            freedBytes={state.freedBytes}
            freedPhotos={state.freedPhotos}
            reducedMotion={reducedMotion}
            onOpenCloud={openCloud}
            onSettled={settleCloud}
            onLeft={removeCloud}
          />
        </div>
      </div>

      {/* Outside the phone: these stand in for real-world actions, not widget UI. */}
      <Controls
        onBuyStorage={buyStorage}
        onAddPhotos={addPhotos}
        onMakeItRain={makeItRain}
        nudge={state.nudge}
        nudgeToken={state.nudgeToken}
      />

      {openGroup && (
        <GalleryModal
          group={openGroup}
          originRect={originRect}
          reducedMotion={reducedMotion}
          onCancel={() => {
            setOpenCloudId(null)
            setOriginRect(null)
          }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}
