import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { easeInOut } from '../../../lib/motion'
import { formed, frostBuilder, type FrostField } from '../../../scene/frost'
import { overcastRgb } from '../../../scene/glassDrops'
import { BULB as LAMP_BULB } from '../../../scene/lampGeometry'
import { WINDOW_VIEWS, WINDOW_VIEW_BOX, WINDOW_VIEW_MASK, type TimeOfDay } from '../../../scene/windowViews'
import { VIEW_FADE_MS } from './WindowView'
import { loadImage, softPixels } from './canvasUtil'

const W = WINDOW_VIEW_BOX.width
const H = WINDOW_VIEW_BOX.height
/** WindowView's fade with reduced motion. */
const REDUCED_FADE_MS = 400
/** Frost takes a while to form once it snows, and melts a little faster when it stops. */
const FORM_S = 28
const MELT_S = 10
/** Redraws while it forms, melts or changes light, at most this often (ms). */
const EVERY_MS = 90

/** The frost's colour in each light, and how strongly it shows. */
const ICE: Record<TimeOfDay, { rgb: readonly [number, number, number]; strength: number }> = {
  dawn: { rgb: [252, 244, 242], strength: 0.95 },
  midday: { rgb: [248, 250, 253], strength: 1 },
  night: { rgb: [222, 231, 247], strength: 0.92 },
}
/** After dark the frost nearest the lamp takes its warmth. */
const LAMP_RGB = [255, 214, 160] as const
const LAMP_REACH = 200

interface Light {
  rgb: [number, number, number]
  strength: number
  lamp: number
}

const lightFor = (time: TimeOfDay): Light => ({ rgb: [...ICE[time].rgb], strength: ICE[time].strength, lamp: time === 'night' ? 1 : 0 })

interface FrostLayerProps {
  snowing: boolean
  time: TimeOfDay
  /** The room may move: frost forms and melts slowly only then (otherwise it's there or not, at once). */
  moving: boolean
}

/**
 * Frost on the lower panes while it snows (see scene/frost.ts for where it
 * lies): the view goes soft and milky behind it and fine crystals catch the
 * light. One small canvas, stretched over the window view's box under its glass
 * mask (it sits inside WeatherLayer, over the snow). It forms slowly from the
 * sill up when the snow starts and melts away when it stops; its light fades
 * with the view's when the time changes. Its shape is worked out once, the
 * first time it snows. Decorative only.
 */
