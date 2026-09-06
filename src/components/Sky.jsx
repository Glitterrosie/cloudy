import { forwardRef, useMemo } from 'react'
import { Cloud } from './Cloud.jsx'
import { RainOverlay } from './RainOverlay.jsx'
import { SunBurst, StormFlash } from './SunBurst.jsx'
import { mixHex } from '../lib/color.js'
import { layoutSky } from '../lib/packing.js'
import { formatSize, formatCount } from '../lib/format.js'

// A wide enough range that clearing the sky is felt, not just noticed: a global
// brightness change is what reads in fifteen seconds, a single cloud is not.
export const SKY_HEAVY = '#96B2CC'
export const SKY_CLEAR = '#E2F2FE'

export const Sky = forwardRef(function Sky(
  {
    clouds,
    groups,
    skyAspect,
    clearness,
    raining,
    drops,
    cleared,
    stormToken,
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

  return (
    <div
      className="sky"
      ref={ref}
      style={{ backgroundColor: mixHex(SKY_HEAVY, SKY_CLEAR, clearness) }}
    >
      <div className="sky__glow" style={{ opacity: clearness }} />
      <SunBurst visible={cleared} />

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

      <RainOverlay raining={raining} drops={drops} />
      <StormFlash token={stormToken} />

      {cleared && (
        <div className="sky__win" role="status">
          <p className="sky__win-line">Clear skies.</p>
          <p className="sky__win-sub">
            You freed {formatSize(freedBytes)} — {formatCount(freedPhotos)} photos you were never
            going to look at.
          </p>
        </div>
      )}
    </div>
  )
})
