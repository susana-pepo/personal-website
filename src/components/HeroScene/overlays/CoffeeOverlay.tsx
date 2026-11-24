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
  return (
    <SceneObject overlay={COFFEE} highlighted={highlighted} discoveryIndex={discoveryIndex} className="coffee">
      {moving && entered ? (
        <LoopClip src={COFFEE_MEDIA.animated} still={COFFEE_MEDIA.still} alpha size={COFFEE_MEDIA.size} />
      ) : (
        <img
          src={COFFEE_MEDIA.still}
          alt=""
          width={Math.round(COFFEE.width)}
          height={Math.round(COFFEE.height)}
          decoding="async"
          draggable={false}
        />
      )}
    </SceneObject>
  )
}
