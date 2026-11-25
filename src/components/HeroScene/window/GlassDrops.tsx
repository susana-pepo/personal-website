import { useEffect, useLayoutEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { onRoomCovered, roomCovered } from '../../../hooks/useRoomCovered'
import { easeInOut } from '../../../lib/motion'
import { VIEW_FADE_MS } from './WindowView'
import { copyOf, loadImage, mix } from './canvasUtil'
import { BULB as LAMP_BULB } from '../../../scene/lampGeometry'
import { WINDOW_VIEWS, WINDOW_VIEW_BOX, WINDOW_VIEW_MASK, type TimeOfDay } from '../../../scene/windowViews'
import { seeded } from '../../../scene/weather'
import {
  makeGlass,
  overcastRgb,
  stepGlass,
  wetGlass,
  type Drop,
  type Glass,
  type GlassMap,
  type Runner,
} from '../../../scene/glassDrops'

const W = WINDOW_VIEW_BOX.width
const H = WINDOW_VIEW_BOX.height
const MAX_DPR = 1.5
/** The view as seen through the drops is drawn small (it is out of focus anyway). */
const BG_SCALE = 0.22
/** How wide a patch of the view each drop gathers, as a multiple of its size. */
const LENS = 5
/** Below this radius a drop is just a bead of light and shadow. */
const LENS_FROM = 2.2
const SPRITE = 64
/** WindowView's fade with reduced motion (its full fade is VIEW_FADE_MS). */
const REDUCED_FADE_MS = 400
/** The lamp's bulb, in the window view's own pixels: after dark, drops near it catch more of its light. */
const BULB = { x: LAMP_BULB.x - WINDOW_VIEW_BOX.x, y: LAMP_BULB.y - WINDOW_VIEW_BOX.y }
const LAMP_REACH = 260
/** The still beads are redrawn at most this often (ms). */
const STILL_EVERY_MS = 80

/** Each light's highlight on the drops: the sky's by day, the lamp's warmth after dark. */
const GLINT: Record<TimeOfDay, { rgb: string; alpha: number; shade: number; lip: number; size: number; lift: number }> = {
  dawn: { rgb: '255 238 224', alpha: 0.85, shade: 0.34, lip: 0.28, size: 0.2, lift: 14 },
  midday: { rgb: '255 255 255', alpha: 0.9, shade: 0.3, lip: 0.28, size: 0.2, lift: 14 },
  // after dark the drops are seen by the lamp's light they catch
  night: { rgb: '255 214 160', alpha: 1, shade: 0.4, lip: 0.42, size: 0.26, lift: 34 },
}

/**
 * A drop's light and shadow, laid over its lens: a shadow that gathers along
 * its lower edge (light comes from above), a faint bright lip at the very
 * bottom where the sky is focused, and one small, sharp glint up and to the left.
 */
function drawSprite(canvas: HTMLCanvasElement, time: TimeOfDay) {
  canvas.width = SPRITE
  canvas.height = SPRITE
  const ctx = canvas.getContext('2d')!
  const c = SPRITE / 2
  const R = c * 0.9
  const g = GLINT[time]
  ctx.clearRect(0, 0, SPRITE, SPRITE)
  ctx.save()
  ctx.beginPath()
  ctx.arc(c, c, R, 0, Math.PI * 2)
  ctx.clip()
  // shadow, offset up so it pools along the bottom edge
  const shade = ctx.createRadialGradient(c, c - R * 0.38, R * 0.2, c, c - R * 0.38, R * 1.4)
  shade.addColorStop(0, 'rgb(0 0 0 / 0)')
  shade.addColorStop(0.62, 'rgb(0 0 0 / 0)')
  shade.addColorStop(0.86, `rgb(0 0 0 / ${g.shade})`)
  shade.addColorStop(1, `rgb(0 0 0 / ${g.shade * 1.2})`)
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, SPRITE, SPRITE)
  // the bright lip low inside the drop
  const lip = ctx.createRadialGradient(c, c + R * 0.62, 0, c, c + R * 0.62, R * 0.42)
  lip.addColorStop(0, `rgb(${g.rgb} / ${g.lip})`)
  lip.addColorStop(1, `rgb(${g.rgb} / 0)`)
  ctx.fillStyle = lip
  ctx.fillRect(0, 0, SPRITE, SPRITE)
  ctx.restore()
  // the glint: small and crisp
  const gx = c - R * 0.36
  const gy = c - R * 0.42
  const glint = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * g.size)
  glint.addColorStop(0, `rgb(${g.rgb} / ${g.alpha})`)
  glint.addColorStop(0.45, `rgb(${g.rgb} / ${g.alpha * 0.55})`)
  glint.addColorStop(1, `rgb(${g.rgb} / 0)`)
  ctx.fillStyle = glint
  ctx.fillRect(0, 0, SPRITE, SPRITE)
}

