import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { VINYL_PARTS, overlay, pctX, pctY } from '../../../scene/layout'
import { usePlacedOverlay } from '../../../scene/layoutOverrides'
import { SceneObject } from './SceneObject'

const VINYL = overlay('vinyl')
const [IW, IH] = VINYL_PARTS.imageSize
const [CX, CY] = VINYL_PARTS.discCenter
const DW = VINYL_PARTS.discWidth
/** The left of the three small buttons on the front panel (centre and radius, in the body image's pixels): the power light. */
const POWER = { x: 402, y: 642, r: 17 }
const DH = DW * VINYL_PARTS.tilt
/** The record's box inside the player, as percentages of the player image. */
const DISC_BOX = {
  left: `${((CX - DW / 2) / IW) * 100}%`,
  top: `${((CY - DH / 2) / IH) * 100}%`,
  width: `${(DW / IW) * 100}%`,
  height: `${(DH / IH) * 100}%`,
}
const TURN_MS = 60_000 / VINYL_PARTS.rpm
const SPIN_UP_S = 2.5

interface VinylPlayerProps {
  /** Lit while its hotspot is hovered or focused. */
  highlighted: boolean
  /** The room is allowed to move right now (see useScenePlayback). */
  motionAllowed: boolean
  discoveryIndex: number
}

/**
 * The record player, in layers: the body, a flat top-down record tilted to the
 * platter's perspective and turning slowly (12 rpm, one calm turn every 5 s), its painted reflections held
 * still on top (as real light would be), then the spindle and tonearm.
 *
 * The record is always playing: it eases up to speed when the room starts and
 * turns continuously, with warm light catching its grooves. It rests only with
 * reduced motion or while the room is paused. No sound: music stays opt-in.
 */
export function VinylPlayer({ highlighted, motionAllowed, discoveryIndex }: VinylPlayerProps) {
  const discRef = useRef<HTMLSpanElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  // In view of the room (a phone's room pans, and opens with the record player off to the left).
  // Out of view, the record stops and gives up its own layer: iPhone Safari never paints a layer
  // that was made while it was out of sight in a panning box, and the whole player went missing.
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const player = discRef.current?.closest('.scene-object')
    if (!player || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setInView(entry ? entry.isIntersecting : true))
    observer.observe(player)
    return () => observer.disconnect()
  }, [])
  // Always playing, whenever the room may move.
  const spinning = motionAllowed && !reducedMotion
  const spin = useRef<{ animation: Animation | null; rate: number; frame: number; time: CSSNumberish | null }>({
    animation: null,
    rate: 0,
    frame: 0,
    time: null,
  })

  useEffect(() => {
    const disc = discRef.current
    if (!disc || typeof disc.animate !== 'function') return
    const state = spin.current
    if (!inView) {
      // Out of sight: no animation and no layer; it carries on from the same turn when it's back.
      cancelAnimationFrame(state.frame)
      if (state.animation) {
        state.time = state.animation.currentTime
        state.animation.cancel()
        state.animation = null
      }
      return
    }
    if (!state.animation) {
      state.animation = disc.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
        duration: TURN_MS,
        iterations: Infinity,
        easing: 'linear',
      })
      if (state.time !== null) state.animation.currentTime = state.time
      state.animation.pause()
    }
    const animation = state.animation
    if (!spinning) {
      // Stop at once, where it is.
      cancelAnimationFrame(state.frame)
      state.rate = 0
      animation.pause()
      return
    }
    // Otherwise it eases up to full speed (and stays there).
    let last = performance.now()
    const step = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      state.rate = Math.min(1, state.rate + dt / SPIN_UP_S)
      // ease the ramp so it starts and settles softly
      const eased = state.rate * state.rate * (3 - 2 * state.rate)
      if (eased > 0.001) {
        animation.playbackRate = eased
        if (animation.playState !== 'running') animation.play()
      } else {
        animation.pause()
      }
      if (state.rate < 1) state.frame = requestAnimationFrame(step)
    }
    cancelAnimationFrame(state.frame)
    state.frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(state.frame)
  }, [spinning, inView])

  useEffect(
    () => () => {
      cancelAnimationFrame(spin.current.frame)
      spin.current.animation?.cancel()
    },
    [],
  )

  return (
    <SceneObject
      overlay={VINYL}
      highlighted={highlighted}
      discoveryIndex={discoveryIndex}
      className="vinyl-player"
      dataAttributes={{ 'data-spinning': spinning ? '' : undefined }}
    >
      <img className="vinyl-player__body" src={VINYL_PARTS.body} alt="" draggable={false} />
      <span className="vinyl-player__disc" style={DISC_BOX}>
        <span className="vinyl-player__edge" style={{ transform: `translateY(${(VINYL_PARTS.edge / DH) * 100}%)` }} />
        <span className="vinyl-player__face" style={{ transform: `translateY(-50%) scaleY(${VINYL_PARTS.tilt})` }}>
          <span ref={discRef} className="vinyl-player__spin" style={inView ? undefined : { willChange: 'auto' }}>
            <img src={VINYL_PARTS.disc} alt="" draggable={false} />
            <span className="vinyl-player__shade" />
            <span className="vinyl-player__shimmer" />
          </span>
        </span>
        <span className="vinyl-player__face vinyl-player__face--sheen" style={{ transform: `translateY(-50%) scaleY(${VINYL_PARTS.tilt})` }}>
          <img src={VINYL_PARTS.discSheen} alt="" draggable={false} />
        </span>
      </span>
      <img className="vinyl-player__part" src={VINYL_PARTS.spindle} alt="" draggable={false} />
      <img className="vinyl-player__part" src={VINYL_PARTS.tonearmArm} alt="" draggable={false} />
      <img className="vinyl-player__part" src={VINYL_PARTS.tonearmBase} alt="" draggable={false} />
    </SceneObject>
  )
}

interface PowerLightProps {
  /** The record player is hovered or focused (it grows a little; the light follows). */
  highlighted: boolean
  /** The room is allowed to move: the light breathes only then (otherwise it's steadily on). */
  motionAllowed: boolean
}

/**
 * The record player's power light: its left front button glows red from within
 * and breathes slowly. Drawn above the room's evening layer, like the lamp's
 * light, so it glows through the dusk and lights the wood around it; its box
 * mirrors the record player's, so it follows the player's hover magnify.
 */
export function PowerLight({ highlighted, motionAllowed }: PowerLightProps) {
  const reducedMotion = usePrefersReducedMotion()
  const player = usePlacedOverlay(VINYL) // development sandbox only; identical in production
  return (
    <span
      className="power-light"
      aria-hidden="true"
      data-highlighted={highlighted ? '' : undefined}
      data-still={motionAllowed && !reducedMotion ? undefined : ''}
      style={{ left: pctX(player.x), top: pctY(player.y), width: pctX(player.width), height: pctY(player.height) }}
    >
      <span
        className="power-light__button"
        style={{
          left: `${(POWER.x / IW) * 100}%`,
          top: `${(POWER.y / IH) * 100}%`,
          width: `${((POWER.r * 2) / IW) * 100}%`,
        }}
      >
        <span className="power-light__bloom" />
        <span className="power-light__core" />
      </span>
    </span>
  )
}
