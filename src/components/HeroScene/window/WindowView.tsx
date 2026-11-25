import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useEntered } from '../../../hooks/useEntered'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { LoopClip } from '../overlays/LoopClip'
import { TIMES, WINDOW_GLASS_STYLE, WINDOW_VIEWS, WINDOW_VIEW_MASK, type TimeOfDay } from '../../../scene/windowViews'

/** A full fade from one view to another, in ms. */
export const VIEW_FADE_MS = 1800
const REDUCED_FADE_MS = 400
/** A time must stay chosen this long before its loop (a few MB) is fetched: passing through costs nothing. */
const LOOP_DELAY_MS = 350
const EASE = 'cubic-bezier(0.45, 0, 0.55, 1)'


interface WindowViewProps {
  time: TimeOfDay
  /** The room is allowed to move: the views play only then (otherwise each shows its first frame). */
  motionAllowed: boolean
  /**
   * Called once the starting view is really on screen (its picture and the glass
   * mask have loaded), so the room's light can follow it. At once for dawn, which
   * is what the painting under it already shows.
   */
  onReady?: () => void
}

/**
 * The view through the window: dawn, midday or night, drawn only where the
 * painting has glass (its exact glass mask), so the frame, the bars and the sill
 * stay the painting's own and never move. Each view is a slow forward-and-back
 * loop of clouds and leaves.
 *
 * Changing time never cuts and never lets the room show through:
 *  - the layers on screen are kept in a fixed stack, the settled view at the
 *    bottom (always fully there) and any view fading in above it;
 *  - a new time fades in on top, from transparent;
 *  - a time already on screen (say, going back mid-fade) fades up from wherever
 *    it is, while everything above it fades away; nothing is ever reordered, so
 *    nothing jumps;
 *  - once the chosen view is fully there, the layers under it are let go.
 * Each view's small still shows at once; its loop is fetched only once that time
 * has stayed chosen for a moment, and plays over the still once it has arrived.
 * Decorative only (the time control announces the change).
 */
