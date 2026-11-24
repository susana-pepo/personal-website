import type { Rand } from './weather'
import type { TimeOfDay } from './windowViews'

/*
 * Rain falling outside the window, as streaks: the eye sees a falling drop as a
 * short line of light. Three depths: many fine, faint, short streaks far away,
 * fewer and brighter in the middle, and a handful of long, bright ones close
 * to the glass, each falling faster the nearer it is. All lean a little with
 * the wind, which shifts slowly. Simulated in the window view's own pixels
 * (its 957×695 box on the canvas). No DOM here.
 */

export interface Streak {
  x: number
  y: number
  /** 0 far … 1 near */
  z: number
  /** px */
  length: number
  width: number
  /** px/s along the fall */
  speed: number
  /** 0-1: below the rain's intensity this streak is falling */
  threshold: number
  /** 0-1: how much of it shows (eases with the intensity) */
  presence: number
  /** brightness variation, 0.7-1 */
  shade: number
}

export const RAIN = {
  far: 320,
  mid: 150,
  near: 26,
  /** the lean of the rain, radians from vertical (positive: falling to the left, as in the painting) */
  lean: 0.17,
  /** how much the wind swings the lean either way */
  gust: 0.05,
} as const

/** A streak at depth z, somewhere in a box `width` × `height` (or just above it, when `fromTop`). */
export function makeStreak(rand: Rand, z: number, width: number, height: number, fromTop = false): Streak {
  const length = 14 + z * z * 62 + rand() * (6 + z * 16)
  return {
    // wider than the box, so the lean never leaves a corner empty
    x: -0.15 * width + rand() * 1.3 * width,
    y: fromTop ? -length - rand() * height * 0.5 : rand() * height,
    z,
    length,
    width: 0.6 + z * 0.8,
    speed: 380 + z * 560 + rand() * 90,
    threshold: rand(),
    presence: 0,
    shade: 0.7 + rand() * 0.3,
  }
}

export function makeRain(rand: Rand, width: number, height: number): Streak[] {
  const streaks: Streak[] = []
  for (let i = 0; i < RAIN.far; i++) streaks.push(makeStreak(rand, rand() * 0.3, width, height))
  for (let i = 0; i < RAIN.mid; i++) streaks.push(makeStreak(rand, 0.3 + rand() * 0.4, width, height))
  for (let i = 0; i < RAIN.near; i++) streaks.push(makeStreak(rand, 0.7 + rand() * 0.3, width, height))
  return streaks.sort((a, b) => a.z - b.z) // far first, near drawn over
}

/** The rain's lean at time t (s): a slow swing either way of the painting's own slant. */
export function leanAt(t: number): number {
  return RAIN.lean + RAIN.gust * (0.6 * Math.sin(t * 0.13) + 0.4 * Math.sin(t * 0.31 + 1.7))
}

/** How fast streaks appear or go as the rain sets in or eases off (per second). */
const PRESENCE_RATE = 1.4

/** Moves a streak on by dt seconds along the current lean; one that has fallen out of the box starts again above it. */
export function stepStreak(s: Streak, dt: number, lean: number, intensity: number, rand: Rand, width: number, height: number): void {
  const target = s.threshold < intensity ? 1 : 0
  const step = PRESENCE_RATE * dt
  s.presence = target > s.presence ? Math.min(1, s.presence + step) : Math.max(0, s.presence - step)
  const d = s.speed * dt
  s.y += d * Math.cos(lean)
  s.x -= d * Math.sin(lean)
  if (s.y - s.length > height) {
    const fresh = makeStreak(rand, s.z, width, height, true)
    s.x = fresh.x
    s.y = fresh.y
    s.shade = fresh.shade
  }
}

/** How strongly a streak shows (0-1): nearer streaks brighter. */
export function streakAlpha(s: Streak): number {
  return (0.38 + 0.52 * s.z) * s.shade * s.presence
}

export interface RainLight {
  rgb: readonly [number, number, number]
  /** overall strength */
  alpha: number
}

/**
 * The rain's light: by day it shows bright against the grey sky; at dawn it
 * takes a touch of the warm sky; at night it is cooler, and kept bright enough
 * to read against the dark sky (it catches the city's and the room's light).
 */
export const RAIN_LIGHT: Record<TimeOfDay, RainLight> = {
  dawn: { rgb: [246, 236, 240], alpha: 0.75 },
  midday: { rgb: [246, 250, 255], alpha: 1 },
  night: { rgb: [214, 226, 250], alpha: 0.95 },
}

export function mixRainLight(a: RainLight, b: RainLight, k: number): RainLight {
  const m = (x: number, y: number) => x + (y - x) * k
  return { rgb: [m(a.rgb[0], b.rgb[0]), m(a.rgb[1], b.rgb[1]), m(a.rgb[2], b.rgb[2])], alpha: m(a.alpha, b.alpha) }
}
