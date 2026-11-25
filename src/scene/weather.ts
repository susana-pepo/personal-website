import { WINDOW_VIEW_BOX, type TimeOfDay } from './windowViews'

/** The weather outside the window. Rain is the painting's own (a rainy evening); the room starts clear. */
export const WEATHERS = ['clear', 'rain', 'snow'] as const
export type Weather = (typeof WEATHERS)[number]
export const DEFAULT_WEATHER: Weather = 'clear'

/** The weathers the control offers, in order. */
export const WEATHER_CHOICES: readonly Weather[] = WEATHERS

export function isWeather(value: unknown): value is Weather {
  return typeof value === 'string' && (WEATHERS as readonly string[]).includes(value)
}

/** The parts of the scene's description that depend on the weather. */
export const WEATHER_WORDS: Record<Weather, { evening: string; outside: string }> = {
  rain: { evening: 'a rainy evening', outside: 'Outside, rain falls over a city skyline at dusk.' },
  clear: { evening: 'a quiet evening', outside: 'Outside, a city skyline at dusk under a clear sky.' },
  snow: { evening: 'a snowy evening', outside: 'Outside, snow falls softly over a city skyline at dusk.' },
}

// ── Snow ─────────────────────────────────────────────────────────────────────
// Simulated in canvas px (the 1920x1080 painting) inside the box around the
// window's glass, so the motion is the same at every screen size.

/** The box the snow is drawn in, on the 1920x1080 canvas: the window view's own box (its mask is the glass). */
export const SNOW_BOX = WINDOW_VIEW_BOX

export interface Flake {
  x: number
  y: number
  /** 0 far … 1 near: size, speed, sway and brightness all follow it. */
  z: number
  r: number
  /** fall speed, px/s */
  vy: number
  swayAmp: number
  swayFreq: number
  phase: number
  spin: number
  spinRate: number
  /** 0-1: below the snow's intensity, this flake is falling. */
  threshold: number
  /** 0-1: how much of it shows (eases toward 1 while it's falling, 0 when not). */
  presence: number
}

export type Rand = () => number

