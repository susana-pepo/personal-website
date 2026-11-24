import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { easeInOut } from '../../../lib/motion'
import { WINDOW_GLASS_STYLE, type TimeOfDay } from '../../../scene/windowViews'
import {
  SNOW_BOX,
  SNOW_LIGHT,
  RAINY_DAY,
  curveTable,
  dullMatrix,
  flakeAlpha,
  skyMatrix,
  makeFlakes,
  mixLight,
  seeded,
  stepFlake,
  type Flake,
  type SnowLight,
  type Weather,
} from '../../../scene/weather'
import { FrostLayer } from './FrostLayer'
import { GlassDrops } from './GlassDrops'
import './WeatherLayer.css'

const FLAKE_COUNT = 420
/** How fast the snow as a whole starts or stops (intensity per second): about 3 s. */
const INTENSITY_RATE = 0.35
/** Flakes this near are out of focus: drawn larger and softer. */
const SOFT_FROM = 0.72
const MAX_DPR = 1.5
const SPRITE = 64


/** A round, soft-edged flake in the light's colour; `soft` for the out-of-focus near ones. */
function drawSprite(canvas: HTMLCanvasElement, light: SnowLight, soft: boolean) {
  canvas.width = SPRITE
  canvas.height = SPRITE
  const ctx = canvas.getContext('2d')!
  const [r, g, b] = light.rgb.map(Math.round) as [number, number, number]
  const c = (a: number) => `rgba(${r}, ${g}, ${b}, ${a})`
  const half = SPRITE / 2
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half)
  if (soft) {
    grad.addColorStop(0, c(0.5))
    grad.addColorStop(0.45, c(0.36))
    grad.addColorStop(0.8, c(0.1))
    grad.addColorStop(1, c(0))
  } else {
    grad.addColorStop(0, c(1))
    grad.addColorStop(0.3, c(0.9))
    grad.addColorStop(0.62, c(0.32))
    grad.addColorStop(1, c(0))
  }
  ctx.clearRect(0, 0, SPRITE, SPRITE)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, SPRITE, SPRITE)
}

/** The fade into or out of a rainy day's light, in ms. */
const SKY_FADE_MS = 2600
const SKY_FADE_REDUCED_MS = 400

interface WeatherSkyProps {
  weather: Weather
  /** The light outside: only midday's sunny view needs clouding over. */
  time: TimeOfDay
}

/**
 * A rainy (or snowy) day's light. By day the painted view is a sunny summer
 * sky, so when it rains or snows its own colours are re-mixed (an SVG colour filter on the view,
 * nothing laid over it): the blue sky becomes a soft grey that keeps its
 * painted gradient and clouds, everything else loses some colour and sun, and
 * the highlights roll off. It blends in and out over a few seconds. At dawn and
 * night the painted skies already suit rain and snow. Only the view changes:
 * the room's own light never follows the weather. Decorative only.
 */
export function WeatherSky({ weather, time }: WeatherSkyProps) {
  const reducedMotion = usePrefersReducedMotion()
  // Rain and snow both need a grey sky by day.
  const on = weather !== 'clear' && time === 'midday'
  const blend = useRef<SVGFECompositeElement>(null)
  const amount = useRef(on ? 1 : 0)
  // The filter is applied only while any of it shows.
  const [active, setActive] = useState(on)

  useEffect(() => {
    const el = blend.current
    const apply = (t: number) => {
      el?.setAttribute('k2', t.toFixed(4))
      el?.setAttribute('k3', (1 - t).toFixed(4))
    }
    const target = on ? 1 : 0
    const from = amount.current
    if (on) setActive(true)
    if (from === target) {
      apply(target)
      if (!on) setActive(false)
      return
    }
    const duration = (reducedMotion ? SKY_FADE_REDUCED_MS : SKY_FADE_MS) * Math.abs(target - from)
    const start = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const k = Math.min(1, (now - start) / duration)
      amount.current = from + (target - from) * easeInOut(k)
      apply(amount.current)
      if (k < 1) frame = requestAnimationFrame(step)
      else if (!on) setActive(false)
    })
    return () => cancelAnimationFrame(frame)
  }, [on, reducedMotion])

  const t = amount.current
  return (
    <svg className="weather-sky" aria-hidden="true" focusable="false" width="0" height="0" data-on={active ? '' : undefined}>
      <filter id="rainy-day" colorInterpolationFilters="sRGB" x="0" y="0" width="1" height="1">
        <feColorMatrix in="SourceGraphic" type="matrix" values={DULL} result="dull" />
        <feColorMatrix in="SourceGraphic" type="matrix" values={SKY} result="sky" />
        <feMerge result="overcast">
          <feMergeNode in="dull" />
          <feMergeNode in="sky" />
        </feMerge>
        <feComponentTransfer in="overcast" result="toned">
          <feFuncR type="table" tableValues={CURVE} />
          <feFuncG type="table" tableValues={CURVE} />
          <feFuncB type="table" tableValues={CURVE} />
        </feComponentTransfer>
        <feComposite ref={blend} in="toned" in2="SourceGraphic" operator="arithmetic" k1="0" k2={t} k3={1 - t} k4="0" />
      </filter>
    </svg>
  )
}

const DULL = dullMatrix(RAINY_DAY)
const SKY = skyMatrix(RAINY_DAY)
const CURVE = curveTable(RAINY_DAY)

interface WeatherLayerProps {
  weather: Weather
  /** The light outside: the snow takes its colour. */
  time: TimeOfDay
  /** The room may move: otherwise the snow holds still where it is. */
  motionAllowed: boolean
}

