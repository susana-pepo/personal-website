import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { easeInOut, easeOut } from '../../../lib/motion'
import { content } from '../../../content/content'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { quadMatrix, type Pt } from '../../../scene/perspective'

/**
 * The corners of the screen's glass (the lit wallpaper, inside the bezel), as
 * fractions of the laptop overlay's box: top-left, top-right, bottom-right,
 * bottom-left. Measured from laptop.png by fitting a line to each edge of the
 * wallpaper (each within 1 px), then intersecting them. The screen is painted
 * turned away to the right, so its top edge is nearly level while its bottom edge
 * drops towards the right: a true trapezoid. The terminal is laid onto it in that
 * perspective, so its edges run with the screen's.
 */
const SCREEN: readonly [Pt, Pt, Pt, Pt] = [
  [0.3309, 0.0543],
  [0.9655, 0.0641],
  [0.9078, 0.6966],
  [0.2634, 0.6356],
]
/** The flat plane drawn onto the screen, in CSS px (a laptop display's 1.54:1; it's scaled onto the glass). */
const PLANE = { w: 400, h: 260 }
/** It types the laptop's label (the floating tag isn't shown for the laptop). */
const COMMAND = content.objectTooltips.laptop

/*
 * The macOS "genie": the window pours out of a point at the bottom of the
 * screen (where the Dock would be), its lower edge narrowing into the funnel,
 * and is drawn back into it on close. transform-origin is the window's bottom
 * centre; the translate carries it down to the screen's bottom centre.
 */
const pct = (v: number) => `${+(v * 100).toFixed(2)}%`
/** One moment of the genie: q = 1 open, 0 minimised into the Dock point. */
function genieFrame(q: number): Keyframe {
  const away = 1 - q
  // the lower edge pinches first, the top follows, so the window funnels down
  const bottom = 0.48 * Math.pow(away, 0.8)
  const top = 0.4 * Math.pow(away, 1.7)
  const sx = 0.08 + 0.92 * Math.pow(q, 0.8)
  const sy = 0.03 + 0.97 * q
  return {
    offset: q,
    opacity: Math.min(1, q / 0.1), // it only fades in the last moment, as it enters the Dock
    transform: `translate(${pct(0.12 * away)}, ${pct(0.42 * Math.pow(away, 1.15))}) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`,
    clipPath: `polygon(${pct(top)} 0%, ${pct(1 - top)} 0%, ${pct(1 - bottom)} 100%, ${pct(bottom)} 100%)`,
  }
}
/** Sampled finely so the window moves at an even pace along the whole path. */
const GENIE: Keyframe[] = Array.from({ length: 21 }, (_, i) => genieFrame(i / 20))

/** Full open and full close, in ms (a partial one takes its share). */
const OPEN_MS = 800
const CLOSE_MS = 600
/**
 * Opening eases out, so the window pours out the moment the laptop is hovered and then
 * settles softly; closing is one smooth, even sine sweep into the Dock. The typing in
 * HeroScene.css (lt-type) starts once the opening has all but settled.
 */
const FADE: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }]

interface LaptopTerminalProps {
  /** Hovered or focused, or its Work section is open. */
  open: boolean
  /** The room is allowed to move (the cursor pulses only then). */
  motionAllowed: boolean
}

/**
 * A small terminal window that surfaces on the laptop's screen when the laptop
 * is hovered (or its Work section is open), types the laptop's label ("My
 * work") at its prompt and waits with a softly breathing cursor. When the
 * pointer leaves or the section closes, it minimises back into the screen's
 * Dock point, like a Mac window. Lives inside the laptop's own box, so it follows the laptop's
 * hover magnify and sits under the room's lighting. Decorative only.
 */
export function LaptopTerminal({ open, motionAllowed }: LaptopTerminalProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const animation = useRef<Animation | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [transform, setTransform] = useState<string>()
  // The typed line stays while the window minimises, then resets for next time.
  const [typed, setTyped] = useState(false)
  useEffect(() => {
    if (open) {
      setTyped(true)
      return
    }
    const timer = window.setTimeout(() => setTyped(false), CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  // The genie's keyframes, scrubbed by a small tween: progress 0 = minimised, 1 = open.
  // Each direction has its own easing, and a change of mind mid-way starts from
  // wherever the window is, so it never jumps.
  const progress = useRef(0)
  // Shown from the moment it opens until it has fully minimised again. Closed, the window is
  // fully transparent, but its will-change keeps it painted and its layer kept, so the plane is
  // hidden then. Opening shows it in the same render, at progress 0 (opacity 0), so the genie's
  // first frame is as before.
  const [shown, setShown] = useState(open)
  useEffect(() => {
    const el = windowRef.current
    if (!el || typeof el.animate !== 'function') return
    const anim = el.animate(reducedMotion ? FADE : GENIE, { duration: 1000, easing: 'linear', fill: 'both' })
    anim.pause()
    anim.currentTime = progress.current * 1000
    animation.current = anim
    return () => {
      anim.cancel()
      animation.current = null
    }
  }, [reducedMotion])

  useEffect(() => {
    const anim = animation.current
    if (!anim) {
      setShown(open)
      return
    }
    const from = progress.current
    const to = open ? 1 : 0
    if (open) setShown(true)
    if (from === to) {
      if (!open) setShown(false)
      return
    }
    const full = reducedMotion ? 180 : open ? OPEN_MS : CLOSE_MS
    const duration = full * Math.abs(to - from)
    // the reduced-motion fade keeps its even sine either way
    const ease = open && !reducedMotion ? easeOut : easeInOut
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      progress.current = from + (to - from) * ease(t)
      anim.currentTime = progress.current * 1000
      if (t < 1) frame = requestAnimationFrame(step)
      else if (to === 0) setShown(false)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [open, reducedMotion])

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const fit = () => {
      // layout size, unaffected by the laptop's hover scale
      const w = box.offsetWidth
      const h = box.offsetHeight
      if (!w || !h) return
      const [a, b, c, d] = SCREEN.map(([x, y]): Pt => [x * w, y * h])
      setTransform(quadMatrix(PLANE.w, PLANE.h, [a!, b!, c!, d!]))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={boxRef}
      className="laptop-terminal"
      aria-hidden="true"
      data-open={open ? '' : undefined}
      data-typed={typed ? '' : undefined}
      data-still={motionAllowed ? undefined : ''}
    >
      <div className="laptop-terminal__plane" style={{ width: PLANE.w, height: PLANE.h, transform, visibility: transform && (open || shown) ? undefined : 'hidden' }}>
        <div ref={windowRef} className="laptop-terminal__window">
          <div className="laptop-terminal__bar">
            <i />
            <i />
            <i />
          </div>
          {/* --chars: how long the command takes to type, and when the cursor starts breathing */}
          <div className="laptop-terminal__body" style={{ ['--chars' as string]: COMMAND.length }}>
            <span className="laptop-terminal__prompt">~ %</span>{' '}
            <span className="laptop-terminal__typed">
              {COMMAND}
            </span>
            <span className="laptop-terminal__cursor" />
          </div>
        </div>
      </div>
    </div>
  )
}
