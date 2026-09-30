import { forwardRef, useEffect, useMemo, useState } from 'react'
import { Cloud } from './Cloud.jsx'
import { RainOverlay } from './RainOverlay.jsx'
import { SunBurst } from './SunBurst.jsx'
import { mixHex } from '../lib/color.js'
import { layoutSky } from '../lib/packing.js'
import { formatSize, formatCount } from '../lib/format.js'

// A wide enough range that clearing the sky is felt, not just noticed: a global
// brightness change is what reads in fifteen seconds, a single cloud is not.
export const SKY_HEAVY = '#96B2CC'
export const SKY_CLEAR = '#E2F2FE'

// How long the sun and the message stay before leaving together.
const CELEBRATE_MS = 6000

export const Sky = forwardRef(function Sky(
  {
    clouds,
    groups,
    skyAspect,
    clearness,
    raining,
    drops,
    level,
    cleared,
    freedBytes,
    freedPhotos,
    reducedMotion,
    onOpenCloud,
    onSettled,
    onLeft,
  },
  ref,
) {
  // Sizes come from each cloud's share of the quota, then everything is packed
  // so the sky fills up like bubbles in a glass. Recomputed only when the set of
  // clouds actually changes, not on every render.
  const packed = useMemo(
    () => layoutSky(clouds, skyAspect),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clouds, skyAspect],
  )

  // The sun and the message come out together and go together; the sky itself
  // stays clear afterwards.
  const [celebrating, setCelebrating] = useState(false)
  useEffect(() => {
    if (!cleared) {
      setCelebrating(false)
      return undefined
    }
    setCelebrating(true)
    const timer = setTimeout(() => setCelebrating(false), CELEBRATE_MS)
    return () => clearTimeout(timer)
  }, [cleared])

  return (
    <div
      className="sky"
      ref={ref}
      style={{ backgroundColor: mixHex(SKY_HEAVY, SKY_CLEAR, clearness) }}
    >
      <div className="sky__glow" style={{ opacity: clearness }} />
      <SunBurst visible={celebrating} />

      {packed.map((cloud) => (
        <Cloud
          key={cloud.id}
          cloud={cloud}
          group={cloud.groupId ? groups[cloud.groupId] : null}
          reducedMotion={reducedMotion}
          onOpen={onOpenCloud}
          onSettled={onSettled}
          onLeft={onLeft}
        />
      ))}

      <RainOverlay raining={raining} drops={drops} level={level} />

      {cleared && (
        <div className={`sky__win ${celebrating ? '' : 'is-gone'}`} role="status">
          <p className="sky__win-line">Clear skies.</p>
          <p className="sky__win-sub">
            You freed {formatSize(freedBytes)}, that is {formatCount(freedPhotos)} photos you were never
            going to look at.
          </p>
        </div>
      )}
    </div>
  )
})