const BG_W = Math.round(W * BG_SCALE)
const BG_H = Math.round(H * BG_SCALE)

/**
 * The view's still, decoded and shrunk to half the backdrop's size off the main thread where the
 * browser can (createImageBitmap), so a change of time doesn't stall the room for a frame or
 * two: drawing the full still into a canvas decoded it on the main thread and read it back from
 * the GPU (measured 50-70 ms).
 */
function halfStill(img: HTMLImageElement): Promise<CanvasImageSource> {
  if (typeof createImageBitmap !== 'function') return Promise.resolve(img)
  return createImageBitmap(img, {
    resizeWidth: Math.round(BG_W / 2),
    resizeHeight: Math.round(BG_H / 2),
    resizeQuality: 'low', // the same soft half-size step as the canvas it replaces
  }).catch(() => img)
}

/** The view behind the glass, small and soft, for the drops to refract (re-mixed to an overcast sky by day). */
function drawBackdrop(canvas: HTMLCanvasElement, img: CanvasImageSource, overcast: boolean, gain: number) {
  const w = BG_W
  const h = BG_H
  let small: CanvasImageSource = img
  const halfSized = typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap && img.width === Math.round(w / 2)
  if (!halfSized) {
    // no bitmap (an older browser): shrink it here, on a canvas kept on the CPU
    const half = document.createElement('canvas')
    half.width = Math.round(w / 2)
    half.height = Math.round(h / 2)
    half.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, half.width, half.height)
    small = half
  }
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, 0, 0, w, h) // down and up again: a soft, out-of-focus view
  // A drop gathers light: what it shows is a little brighter and clearer than the glass around it.
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  const lift = (v: number) => Math.min(255, (v - 128) * 1.12 + 128 + gain)
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i]!
    let g = px[i + 1]!
    let b = px[i + 2]!
    if (overcast) [r, g, b] = overcastRgb(r, g, b)
    px[i] = lift(r)
    px[i + 1] = lift(g)
    px[i + 2] = lift(b)
  }
  ctx.putImageData(data, 0, 0)
}

/** Where the glass is, from the view's mask, sampled every 2 px. */
function readGlass(img: HTMLImageElement): GlassMap {
  const step = 2
  const cols = Math.ceil(W / step)
  const rows = Math.ceil(H / step)
  const canvas = document.createElement('canvas')
  canvas.width = cols
  canvas.height = rows
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, cols, rows)
  const rgba = ctx.getImageData(0, 0, cols, rows).data
  const alpha = new Uint8ClampedArray(cols * rows)
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]!
  return { width: W, height: H, step, alpha }
}

interface GlassDropsProps {
  raining: boolean
  time: TimeOfDay
  /** The room may move: drops land and run only then (otherwise the glass holds still). */
  moving: boolean
  /** Told after every draw whether any drop is left on the canvas (WeatherLayer hides the empty glass). */
  onDrawn?: (drawn: boolean) => void
}

/**
 * Raindrops on the window's glass while it rains (see scene/glassDrops.ts for
 * how they land, merge and run). One canvas, in the window view's box under
 * its glass mask (it sits inside WeatherLayer). Each drop is a tiny lens: it
 * shows a soft, upside-down patch of the view behind it, with a darker rim
 * and a glint of the room's light. Beads are drawn to a still layer that is
 * redrawn only when something changes; only the running drops are drawn each
 * frame. A page that opens in the rain starts with the glass already wet.
 * Decorative only.
 */