export function FrostLayer({ snowing, time, moving }: FrostLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const state = useRef({
    field: null as FrostField | null,
    progress: 0,
    // the view behind, soft, for now and for the light it's fading from
    view: null as Uint8ClampedArray | null,
    fromView: null as Uint8ClampedArray | null,
    light: lightFor(time),
    fromLight: lightFor(time),
    nextLight: lightFor(time),
    fade: 1,
  })
  const props = useRef({ snowing, time, moving, reducedMotion })
  props.current = { snowing, time, moving, reducedMotion }
  const kick = useRef<() => void>(() => {})

  // Paint the frost as it is now.
  const paint = () => {
    const canvas = canvasRef.current
    const s = state.current
    const field = s.field
    if (!canvas || !field || !s.view) return
    if (canvas.width !== field.cols || canvas.height !== field.rows) {
      canvas.width = field.cols
      canvas.height = field.rows
    }
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(field.cols, field.rows)
    const out = img.data
    const k = s.fade
    const from = s.fromView ?? s.view
    const L = {
      r: s.fromLight.rgb[0] + (s.nextLight.rgb[0] - s.fromLight.rgb[0]) * k,
      g: s.fromLight.rgb[1] + (s.nextLight.rgb[1] - s.fromLight.rgb[1]) * k,
      b: s.fromLight.rgb[2] + (s.nextLight.rgb[2] - s.fromLight.rgb[2]) * k,
      strength: s.fromLight.strength + (s.nextLight.strength - s.fromLight.strength) * k,
      lamp: s.fromLight.lamp + (s.nextLight.lamp - s.fromLight.lamp) * k,
    }
    const bx = (LAMP_BULB.x - WINDOW_VIEW_BOX.x) / field.step
    const by = (LAMP_BULB.y - WINDOW_VIEW_BOX.y) / field.step
    const reach = LAMP_REACH / field.step
    for (let i = 0; i < field.cover.length; i++) {
      const cover = field.cover[i]!
      if (cover <= 0) continue
      const f = formed(field.rise[i]!, s.progress)
      if (f <= 0) continue
      const c = cover * f
      const crystals = field.crystals[i]! * f
      const p = i * 4
      // the view behind, soft
      const vr = from[p]! + (s.view[p]! - from[p]!) * k
      const vg = from[p + 1]! + (s.view[p + 1]! - from[p + 1]!) * k
      const vb = from[p + 2]! + (s.view[p + 2]! - from[p + 2]!) * k
      // the ice's colour here, warmed near the lamp after dark
      let tr = L.r
      let tg = L.g
      let tb = L.b
      if (L.lamp > 0.01) {
        const x = (i % field.cols) - bx
        const y = Math.floor(i / field.cols) - by
        const warm = L.lamp * 0.6 * Math.exp(-(x * x + y * y) / (2 * reach * reach))
        tr += (LAMP_RGB[0] - tr) * warm
        tg += (LAMP_RGB[1] - tg) * warm
        tb += (LAMP_RGB[2] - tb) * warm
      }
      // three layers, one over another: the softened view, a milky veil, the crystals
      let A = 0
      let R = 0
      let G = 0
      let B = 0
      const over = (r: number, g: number, b: number, a: number) => {
        R = r * a + R * (1 - a)
        G = g * a + G * (1 - a)
        B = b * a + B * (1 - a)
        A = a + A * (1 - a)
      }
      over(vr, vg, vb, 0.7 * c)
      over(tr, tg, tb, 0.26 * L.strength * c)
      over(tr, tg, tb, 0.85 * L.strength * crystals)
      const glint = field.glint[i]!
      if (glint > 0) over(Math.min(255, tr + 30), Math.min(255, tg + 30), Math.min(255, tb + 30), 0.65 * glint * f)
      if (A <= 0.003) continue
      out[p] = R / A
      out[p + 1] = G / A
      out[p + 2] = B / A
      out[p + 3] = A * 255
    }
    ctx.putImageData(img, 0, 0)
  }

  // The frost's shape, worked out the first time it snows, a few rows at a time
  // between frames (it forms slowly anyway), so the room never stutters.
  useEffect(() => {
    const s = state.current
    if (!snowing || s.field) return
    let gone = false
    let timer = 0
    void loadImage(WINDOW_VIEW_MASK).then((img) => {
      if (gone || s.field) return
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0, W, H)
      const rgba = ctx.getImageData(0, 0, W, H).data
      const alpha = new Uint8ClampedArray(W * H)
      for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]!
      const builder = frostBuilder(alpha, W, H, 2)
      const work = () => {
        if (gone) return
        const until = performance.now() + 6
        let done = false
        while (!done && performance.now() < until) done = builder.next(4)
        if (!done) {
          timer = window.setTimeout(work, 16)
          return
        }
        s.field = builder.field
        kick.current()
      }
      work()
    }, () => {})
    return () => {
      gone = true
      window.clearTimeout(timer)
    }
  }, [snowing])

  // The light: the soft view behind it and the ice's colour, faded with the view.
  const overcast = snowing && time === 'midday'
  useEffect(() => {
    const s = state.current
    let gone = false
    const wait = () =>
      new Promise<void>((resolve) => {
        const check = () => (gone || s.field ? resolve() : window.setTimeout(check, 100))
        check()
      })
    void wait()
      .then(() => loadImage(WINDOW_VIEWS[time].still))
      .then((img) => {
        if (gone || !s.field) return
        const view = softPixels(img, s.field.cols, s.field.rows)
        if (overcast) {
          for (let i = 0; i < view.length; i += 4) {
            const [r, g, b] = overcastRgb(view[i]!, view[i + 1]!, view[i + 2]!)
            view[i] = r
            view[i + 1] = g
            view[i + 2] = b
          }
        }
        const first = !s.view
        s.fromView = first ? view : mixed(s)
        s.fromLight = first ? lightFor(time) : current(s)
        s.view = view
        s.nextLight = lightFor(time)
        s.fade = first ? 1 : 0
        kick.current()
      }, () => {})
    return () => {
      gone = true
    }
  }, [time, overcast])

  // Forming, melting and fading: a slow loop that rests when nothing changes.
  useEffect(() => {
    let frame = 0
    let last = 0
    let lastPaint = 0
    let fadeStart = 0
    const step = (now: number) => {
      frame = 0
      const s = state.current
      const p = props.current
      const dt = last ? Math.min(0.2, (now - last) / 1000) : 0
      last = now
      const goal = p.snowing ? 1 : 0
      if (!p.moving) s.progress = goal
      else if (goal > s.progress) s.progress = Math.min(1, s.progress + dt / FORM_S)
      else if (goal < s.progress) s.progress = Math.max(0, s.progress - dt / MELT_S)
      if (s.fade < 1) {
        if (!fadeStart) fadeStart = now
        const duration = p.reducedMotion ? REDUCED_FADE_MS : VIEW_FADE_MS
        s.fade = easeInOut((now - fadeStart) / duration)
      } else {
        fadeStart = 0
      }
      const changing = s.progress !== goal || s.fade < 1
      if (now - lastPaint >= EVERY_MS || !changing) {
        paint()
        lastPaint = now
      }
      if (changing) frame = requestAnimationFrame(step)
      else last = 0
    }
    kick.current = () => {
      if (!frame) frame = requestAnimationFrame(step)
    }
    kick.current()
    return () => {
      cancelAnimationFrame(frame)
      kick.current = () => {}
    }
  }, [snowing, moving, reducedMotion])

  return <canvas ref={canvasRef} className="frost" aria-hidden="true" />
}

/** The light as it stands mid-fade, to fade on from. */
function current(s: { fromLight: Light; nextLight: Light; fade: number }): Light {
  const k = s.fade
  const m = (a: number, b: number) => a + (b - a) * k
  return {
    rgb: [m(s.fromLight.rgb[0], s.nextLight.rgb[0]), m(s.fromLight.rgb[1], s.nextLight.rgb[1]), m(s.fromLight.rgb[2], s.nextLight.rgb[2])],
    strength: m(s.fromLight.strength, s.nextLight.strength),
    lamp: m(s.fromLight.lamp, s.nextLight.lamp),
  }
}

/** The soft view as it stands mid-fade, to fade on from. */
function mixed(s: { fromView: Uint8ClampedArray | null; view: Uint8ClampedArray | null; fade: number }): Uint8ClampedArray {
  const to = s.view!
  const from = s.fromView ?? to
  if (s.fade >= 1) return to
  const out = new Uint8ClampedArray(to.length)
  for (let i = 0; i < to.length; i++) out[i] = from[i]! + (to[i]! - from[i]!) * s.fade
  return out
}
