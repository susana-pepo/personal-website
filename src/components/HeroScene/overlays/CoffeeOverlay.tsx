import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { useEntered } from '../../../hooks/useEntered'
import { COFFEE_MEDIA, overlay } from '../../../scene/layout'
import { LoopClip } from './LoopClip'
import { SceneObject } from './SceneObject'

const COFFEE = overlay('coffee')

interface CoffeeOverlayProps {
  /** The room is allowed to move right now (see useScenePlayback). */
  motionAllowed: boolean
  /** Lit while its hotspot is hovered or focused. */
  highlighted: boolean
  /** Order in the first-visit discovery sequence. */
  discoveryIndex: number
}

/**
 * The mug of coffee on the desk, with its steam curling up and thinning out as
 * it rises (see .coffee in HeroScene.css). It opens Contact ("Let's chat"): it
 * glows softly at rest and grows a little on hover, like the other objects;
 * the clickable outline lives in HotspotLayer. The steam rests (first frame) with reduced motion or a paused room.
 */
export function CoffeeOverlay({ motionAllowed, highlighted, discoveryIndex }: CoffeeOverlayProps) {
  const reducedMotion = usePrefersReducedMotion()
  const moving = motionAllowed && !reducedMotion
  const entered = useEntered() // the steam waits for the page's entrance
  const looping = moving && entered
  // The still stays underneath until the loop's first frame is up: the whole mug lives in the
  // video, so without it the mug blinked out each time the loop (re)started, as when a page closes.
  const [arrived, setArrived] = useState(false)
  useEffect(() => {
    if (!looping) setArrived(false)
  }, [looping])
  return (
    <SceneObject overlay={COFFEE} highlighted={highlighted} discoveryIndex={discoveryIndex} className="coffee">
      <img
        src={COFFEE_MEDIA.still}
        alt=""
        width={Math.round(COFFEE.width)}
        height={Math.round(COFFEE.height)}
        decoding="async"
        draggable={false}
        style={looping && arrived ? { visibility: 'hidden' } : undefined}
      />
      {looping && <LoopClip src={COFFEE_MEDIA.animated} alpha size={COFFEE_MEDIA.size} onArrived={() => setArrived(true)} />}
    </SceneObject>
  )
}