export function WindowView({ time, motionAllowed, onReady }: WindowViewProps) {
  const reducedMotion = usePrefersReducedMotion()
  const moving = motionAllowed && !reducedMotion
  const entered = useEntered() // the loop waits for the page's entrance (its still shows till then)
  const layers = useRef<Partial<Record<TimeOfDay, HTMLSpanElement | null>>>({})
  // The stack on screen, bottom first: order[0] is the settled view (opacity 1).
  const order = useRef<TimeOfDay[]>([time])
  const fadeMs = useRef(VIEW_FADE_MS)
  fadeMs.current = reducedMotion ? REDUCED_FADE_MS : VIEW_FADE_MS
  // What React needs to know: which layers are on screen (their loops may keep playing).
  const [onScreen, setOnScreen] = useState<TimeOfDay[]>([time])
  const [loopFor, setLoopFor] = useState<TimeOfDay | null>(time)
  const [arrived, setArrived] = useState<Partial<Record<TimeOfDay, boolean>>>({})

  const readyRef = useRef(onReady)
  readyRef.current = onReady

  // First paint: only the starting view is visible. Dawn is the painting itself,
  // so it can show at once; another time shows once its picture and the glass
  // mask are in (straight away if they're cached), fading in if they come late,
  // so the window never flashes the painting's dawn and then cuts.
  useLayoutEffect(() => {
    const start = order.current[0]!
    for (const t of TIMES) {
      const el = layers.current[t]
      if (el && t !== start) el.style.opacity = '0'
    }
    const layer = layers.current[start]
    const still = layer?.querySelector('img')
    const mask = new Image()
    mask.src = WINDOW_VIEW_MASK
    const loaded = (img: HTMLImageElement | null | undefined) => !!img && img.complete && img.naturalWidth > 0
    if (!layer || start === 'dawn' || (loaded(still) && loaded(mask))) {
      if (layer) layer.style.opacity = '1'
      readyRef.current?.()
      return
    }
    layer.style.opacity = '0'
    let gone = false
    const show = () => {
      if (gone) return
      // The visitor may have picked another time meanwhile: the stack has it from here.
      if (order.current.length === 1 && order.current[0] === start && layer.getAnimations().length === 0) {
        const a = layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fadeMs.current, easing: EASE, fill: 'forwards' })
        void a.finished.then(() => {
          if (gone || a.playState !== 'finished') return
          a.cancel()
          layer.style.opacity = '1'
        }, () => {})
      }
      readyRef.current?.()
    }
    const decoded = (img: HTMLImageElement | null | undefined) => (img ? img.decode().catch(() => {}) : Promise.resolve())
    void Promise.all([decoded(still), decoded(mask)]).then(show)
    return () => {
      gone = true
    }
  }, []) // once, on mount

  useLayoutEffect(() => {
    const stack = order.current
    if (stack.length === 1 && stack[0] === time) return
    const el = (t: TimeOfDay) => layers.current[t]
    // Freeze every layer where it is right now.
    const now = new Map<TimeOfDay, number>()
    for (const t of stack) {
      const e = el(t)
      if (!e) continue
      const o = Number(getComputedStyle(e).opacity)
      e.getAnimations().forEach((a) => a.cancel())
      e.style.opacity = String(o)
      now.set(t, o)
    }
    let next = stack
    if (!stack.includes(time)) next = [...stack, time]
    order.current = next
    next.forEach((t, i) => {
      const e = el(t)
      if (e) e.style.zIndex = String(i + 1)
    })
    const at = next.indexOf(time)
    const full = fadeMs.current
    const fades: Animation[] = []
    const fade = (t: TimeOfDay, from: number, to: number) => {
      const e = el(t)
      if (!e || from === to) return
      const a = e.animate([{ opacity: from }, { opacity: to }], {
        duration: Math.max(250, full * Math.abs(to - from)),
        easing: EASE,
        fill: 'forwards',
      })
      fades.push(a)
    }
    fade(time, now.get(time) ?? 0, 1) // the chosen view comes up (from transparent if it's new)
    for (const t of next.slice(at + 1)) fade(t, now.get(t) ?? 0, 0) // anything above it goes
    setOnScreen([...next])
    setLoopFor(null)
    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      // The chosen view is fully there: let go of every other layer.
      for (const t of next) {
        const e = el(t)
        if (!e) continue
        e.getAnimations().forEach((a) => a.cancel())
        e.style.opacity = t === time ? '1' : '0'
        e.style.zIndex = t === time ? '1' : ''
      }
      order.current = [time]
      setOnScreen([time])
    }
    if (fades.length === 0) settle()
    else void Promise.all(fades.map((a) => a.finished)).then(settle, () => {})
  }, [time])

  // Fetch the chosen time's loop once it has stayed chosen for a moment.
  useEffect(() => {
    const timer = window.setTimeout(() => setLoopFor(time), LOOP_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [time])

  return (
    <span className="window-view" aria-hidden="true" style={WINDOW_GLASS_STYLE}>
      {TIMES.map((t) => {
        const media = WINDOW_VIEWS[t]
        // the chosen loop, and a loop already playing in a layer that's still on screen
        const loop = moving && entered && (t === loopFor || (onScreen.includes(t) && arrived[t] === true))
        return (
          <span
            key={t}
            ref={(e) => {
              layers.current[t] = e
            }}
            className="window-view__layer"
            data-time={t}
            data-on={t === time ? '' : undefined}
          >
            <img src={media.still} alt="" draggable={false} />
            {loop && (
              <LoopClip
                src={media.animated}
                alpha={false}
                size={media.size}
                style={arrived[t] ? undefined : { opacity: 0 }}
                onArrived={() => setArrived((a) => (a[t] ? a : { ...a, [t]: true }))}
              />
            )}
          </span>
        )
      })}
    </span>
  )
}