/**
 * Snow behind the window's glass (masked to its exact glass, like the view), drawn on a
 * single canvas: a few hundred flakes at different depths, the far ones small,
 * dim and slow, the near ones larger, brighter and out of focus, each swaying
 * and tumbling on its own way down while a slow breeze carries them all. When
 * the snow starts or stops, the flakes thicken or thin out one by one where
 * they are. It draws only
 * while snow is falling, the room may move and the tab is visible (with reduced
 * motion or a paused room, it holds still). Rain is the CSS layer in WindowLife;
 * this layer fades it with the weather. Decorative only.
 */
export function WeatherLayer({ weather, time, motionAllowed }: WeatherLayerProps) {
  const reducedMotion = usePrefersReducedMotion()
  const moving = motionAllowed && !reducedMotion
  const snowing = weather === 'snow'
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Everything the drawing loop needs, kept across renders.
  const sim = useRef<{
    flakes: Flake[]
    rand: () => number
    t: number
    intensity: number
    light: SnowLight
    sharp: HTMLCanvasElement
    soft: HTMLCanvasElement
    scale: number
  } | null>(null)
  const target = useRef({ snowing, time, moving })
  target.current = { snowing, time, moving }
  const frame = useRef(0)
  const kick = useRef<() => void>(() => {})

  // Size the canvas to its box on screen (sharp on high-density screens, capped).
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      if (sim.current) sim.current.scale = w / SNOW_BOX.width
      kick.current()
    }
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)
    fit()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const ensure = () => {
      if (sim.current) return sim.current
      const rand = seeded(20261123)
      const light = SNOW_LIGHT[target.current.time]
      const sharp = document.createElement('canvas')
      const soft = document.createElement('canvas')
      drawSprite(sharp, light, false)
      drawSprite(soft, light, true)
      // Draw far flakes first, near ones over them.
      const flakes = makeFlakes(FLAKE_COUNT, rand).sort((a, b) => a.z - b.z)
      sim.current = { flakes, rand, t: 0, intensity: 0, light, sharp, soft, scale: canvas.width / SNOW_BOX.width }
      return sim.current
    }

    const draw = () => {
      const s = sim.current
      if (!s) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(s.scale, 0, 0, s.scale, 0, 0)
      const strength = s.light.alpha
      for (const f of s.flakes) {
        const a = flakeAlpha(f) * strength
        if (a <= 0.004) continue
        const softFlake = f.z >= SOFT_FROM
        const size = f.r * (softFlake ? 3.8 : 2.6) * s.light.size
        ctx.globalAlpha = Math.min(1, a)
        ctx.drawImage(softFlake ? s.soft : s.sharp, f.x - size / 2, f.y - size / 2, size, size)
      }
      ctx.globalAlpha = 1
    }

    const settleLight = (s: NonNullable<typeof sim.current>, k: number) => {
      const goal = SNOW_LIGHT[target.current.time]
      const next = k >= 1 ? goal : mixLight(s.light, goal, k)
      const far = Math.abs(next.rgb[0] - s.light.rgb[0]) + Math.abs(next.rgb[1] - s.light.rgb[1]) + Math.abs(next.rgb[2] - s.light.rgb[2])
      if (far > 0.4 || k >= 1) {
        s.light = next
        drawSprite(s.sharp, next, false)
        drawSprite(s.soft, next, true)
      } else {
        s.light = { ...s.light, alpha: next.alpha, size: next.size }
      }
    }

    // Still: the snow as it would be, at once (or nothing), held where it is.
    const still = () => {
      const s = target.current.snowing ? ensure() : sim.current
      if (!s) return
      s.intensity = target.current.snowing ? 1 : 0
      for (const f of s.flakes) f.presence = f.threshold < s.intensity ? 1 : 0
      settleLight(s, 1)
      // Stopping: the canvas fades out as it is (see its opacity), so leave it drawn.
      if (target.current.snowing) draw()
    }

    let last = 0
    const tick = (now: number) => {
      frame.current = 0
      const s = sim.current
      if (!s || !target.current.moving) return
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      s.t += dt
      const goal = target.current.snowing ? 1 : 0
      const step = INTENSITY_RATE * dt
      s.intensity = goal > s.intensity ? Math.min(goal, s.intensity + step) : Math.max(goal, s.intensity - step)
      settleLight(s, Math.min(1, dt * 1.2))
      let anyShowing = false
      for (const f of s.flakes) {
        stepFlake(f, dt, s.t, s.intensity, s.rand)
        if (f.presence > 0) anyShowing = true
      }
      draw()
      // Rest once the snow has fully stopped.
      if (goal === 0 && s.intensity === 0 && !anyShowing) {
        last = 0
        return
      }
      frame.current = requestAnimationFrame(tick)
    }

    kick.current = () => {
      if (!target.current.moving) {
        still()
        return
      }
      if (target.current.snowing) ensure()
      if (!sim.current || frame.current) return
      last = 0
      frame.current = requestAnimationFrame(tick)
    }
    kick.current()
    return () => {
      cancelAnimationFrame(frame.current)
      frame.current = 0
      kick.current = () => {}
    }
  }, [snowing, time, moving])

  return (
    <span className="weather-layer" aria-hidden="true" data-weather={weather} style={WINDOW_GLASS_STYLE}>
      <canvas
        ref={canvasRef}
        className="weather-snow"
        style={{ opacity: moving || snowing ? 1 : 0 }}
      />
      <FrostLayer snowing={snowing} time={time} moving={moving} />
      <GlassDrops raining={weather === 'rain'} time={time} moving={moving} />
    </span>
  )
}
