import { useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Ref } from 'react'
import { pctX, pctY } from '../../../scene/layout'
import { BULB } from '../../../scene/lampGeometry'

/*
 * The spots were drawn round the shade when its bulb was at (1030, 472); they move with the
 * bulb, so they stay round the shade wherever the lamp is placed.
 */
const SHIFT = { x: BULB.x - 1030, y: BULB.y - 472 }
const moved = <T extends { x: number; y: number }>(p: T): T => ({ ...p, x: p.x + SHIFT.x, y: p.y + SHIFT.y })

/** The lampshade's middle, on the canvas: every spot below is measured from here. */
const ORIGIN = moved({ x: 1028, y: 420 })
/**
 * Spots around the shade where a burst (or a twitch) can appear, each with the
 * direction its marks fan out in (deg; 0 = right, -90 = up), always away from
 * the shade. None on its upper left, where her face is.
 */
const SPOTS = [
  { x: 1015, y: 352, facing: -88 }, // above
  { x: 1086, y: 384, facing: -40 }, // upper right
  { x: 1112, y: 446, facing: 6 }, // right
  { x: 1080, y: 494, facing: 58 }, // below the rim, right
  { x: 990, y: 497, facing: 118 }, // below the rim, left
].map(moved)
const LIFETIME_MS = 2000

export interface LampSplashHandle {
  /** Hovering: a tiny comic wiggle by the shade, as if the lamp wants to be switched. */
  tease: () => void
  /** A click: a few small action strokes, ink with a hint of the new colour. */
  burst: (colour: string) => void
}

type Kind = 'line' | 'wiggle'
interface Mark {
  key: number
  kind: Kind
  ox: number // where its spot is, from ORIGIN, in cqi (1% of the scene's width)
  oy: number
  angle: number // deg; 0 = right, -90 = up
  from: number // start distance from its spot, cqi
  to: number // end distance, cqi
  length: number // cqi
  delay: number // s
  colour?: string
}

const between = (a: number, b: number) => a + Math.random() * (b - a)
const toCqi = (canvasPx: number) => (canvasPx / 1920) * 100
let nextKey = 0
let lastSpot = -1

/** A spot around the shade, never the same one twice in a row. */
function pickSpot() {
  let i = Math.floor(Math.random() * SPOTS.length)
  if (i === lastSpot) i = (i + 1 + Math.floor(Math.random() * (SPOTS.length - 1))) % SPOTS.length
  lastSpot = i
  const spot = SPOTS[i]!
  return { ox: toCqi(spot.x - ORIGIN.x), oy: toCqi(spot.y - ORIGIN.y), facing: spot.facing }
}

/** Action lines fanned over an arc (comic "emanata"), each a little different. */
function actionLines(spot: ReturnType<typeof pickSpot>, colour: string): Mark[] {
  const count = Math.random() < 0.5 ? 5 : 6
  const spread = 50 // degrees either side of the way the spot faces
  return Array.from({ length: count }, (_, i) => ({
    key: nextKey++,
    kind: 'line' as const,
    ox: spot.ox,
    oy: spot.oy,
    angle: spot.facing - spread + (2 * spread * i) / (count - 1) + between(-6, 6),
    from: between(0.3, 0.55),
    to: between(1.5, 2.1),
    length: between(0.75, 1.15) * (i % 2 ? 0.72 : 1), // alternating long and short, like a drawn burst
    delay: i * 0.045 + between(0, 0.03), // a soft ripple across the fan, not all at once
    colour,
  }))
}

/** Three short jiggle marks, like a comic object about to do something. */
function wiggle(spot: ReturnType<typeof pickSpot>): Mark[] {
  return [-24, 0, 24].map((a, i) => ({
    key: nextKey++,
    kind: 'wiggle' as const,
    ox: spot.ox,
    oy: spot.oy,
    angle: spot.facing + a + between(-4, 4),
    from: 0.35,
    to: 0.7,
    length: 0.42,
    delay: i * 0.05,
  }))
}

interface LampSplashProps {
  ref?: Ref<LampSplashHandle>
}

/**
 * The lamp's little comic action, in the cat's airy spirit but drawn rather than
 * written: hovering makes it twitch (three tiny jiggle marks); a click sends a
 * few small, tapered action strokes out from the shade, rippling one after
 * another and easing away (ink with a hint of the new colour), unhurried like
 * the rest of the room. Each time at a different spot around the shade. Decorative only (the colour's name is announced to
 * screen readers elsewhere).
 */
export function LampSplash({ ref }: LampSplashProps) {
  const [marks, setMarks] = useState<Mark[]>([])
  const timers = useRef<number[]>([])
  const lastTease = useRef(Number.NEGATIVE_INFINITY) // so the very first hover always plays

  const add = useCallback((more: Mark[]) => {
    // Each batch clears itself when its timer fires; the cap only guards against a runaway.
    setMarks((current) => [...current, ...more].slice(-90))
    const keys = new Set(more.map((m) => m.key))
    const timer = window.setTimeout(() => {
      setMarks((current) => current.filter((m) => !keys.has(m.key)))
      timers.current = timers.current.filter((t) => t !== timer)
    }, LIFETIME_MS)
    timers.current.push(timer)
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      tease: () => {
        const now = performance.now()
        if (now - lastTease.current < 1400) return // not on every twitch of the pointer
        lastTease.current = now
        add(wiggle(pickSpot()))
      },
      burst: (colour) => {
        add(actionLines(pickSpot(), colour))
      },
    }),
    [add],
  )

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  return (
    <span className="lamp-splash" aria-hidden="true" style={{ left: pctX(ORIGIN.x), top: pctY(ORIGIN.y) }}>
      {marks.map((m) => (
        <span
          key={m.key}
          className={`lamp-splash__${m.kind}`}
          style={
            {
              '--ox': `${m.ox}cqi`,
              '--oy': `${m.oy}cqi`,
              '--a': `${m.angle}deg`,
              '--from': `${m.from}cqi`,
              '--to': `${m.to}cqi`,
              '--len': `${m.length}cqi`,
              '--c': m.colour,
              animationDelay: `${m.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  )
}
