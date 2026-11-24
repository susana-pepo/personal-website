import { useId } from 'react'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../../scene/layout'
import { BULB, CONE_FOOT, POOL, RIM } from '../../../scene/lampGeometry'

interface LampLightProps {
  /** The room is allowed to move: flicker and drift run only then. */
  motionAllowed: boolean
}

/**
 * The desk lamp's light, as a soft additive layer over the room: a bloom
 * around the bulb, a feathered beam from the shade down to the desk, and a
 * warm pool where it lands. It flickers very slightly and irregularly (the
 * bulb a touch more than the beam), and a slow swell of brightness drifts
 * down through the beam. Still with reduced motion or a paused room.
 * Purely decorative: no pointer events, hidden from assistive technology.
 * This is the SVG version, used where WebGL isn't available or is lost (see
 * LampLiquid).
 */
export function LampLight({ motionAllowed }: LampLightProps) {
  const uid = useId().replace(/:/g, '')
  const id = (name: string) => `${uid}-${name}`
  const cone = `M${RIM.left[0]} ${RIM.left[1]} L${RIM.right[0]} ${RIM.right[1]} L${CONE_FOOT.right[0]} ${CONE_FOOT.right[1]} L${CONE_FOOT.left[0]} ${CONE_FOOT.left[1]} Z`

  return (
    <svg
      className="lamp-light"
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      data-still={motionAllowed ? undefined : ''}
    >
      <defs>
        <radialGradient id={id('bulb')} cx={BULB.x} cy={BULB.y} r="130" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="oklch(0.97 0.05 85)" stopOpacity="0.85" />
          <stop offset="0.18" stopColor="oklch(0.9 0.11 75)" stopOpacity="0.45" />
          <stop offset="0.55" stopColor="oklch(0.78 0.12 60)" stopOpacity="0.12" />
          <stop offset="1" stopColor="oklch(0.7 0.12 55)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('beam')} x1="0" y1={RIM.left[1]} x2="0" y2={CONE_FOOT.left[1]} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="oklch(0.92 0.09 78)" stopOpacity="0.42" />
          <stop offset="0.45" stopColor="oklch(0.85 0.11 68)" stopOpacity="0.2" />
          <stop offset="1" stopColor="oklch(0.8 0.11 60)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id('pool')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="oklch(0.9 0.1 72)" stopOpacity="0.38" />
          <stop offset="0.6" stopColor="oklch(0.84 0.11 64)" stopOpacity="0.12" />
          <stop offset="1" stopColor="oklch(0.8 0.11 60)" stopOpacity="0" />
        </radialGradient>
        {/* A soft swell that travels down the beam, then fades. */}
        <radialGradient id={id('swell')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="oklch(0.92 0.09 78)" stopOpacity="0.22" />
          <stop offset="1" stopColor="oklch(0.92 0.09 78)" stopOpacity="0" />
        </radialGradient>
        <filter id={id('feather')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="26" />
        </filter>
        <filter id={id('soft')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <clipPath id={id('beamClip')}>
          <path d={cone} />
        </clipPath>
      </defs>

      <g className="lamp-light__beam">
        <path d={cone} fill={`url(#${id('beam')})`} filter={`url(#${id('feather')})`} />
        <g clipPath={`url(#${id('beamClip')})`} filter={`url(#${id('feather')})`}>
          <ellipse className="lamp-light__swell" cx={(RIM.left[0] + RIM.right[0]) / 2} cy={RIM.left[1] + 90} rx="170" ry="110" fill={`url(#${id('swell')})`} />
        </g>
      </g>
      <ellipse
        className="lamp-light__pool"
        cx={POOL.x}
        cy={POOL.y}
        rx={POOL.rx}
        ry={POOL.ry}
        fill={`url(#${id('pool')})`}
        filter={`url(#${id('soft')})`}
      />
      <circle className="lamp-light__bulb" cx={BULB.x} cy={BULB.y} r="130" fill={`url(#${id('bulb')})`} />
    </svg>
  )
}
