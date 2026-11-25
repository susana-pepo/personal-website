import { RAINY_DAY, type OvercastLook, type Rand } from './weather'

/*
 * Raindrops on the window's glass, while it rains: tiny beads land and stay,
 * neighbours merge into larger drops, and a drop that grows heavy enough lets
 * go and runs down the pane in small stick-and-slip steps, wiping a clear
 * path through the beads and leaving a few specks behind, until it comes to
 * rest on the bar at the bottom of its pane. When the rain stops the glass
 * slowly dries.
 *
 * Simulated in the window view's own pixels (its 957×695 box on the canvas),
 * so the drops line up with the glass mask at any screen size. No DOM here.
 */

/** Where the glass is: the view mask's opacity, sampled every `step` px (1 = glass). */
export interface GlassMap {
  width: number
  height: number
  step: number
  /** row-major, ceil(width/step) × ceil(height/step), 0-255 */
  alpha: Uint8ClampedArray
}

export function isGlass(map: GlassMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false
  const cols = Math.ceil(map.width / map.step)
  const i = Math.floor(y / map.step) * cols + Math.floor(x / map.step)
  return (map.alpha[i] ?? 0) > 160
}

/** How far down a drop at (x, y) can run before it meets the bar under its pane. */
export function paneBottom(map: GlassMap, x: number, y: number): number {
  let yy = y
  while (yy < map.height && isGlass(map, x, yy)) yy += map.step
  return yy - map.step
}

export interface Drop {
  x: number
  y: number
  r: number
  /** 0-1: fades in as it lands, out as the glass dries */
  alpha: number
  /** seconds until it dries away (counts down only while the glass dries) */
  life: number
  /** how fast it gathers the fine spray while it rains (px² a second): most barely do, a few fill up and run */
  gain: number
}

export interface Runner {
  x: number
  y: number
  r: number
  /** current speed, px/s */
  vy: number
  /** seconds left in this "stick" (0 while it's slipping) */
  stick: number
  /** distance run since its last speck */
  sinceSpeck: number
  /** the bar it will stop on */
  stopY: number
  /** slow side-to-side wander */
  drift: number
}

export interface Glass {
  beads: Drop[]
  runners: Runner[]
  /** something changed that the still layer must redraw */
  dirty: boolean
}

export const DROPS = {
  /** new beads per second while it rains, across the whole window */
  landRate: 16,
  /** most beads the glass holds before the oldest quietly dry */
  maxBeads: 700,
  /** a bead this heavy (radius, px) lets go */
  runAt: 8,
  /** below this a running drop has spent itself and stops */
  restAt: 5.2,
  /** seconds for the glass to dry once the rain stops (each bead takes a share of it) */
  dryS: 4,
  /** the share of landing drops that sit where the spray keeps feeding them (they fill up and, in time, run) */
  fillChance: 0.009,
} as const

export function makeGlass(): Glass {
  return { beads: [], runners: [], dirty: true }
}

/** A raindrop landing: mostly fine beads, now and then a fuller one. */
function landing(map: GlassMap, rand: Rand): Drop | null {
  for (let tries = 0; tries < 6; tries++) {
    const x = rand() * map.width
    const y = rand() * map.height
    if (!isGlass(map, x, y)) continue
    const big = rand() < 0.05
    const r = big ? 3.3 + rand() * 2.4 : 1.2 + Math.pow(rand(), 2.2) * 2.8
    return { x, y, r, alpha: 0, life: DROPS.dryS * (0.5 + rand() * 0.5), gain: rand() < DROPS.fillChance ? 1.1 + rand() * 2.2 : 0 }
  }
  return null
}

/** Two touching drops become one, keeping their water (area) and settling between them. */
export function merge(a: Drop, b: { x: number; y: number; r: number; gain?: number }): void {
  const wa = a.r * a.r
  const wb = b.r * b.r
  a.x = (a.x * wa + b.x * wb) / (wa + wb)
  a.y = (a.y * wa + b.y * wb) / (wa + wb)
  a.r = Math.sqrt(wa + wb)
  a.gain = Math.max(a.gain, b.gain ?? 0)
}

function letGo(map: GlassMap, bead: Drop, rand: Rand): Runner {
  return {
    x: bead.x,
    y: bead.y,
    r: bead.r,
    vy: 0,
    stick: 0.15 + rand() * 0.35,
    sinceSpeck: 0,
    stopY: paneBottom(map, bead.x, bead.y),
    drift: (rand() - 0.5) * 6,
  }
}

/**
 * Moves the glass on by `dt` seconds. `raining`: drops keep landing; when it
 * stops, beads dry away one by one (runners finish their run).
 */
