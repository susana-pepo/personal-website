import { useEffect, useLayoutEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { easeInOut } from '../../../lib/motion'
import { RAIN_LIGHT, leanAt, makeRain, mixRainLight, stepStreak, streakAlpha, type RainLight, type Streak } from '../../../scene/rain'
import { seeded } from '../../../scene/weather'
import { WINDOW_VIEW_BOX, type TimeOfDay } from '../../../scene/windowViews'
import { VIEW_FADE_MS } from './WindowView'

const W = WINDOW_VIEW_BOX.width
const H = WINDOW_VIEW_BOX.height
const MAX_DPR = 1.5
/** How fast the rain sets in or eases off as a whole (intensity per second): about 2.5 s. */
const INTENSITY_RATE = 0.4
/** WindowView's fade with reduced motion. */
const REDUCED_FADE_MS = 400
const SPRITE_W = 16
const SPRITE_H = 128

/** One streak of light: brightest at its head (the drop), fading back along its tail, soft at the sides. */
function drawSprite(canvas: HTMLCanvasElement, light: RainLight) {
  canvas.width = SPRITE_W
  canvas.height = SPRITE_H
  const ctx = canvas.getContext('2d')!
  const [r, g, b] = light.rgb.map(Math.round) as [number, number, number]
  ctx.clearRect(0, 0, SPRITE_W, SPRITE_H)
  const along = ctx.createLinearGradient(0, 0, 0, SPRITE_H)
  along.addColorStop(0, `rgb(${r} ${g} ${b} / 0)`)
  along.addColorStop(0.55, `rgb(${r} ${g} ${b} / 0.45)`)
  along.addColorStop(0.92, `rgb(${r} ${g} ${b} / 1)`)
  along.addColorStop(1, `rgb(${r} ${g} ${b} / 0.6)`)
  ctx.fillStyle = along
  ctx.fillRect(0, 0, SPRITE_W, SPRITE_H)
  ctx.globalCompositeOperation = 'destination-in'
  const across = ctx.createLinearGradient(0, 0, SPRITE_W, 0)
  across.addColorStop(0, 'rgb(0 0 0 / 0)')
  across.addColorStop(0.5, 'rgb(0 0 0 / 1)')
  across.addColorStop(1, 'rgb(0 0 0 / 0)')
  ctx.fillStyle = across
  ctx.fillRect(0, 0, SPRITE_W, SPRITE_H)
  ctx.globalCompositeOperation = 'source-over'
}

interface RainLayerProps {
  raining: boolean
  /** The light outside: the rain takes its colour. */
  time: TimeOfDay
  /** The room may move: rain falls only then (otherwise it holds still). */
  moving: boolean
}

/**
 * Rain outside the window, drawn on one canvas in the window view's box under
 * its glass mask (inside WeatherLayer, behind the snow, the frost and the drops
 * on the glass). See scene/rain.ts for the streaks. It sets in and eases off
 * over a couple of seconds, takes the colour of the light, and changes light
 * with the view when the time changes. Still with reduced motion or a paused
 * room. Decorative only.
 */
export function RainLayer({ raining, time, moving }: RainLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const state = useRef<{
    streaks: Streak[]
    rand: () => number
    t: number
    intensity: number
    light: RainLight
    fromLight: RainLight
    toLight: RainLight
    fadeStart: number
    sprite: HTMLCanvasElement
    scale: number
  } | null>(null)
  if (!state.current && typeof document !== 'undefined') {
    const rand = seeded(424)
    const light = RAIN_LIGHT[time]
    const sprite = document.createElement('canvas')
    drawSprite(sprite, light)
    state.current = {
      streaks: makeRain(rand, W, H),
      rand,
      t: 0,
      intensity: 0,
      light,
      fromLight: light,
      toLight: light,
      fadeStart: -1,
      sprite,
      scale: 1,
    }
  }
  const props = useRef({ raining, moving, reducedMotion })
  props.current = { raining, moving, reducedMotion }
  const kick = useRef<() => void>(() => {})

  // Size the canvas to the window on screen.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const s = state.current
    if (!canvas || !s || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      s.scale = w / W
      kick.current()
    }
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)
    fit()
    return () => observer.disconnect()
  }, [])

  // A new light fades in with the view.
  useEffect(() => {
    const s = state.current
    if (!s) return
    s.fromLight = s.light
    s.toLight = RAIN_LIGHT[time]
    s.fadeStart = performance.now()
    kick.current()
  }, [time])

  useEffect(() => {
    const canvas = canvasRef.current
    const s = state.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !s) return

    const draw = (lean: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const k = s.scale
      const cos = Math.cos(lean) * k
      const sin = Math.sin(lean) * k
      for (const st of s.streaks) {
        const a = streakAlpha(st) * s.light.alpha
        if (a <= 0.01) continue
        ctx.globalAlpha = a
        // along the fall: the sprite's head at the drop, its tail trailing up the lean
        ctx.setTransform(cos, sin, -sin, cos, st.x * k, st.y * k)
        ctx.drawImage(s.sprite, -st.width * 1.2, -st.length, st.width * 2.4, st.length)
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
    }

    const settleLight = (now: number) => {
      if (s.fadeStart < 0) return false
      const duration = props.current.reducedMotion ? REDUCED_FADE_MS : VIEW_FADE_MS
      const k = easeInOut((now - s.fadeStart) / duration)
      s.light = mixRainLight(s.fromLight, s.toLight, k)
      drawSprite(s.sprite, s.light)
      if (k >= 1) s.fadeStart = -1
      return true
    }

    let frame = 0
    let last = 0
    const tick = (now: number) => {
      frame = 0
      const p = props.current
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      const goal = p.raining ? 1 : 0
      if (!p.moving) {
        // held still: the rain as it is, or none
        s.intensity = goal
        for (const st of s.streaks) st.presence = st.threshold < goal ? 1 : 0
        if (s.fadeStart >= 0) {
          s.light = s.toLight
          s.fadeStart = -1
          drawSprite(s.sprite, s.light)
        }
        draw(leanAt(s.t))
        last = 0
        return
      }
      s.t += dt
      s.intensity = goal > s.intensity ? Math.min(1, s.intensity + INTENSITY_RATE * dt) : Math.max(0, s.intensity - INTENSITY_RATE * dt)
      settleLight(now)
      const lean = leanAt(s.t)
      let showing = false
      for (const st of s.streaks) {
        stepStreak(st, dt, lean, s.intensity, s.rand, W, H)
        if (st.presence > 0) showing = true
      }
      draw(lean)
      if (goal === 1 || showing || s.fadeStart >= 0) frame = requestAnimationFrame(tick)
      else last = 0
    }
    kick.current = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }
    kick.current()
    return () => {
      cancelAnimationFrame(frame)
      kick.current = () => {}
    }
  }, [raining, moving])

  return <canvas ref={canvasRef} className="rain" aria-hidden="true" />
}