export function GlassDrops({ raining, time, moving, onDrawn }: GlassDropsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const state = useRef<{
    glass: Glass
    map: GlassMap | null
    rand: () => number
    still: HTMLCanvasElement
    sprite: HTMLCanvasElement
    backdrop: HTMLCanvasElement
    pattern: CanvasPattern | null
    /** 0-1: how much of the lamp's extra glint the drops catch (night), faded with the light */
    lamp: number
    scale: number
    lastStill: number
  } | null>(null)
  if (!state.current && typeof document !== 'undefined') {
    state.current = {
      glass: makeGlass(),
      map: null,
      rand: seeded(1124),
      still: document.createElement('canvas'),
      sprite: document.createElement('canvas'),
      backdrop: document.createElement('canvas'),
      pattern: null,
      lamp: 0,
      scale: 1,
      lastStill: -Infinity,
    }
  }
  const props = useRef({ raining, time, moving })
  props.current = { raining, time, moving }
  const drawnRef = useRef(onDrawn)
  drawnRef.current = onDrawn
  const redraw = useRef<() => void>(() => {})
  /** Draws one frame now (used while the light fades, whether or not the drops are moving). */
  const paint = useRef<() => void>(() => {})
  const reducedMotion = usePrefersReducedMotion()
  const wetOnArrival = useRef(raining)

  // Size the canvas (and the still layer) to the window on screen.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const s = state.current
    if (!canvas || !s || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width === w && canvas.height === h) return
      canvas.width = s.still.width = w
      canvas.height = s.still.height = h
      s.scale = w / W
      s.glass.dirty = true
      redraw.current()
    }
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)
    fit()
    return () => observer.disconnect()
  }, [])

  // The glass's shape, once.
  useEffect(() => {
    let gone = false
    void loadImage(WINDOW_VIEW_MASK).then((img) => {
      const s = state.current
      if (gone || !s) return
      s.map = readGlass(img)
      if (wetOnArrival.current) wetGlass(s.glass, s.map, 45, s.rand)
      redraw.current()
    }, () => {})
    return () => {
      gone = true
    }
  }, [])

  // The light: the view the drops refract, their glint and the lamp's warmth.
  // A new light fades in over the same time as the view through the window
  // (WindowView), so the drops never show one light while the glass shows another.
  const overcast = raining && time === 'midday'
  useEffect(() => {
    const s = state.current
    if (!s) return
    const nextSprite = document.createElement('canvas')
    drawSprite(nextSprite, time)
    const nextLamp = time === 'night' ? 1 : 0
    let gone = false
    let frame = 0
    void loadImage(WINDOW_VIEWS[time].still).then(halfStill).then((img) => {
      const release = () => {
        if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) img.close()
      }
      if (gone) return release()
      const nextBackdrop = document.createElement('canvas')
      try {
        drawBackdrop(nextBackdrop, img, overcast, GLINT[time].lift)
      } finally {
        release()
      }
      const first = s.backdrop.width === 0
      const fromBackdrop = copyOf(s.backdrop)
      const fromSprite = copyOf(s.sprite)
      const fromLamp = s.lamp
      const duration = reducedMotion ? REDUCED_FADE_MS : VIEW_FADE_MS
      const start = performance.now()
      const step = (now: number) => {
        const k = first ? 1 : easeInOut((now - start) / duration)
        mix(s.backdrop, fromBackdrop, nextBackdrop, k)
        mix(s.sprite, fromSprite, nextSprite, k)
        s.lamp = fromLamp + (nextLamp - fromLamp) * k
        s.pattern = s.still.getContext('2d')!.createPattern(s.backdrop, 'no-repeat')
        s.glass.dirty = true
        s.lastStill = -Infinity // redraw the beads in this light now
        paint.current()
        if (k < 1) frame = requestAnimationFrame(step)
      }
      step(start)
    }, () => {})
    return () => {
      gone = true
      cancelAnimationFrame(frame)
    }
  }, [time, overcast, reducedMotion])

  // Drawing, and the loop that moves the drops while the room may move.
  useEffect(() => {
    const canvas = canvasRef.current
    const s = state.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !s || !ctx) return
    const stillCtx = s.still.getContext('2d')!

    const drop = (c: CanvasRenderingContext2D, d: Drop | Runner, rx: number, ry: number, alpha: number) => {
      if (alpha <= 0.01) return
      c.globalAlpha = alpha
      if (rx >= LENS_FROM && s.pattern) {
        // Upside down and gathered from around it, as through a tiny lens.
        const k = -1 / (LENS * BG_SCALE)
        s.pattern.setTransform(new DOMMatrix([k, 0, 0, k, d.x * (1 + 1 / LENS), d.y * (1 + 1 / LENS)]))
        c.fillStyle = s.pattern
        c.beginPath()
        c.ellipse(d.x, d.y, rx, ry, 0, 0, Math.PI * 2)
        c.fill()
      }
      c.drawImage(s.sprite, d.x - rx * 1.11, d.y - ry * 1.11, rx * 2.22, ry * 2.22)
      if (s.lamp > 0.01) {
        // after dark, a second glint, fading with distance from the lamp
        const near = Math.exp(-((d.x - BULB.x) ** 2 + (d.y - BULB.y) ** 2) / (2 * LAMP_REACH * LAMP_REACH))
        if (near > 0.05) {
          c.globalAlpha = alpha * near * 0.8 * s.lamp
          c.drawImage(s.sprite, d.x - rx * 1.11, d.y - ry * 1.11, rx * 2.22, ry * 2.22)
        }
      }
    }

    const drawStill = () => {
      stillCtx.setTransform(1, 0, 0, 1, 0, 0)
      stillCtx.clearRect(0, 0, s.still.width, s.still.height)
      stillCtx.setTransform(s.scale, 0, 0, s.scale, 0, 0)
      for (const b of s.glass.beads) drop(stillCtx, b, b.r, b.r * 0.94, b.alpha)
      stillCtx.globalAlpha = 1
      s.glass.dirty = false
    }

    const draw = (now: number) => {
      if (s.glass.dirty && now - s.lastStill >= STILL_EVERY_MS) {
        drawStill()
        s.lastStill = now
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(s.still, 0, 0)
      ctx.setTransform(s.scale, 0, 0, s.scale, 0, 0)
      for (const r of s.glass.runners) {
        // a running drop leans long, narrower at the top
        const run = Math.min(1, r.vy / 60)
        drop(ctx, r, r.r * (1 - 0.1 * run), r.r * (1 + 0.22 * run), 1)
      }
      ctx.globalAlpha = 1
      // The beads' layer can lag behind the beads (it is redrawn at most every 80 ms): until it
      // has caught up, it may still hold drops.
      drawnRef.current?.(s.glass.dirty || s.glass.beads.length > 0 || s.glass.runners.length > 0)
    }

    let frame = 0
    let last = 0
    const tick = (now: number) => {
      frame = 0
      const map = s.map
      if (!map || !props.current.moving) return
      if (roomCovered()) {
        // Under the phone's page: the glass rests exactly as it is, and carries on from there once uncovered.
        last = 0
        return
      }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      stepGlass(s.glass, map, dt, props.current.raining, s.rand)
      draw(now)
      const settled = !props.current.raining && s.glass.beads.length === 0 && s.glass.runners.length === 0
      if (!settled) {
        frame = requestAnimationFrame(tick)
      } else {
        // the beads' layer is redrawn at most every 80 ms: draw the dry glass once more, so no drop is left behind
        s.lastStill = -Infinity
        draw(now)
      }
    }

    paint.current = () => draw(performance.now())
    redraw.current = () => {
      if (!props.current.moving || !s.map) {
        // Held still: draw the glass as it is, at once.
        s.lastStill = -Infinity
        if (props.current.raining && s.map && s.glass.beads.length === 0) wetGlass(s.glass, s.map, 45, s.rand)
        if (!props.current.raining) {
          s.glass.beads.length = 0
          s.glass.runners.length = 0
        }
        s.glass.dirty = true
        draw(performance.now())
        return
      }
      if (!frame) {
        last = 0
        frame = requestAnimationFrame(tick)
      }
    }
    redraw.current()
    const offCovered = onRoomCovered((covered) => !covered && props.current.moving && redraw.current())
    return () => {
      cancelAnimationFrame(frame)
      frame = 0
      redraw.current = () => {}
      paint.current = () => {}
      offCovered()
    }
  }, [raining, moving])

  return <canvas ref={canvasRef} className="glass-drops" aria-hidden="true" />
}