export function stepGlass(glass: Glass, map: GlassMap, dt: number, raining: boolean, rand: Rand): void {
  const { beads, runners } = glass

  // Rain lands; a bead that touches another joins it.
  if (raining) {
    let due = DROPS.landRate * dt
    while (due > 0) {
      if (rand() < due) {
        const drop = landing(map, rand)
        if (drop) {
          const near = beads.find((b) => Math.hypot(b.x - drop.x, b.y - drop.y) < (b.r + drop.r) * 0.9)
          if (near) {
            merge(near, drop)
          } else {
            beads.push(drop)
          }
          glass.dirty = true
        }
      }
      due -= 1
    }
    // Too many: the oldest beads dry first, except those still filling up.
    let excess = beads.length - DROPS.maxBeads
    for (let i = 0; i < beads.length && excess > 0; i++) {
      if (beads[i]!.gain === 0) {
        beads.splice(i--, 1)
        excess--
      }
    }
    if (excess > 0) beads.splice(0, excess)
    glass.dirty = true
  }

  // Beads fade in as they land and slowly fill with spray; they fade out as the glass dries.
  for (let i = beads.length - 1; i >= 0; i--) {
    const b = beads[i]!
    if (raining) {
      if (b.alpha < 1) {
        b.alpha = Math.min(1, b.alpha + dt * 2.5)
        glass.dirty = true
      }
      if (b.gain > 0) {
        const before = Math.round(b.r * 8)
        b.r = Math.sqrt(b.r * b.r + b.gain * dt)
        if (Math.round(b.r * 8) !== before) glass.dirty = true
      }
    } else {
      b.life -= dt
      // each bead holds for a moment, then fades steadily: the glass is clear soon after the rain
      const fadeFrom = DROPS.dryS * 0.5
      if (b.life < fadeFrom) {
        b.alpha = Math.min(b.alpha, Math.max(0, b.life / fadeFrom))
        glass.dirty = true
      }
      if (b.life <= 0) beads.splice(i, 1)
    }
  }

  // A heavy bead lets go.
  if (raining) {
    for (let i = beads.length - 1; i >= 0; i--) {
      const b = beads[i]!
      if (b.r >= DROPS.runAt && b.alpha >= 1 && rand() < dt * 0.8) {
        runners.push(letGo(map, b, rand))
        beads.splice(i, 1)
        glass.dirty = true
      }
    }
  }

  // Runners: stick and slip down the pane, gathering what they meet.
  for (let i = runners.length - 1; i >= 0; i--) {
    const d = runners[i]!
    if (d.stick > 0) {
      d.stick -= dt
      d.vy *= Math.pow(0.02, dt) // brakes on the glass
    } else {
      const pull = 32 + (d.r - DROPS.restAt) * 18
      d.vy += (pull - d.vy) * Math.min(1, dt * 3)
      if (rand() < dt * 1.4) d.stick = 0.08 + rand() * 0.5 // catches on the glass for a moment
    }
    const dy = d.vy * dt
    d.y += dy
    d.drift += (rand() - 0.5) * 18 * dt
    d.drift *= Math.pow(0.4, dt)
    const nx = d.x + d.drift * dt
    if (isGlass(map, nx, d.y)) d.x = nx

    // It wipes the beads in its way into itself.
    for (let j = beads.length - 1; j >= 0; j--) {
      const b = beads[j]!
      if (Math.abs(b.y - d.y) < d.r + b.r && Math.abs(b.x - d.x) < d.r + b.r) {
        if (Math.hypot(b.x - d.x, b.y - d.y) < d.r + b.r * 0.6) {
          const w = d.r * d.r + b.r * b.r
          d.r = Math.sqrt(w)
          beads.splice(j, 1)
          glass.dirty = true
        }
      }
    }

    // …and leaves a few specks of itself behind.
    d.sinceSpeck += dy
    if (d.sinceSpeck > 10 + rand() * 13) {
      d.sinceSpeck = 0
      if (rand() < 0.75) {
        const r = 1 + rand() * 1.2
        beads.push({ x: d.x + (rand() - 0.5) * d.r * 0.6, y: d.y - d.r * 1.1, r, alpha: 1, life: DROPS.dryS * (0.5 + rand() * 0.5), gain: 0 })
        d.r = Math.sqrt(Math.max(0, d.r * d.r - r * r))
        glass.dirty = true
      }
    }

    // It stops at the bar, or once it has spent itself.
    const atBar = d.y + d.r >= d.stopY
    if (atBar || d.r < DROPS.restAt) {
      runners.splice(i, 1)
      beads.push({ x: d.x, y: Math.min(d.y, d.stopY - d.r * 0.8), r: Math.min(d.r, 7.5), alpha: 1, life: DROPS.dryS * (0.6 + rand() * 0.4), gain: 0 })
      glass.dirty = true
    }
  }
}

/** Fast-forwards the glass (no drawing), so a page that opens in the rain starts with wet glass. */
export function wetGlass(glass: Glass, map: GlassMap, seconds: number, rand: Rand): void {
  const dt = 0.1
  for (let t = 0; t < seconds; t += dt) stepGlass(glass, map, dt, true, rand)
  for (const b of glass.beads) b.alpha = 1
  glass.dirty = true
}

/**
 * The colour of a pixel seen through a drop by day in the rain: the same
 * overcast re-mix as the view itself (see WeatherSky), so the drops don't show
 * a blue summer sky. Channels 0-255.
 */
export function overcastRgb(r: number, g: number, b: number, look: OvercastLook = RAINY_DAY): [number, number, number] {
  const c = [r / 255, g / 255, b / 255] as const
  const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
  const s = look.saturation
  const dull = c.map((v) => (lum + s * (v - lum)) * look.brightness)
  const sky = look.skyTint.map((tint) => look.skyK * lum + look.skyC + tint)
  const m = Math.min(1, Math.max(0, look.skyA * (c[2] - c[0]) + look.skyB))
  const curve = look.curve
  const tone = (v: number) => {
    const x = Math.min(1, Math.max(0, v)) * (curve.length - 1)
    const i = Math.min(curve.length - 2, Math.floor(x))
    return curve[i]! + (curve[i + 1]! - curve[i]!) * (x - i)
  }
  return [0, 1, 2].map((i) => Math.round(tone(dull[i]! * (1 - m) + sky[i]! * m) * 255)) as [number, number, number]
}
