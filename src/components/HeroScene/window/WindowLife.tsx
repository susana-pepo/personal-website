import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { pctX, pctY } from '../../../scene/layout'
import { WINDOW_VIEWS, type TimeOfDay } from '../../../scene/windowViews'

/** Time between blinks, in seconds: a random wait in this range. */
const PAUSE_S = [5, 11] as const
/** Chance that a second window blinks along with the first, a moment later. */
const PAIR_CHANCE = 0.3

/**
 * One blink: the light eases off, stays out for a breath, and eases back on.
 * The cover is the facade's own colour, so the window simply goes dark.
 */
function blink(el: HTMLElement) {
  const off = 900 + Math.random() * 900 // ms in the dark
  const fade = 700
  const total = fade + off + fade * 1.2
  return el.animate(
    [
      { opacity: 0, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
      { opacity: 0.92, offset: fade / total },
      { opacity: 0.92, offset: (fade + off) / total, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
      { opacity: 0 },
    ],
    { duration: total },
  )
}

interface WindowLifeProps {
  /** Whose view is in the window: its lit windows are the ones that blink (none by day). */
  time: TimeOfDay
  /** The room is allowed to move: lights change only then. */
  motionAllowed: boolean
}

/**
 * Life outside the window: every now and then, a window across the street whose
 * light goes out for a moment and comes back on; sometimes two. Never the same
 * window twice running. Still with reduced motion or a paused room. Decorative
 * only. (The rain is RainLayer's canvas, in WeatherLayer.)
 */
export function WindowLife({ time, motionAllowed }: WindowLifeProps) {
  const windows = WINDOW_VIEWS[time].cityWindows
  const reducedMotion = usePrefersReducedMotion()
  const coversRef = useRef<(HTMLSpanElement | null)[]>([])
  const active = motionAllowed && !reducedMotion

  useEffect(() => {
    if (!active || windows.length === 0) return
    let timer = 0
    let pairTimer = 0
    let last = -1
    const running: Animation[] = []
    const pick = () => {
      let i = Math.floor(Math.random() * windows.length)
      if (i === last) i = (i + 1) % windows.length
      last = i
      return i
    }
    const play = (i: number) => {
      const el = coversRef.current[i]
      if (!el) return
      const anim = blink(el)
      running.push(anim)
      anim.onfinish = () => running.splice(running.indexOf(anim), 1)
    }
    const schedule = (first = false) => {
      const [min, max] = PAUSE_S
      const wait = (first ? 2 : min + Math.random() * (max - min)) * 1000
      timer = window.setTimeout(() => {
        play(pick())
        if (Math.random() < PAIR_CHANCE) {
          const second = pick()
          pairTimer = window.setTimeout(() => play(second), 600 + Math.random() * 1400)
        }
        schedule()
      }, wait)
    }
    schedule(true)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(pairTimer)
      for (const anim of running.splice(0)) anim.cancel()
    }
  }, [active, windows])

  return (
    <span className="window-life" aria-hidden="true" data-still={motionAllowed ? undefined : ''}>
      {windows.map((win, i) => (
        <span
          key={`${time}-${win.x}-${win.y}`}
          ref={(el) => {
            coversRef.current[i] = el
          }}
          className="city-window"
          style={{ left: pctX(win.x), top: pctY(win.y), width: pctX(win.w), height: pctY(win.h), ['--facade' as string]: win.facade }}
        />
      ))}
    </span>
  )
}