/** A deterministic random source (mulberry32), for tests and stable first frames. */
export function seeded(seed: number): Rand {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mostly far, small, slow flakes; a few large, soft ones close to the glass. */
export function makeFlake(rand: Rand, y?: number): Flake {
  const z = Math.pow(rand(), 1.7)
  return {
    x: rand() * SNOW_BOX.width,
    y: y ?? rand() * SNOW_BOX.height,
    z,
    r: 0.7 + Math.pow(z, 1.6) * 3.2,
    vy: 11 + z * 40 + rand() * 5,
    swayAmp: 2.5 + z * 10 + rand() * 3,
    swayFreq: 0.12 + rand() * 0.28,
    phase: rand() * Math.PI * 2,
    spin: rand() * Math.PI * 2,
    spinRate: 0.3 + rand() * 1.1,
    threshold: rand(),
    presence: 0,
  }
}

export function makeFlakes(count: number, rand: Rand): Flake[] {
  return Array.from({ length: count }, () => makeFlake(rand))
}

/**
 * The wind at a moment (seconds): a slow, never-repeating breeze toward the
 * right, from a few incommensurate swells; it never turns to blow upward.
 * Returned as a fraction of a flake's own drift speed, about 0.05-0.75.
 */
export function windAt(t: number): number {
  return 0.4 + 0.2 * Math.sin(t * 0.071) + 0.1 * Math.sin(t * 0.19 + 1.3) + 0.05 * Math.sin(t * 0.43 + 2.1)
}

/** How quickly a flake appears or melts away when the snow starts or stops (per second). */
const PRESENCE_RATE = 0.9

/**
 * Moves one flake on by `dt` seconds at time `t` (both in seconds), given the
 * snow's intensity (0-1). Flakes below the intensity fade in where they are;
 * others fade out. One that falls past the bottom comes back in above the top.
 */
export function stepFlake(f: Flake, dt: number, t: number, intensity: number, rand: Rand): void {
  const target = f.threshold < intensity ? 1 : 0
  const step = PRESENCE_RATE * dt
  f.presence = target > f.presence ? Math.min(target, f.presence + step) : Math.max(target, f.presence - step)

  const drift = 10 + f.z * 30
  f.y += f.vy * dt
  f.x += windAt(t) * drift * dt + Math.cos(t * f.swayFreq * Math.PI * 2 + f.phase) * f.swayAmp * f.swayFreq * dt * 2
  f.spin += f.spinRate * dt

  const margin = f.r + 20
  if (f.y > SNOW_BOX.height + margin) {
    f.y = -margin - rand() * 30
    f.x = rand() * SNOW_BOX.width
  }
  if (f.x > SNOW_BOX.width + margin) f.x -= SNOW_BOX.width + 2 * margin
  else if (f.x < -margin) f.x += SNOW_BOX.width + 2 * margin
}

/**
 * How bright a flake is (0-1): nearer flakes are brighter, and a tumbling flake
 * catches the light now and then.
 */
export function flakeAlpha(f: Flake): number {
  const tumble = 0.78 + 0.22 * Math.abs(Math.cos(f.spin))
  return (0.5 + f.z * 0.5) * tumble * f.presence
}

export interface SnowLight {
  /** the flakes' colour, as r, g, b (0-255) */
  rgb: readonly [number, number, number]
  /** overall strength of the flakes (above 1 lifts the faint far ones) */
  alpha: number
  /** how large the flakes are drawn: a pale day sky needs them a little larger to read */
  size: number
}

/** The snow's colour in each light: warm at dawn, bright and firm against the grey day sky, cool and dim at night. */
export const SNOW_LIGHT: Record<TimeOfDay, SnowLight> = {
  dawn: { rgb: [255, 244, 240], alpha: 0.92, size: 1 },
  midday: { rgb: [255, 255, 255], alpha: 1.7, size: 1.4 },
  night: { rgb: [226, 233, 250], alpha: 0.9, size: 1 },
}

/** A colour part way (0-1) from one light to another. */
export function mixLight(a: SnowLight, b: SnowLight, k: number): SnowLight {
  const m = (x: number, y: number) => x + (y - x) * k
  return {
    rgb: [m(a.rgb[0], b.rgb[0]), m(a.rgb[1], b.rgb[1]), m(a.rgb[2], b.rgb[2])],
    alpha: m(a.alpha, b.alpha),
    size: m(a.size, b.size),
  }
}

// ── A rainy day's light ──────────────────────────────────────────────────────
// By day, rain needs an overcast sky. Rather than laying a grey over the view,
// the view's own colours are re-mixed (an SVG colour filter, see WeatherSky):
// the blue sky turns a soft grey that keeps its painted gradient, everything
// else loses some colour and sun, and the highlights roll off.

export interface OvercastLook {
  /** colour kept outside the sky (0 grey … 1 as painted) */
  saturation: number
  /** light kept outside the sky */
  brightness: number
  /** the sky's grey: luminance × k + c, plus a slight cool tint */
  skyK: number
  skyC: number
  skyTint: readonly [number, number, number]
  /** what counts as sky: alpha = a × (blue − red) + b, clamped */
  skyA: number
  skyB: number
  /** tone curve (0-1 in, evenly spaced): softens shadows and rolls off highlights */
  curve: readonly number[]
}

export const RAINY_DAY: OvercastLook = {
  saturation: 0.55,
  brightness: 0.8,
  skyK: 0.5,
  skyC: 0.2,
  skyTint: [-0.015, 0, 0.025],
  skyA: 3.2,
  skyB: -0.35,
  curve: [0.03, 0.27, 0.5, 0.64, 0.74],
}

const LUM = [0.3, 0.59, 0.11] as const
const fmt = (values: number[]) => values.map((v) => +v.toFixed(4)).join(' ')

/** feColorMatrix values for everything but the sky: less colour, less sun. */
export function dullMatrix(look: OvercastLook): string {
  const s = look.saturation
  const b = look.brightness
  const row = (i: number) => [0, 1, 2].map((j) => b * ((1 - s) * LUM[j]! + (i === j ? s : 0)))
  return fmt([...row(0), 0, 0, ...row(1), 0, 0, ...row(2), 0, 0, 0, 0, 0, 1, 0])
}

/** feColorMatrix values for the sky: a soft grey from its own luminance, opaque only where it's blue. */
export function skyMatrix(look: OvercastLook): string {
  const grey = (tint: number) => [...LUM.map((w) => look.skyK * w), 0, look.skyC + tint]
  return fmt([...grey(look.skyTint[0]), ...grey(look.skyTint[1]), ...grey(look.skyTint[2]), -look.skyA, 0, look.skyA, 0, look.skyB])
}

/** feFuncR/G/B tableValues for the tone curve. */
export function curveTable(look: OvercastLook): string {
  return fmt([...look.curve])
}
