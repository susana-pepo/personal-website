import { cssTimeMs, cssToken, easeInOut, prefersReducedMotion } from '../../lib/motion'
import { bezierFromCss, type Ease } from './turnEase'

/**
 * As a page turns, a soft band of the desk lamp's light passes once through the glass in the
 * direction of travel, as if the slab were tilted toward the lamp for a moment: forward it leaves
 * from the lamp's side, back it returns to it. The genie's landing sweep's sibling: the same warm
 * white, the same lean, faint, under the text, fading with distance from the lamp (turn-fx.css).
 * A faint catch of it runs along the slab's edge line as it passes.
 *
 * There is only ever one light. A turn that comes while it is still passing takes it on from
 * where it is: on in the same direction, or back the way it came.
 *
 * The geometry is pure (planLight, lightAt, lightKeyframes) and tested on its own; passLight runs
 * it on two layers made for the pass inside the sheet (transform and opacity only) and removes
 * them when it ends. Timings are read from turn-fx.css.
 */

/** Where the light is: its band's centre across the sheet (0 the lamp-side edge, 1 the far one), and how bright (0-1). */
export interface LightState {
  at: number
  alpha: number
}

export interface LightPlan {
  from: LightState
  to: number
  dir: 1 | -1
  ms: number
}

export const LIGHT = {
  /** The band's centre starts and ends just outside the sheet: its soft flanks glide in and out,
      and nearly all of the pass is spent crossing the slab. */
  start: -0.15,
  end: 1.15,
  /** The band layer's width, as a fraction of the sheet's (turn-fx.css: .panel__light > i). Wide
      and soft: a glow drifting through the slab, never an edge passing over it. */
  band: 0.9,
  /** The band leans with the lamp's light, as the genie's landing sweep does: 0.2 across per 1 down. */
  lean: 0.2,
  /** Brightness: full by `rise`, held to `hold`, gone by the end. Forward the light leaves the
      lamp, so it is full early, while it is near the bulb, and fades as it goes; back it comes
      toward the lamp, so it holds until it is near the bulb and fades into it. */
  forward: { rise: 0.24, hold: 0.5 },
  back: { rise: 0.3, hold: 0.62 },
  /** A pass taken up part-way is never shorter than this share of a whole one. */
  minShare: 0.45,
} as const

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
/** Exact at both ends (k 0 and 1), so a move lands on the pixel. */
const lerp = (a: number, b: number, k: number) => a * (1 - k) + b * k

/** A pass in `dir`, from where the light is (a pass already under way) or from the edge it enters by. */
export function planLight(current: LightState | null, dir: 1 | -1, ms: number): LightPlan {
  const to = dir > 0 ? LIGHT.end : LIGHT.start
  const from = current ?? { at: dir > 0 ? LIGHT.start : LIGHT.end, alpha: 0 }
  const share = Math.min(1, Math.max(LIGHT.minShare, Math.abs(to - from.at) / (LIGHT.end - LIGHT.start)))
  return { from, to, dir, ms: Math.max(0, ms) * share }
}

/** The light `ms` into a pass: it travels on `ease`, brightens from what it had, holds, then fades out. */
export function lightAt(plan: LightPlan, ms: number, ease: (x: number) => number): LightState {
  const x = plan.ms > 0 ? clamp01(ms / plan.ms) : 1
  const at = lerp(plan.from.at, plan.to, ease(x))
  const { rise, hold } = plan.dir > 0 ? LIGHT.forward : LIGHT.back
  const alpha =
    x < rise
      ? lerp(plan.from.alpha, 1, easeInOut(x / rise))
      : x < hold
        ? 1
        : 1 - easeInOut((x - hold) / (1 - hold))
  return { at, alpha }
}

/** The lean as a skew, about the lamp's height (turn-fx.css sets that transform-origin). */
const SKEW = `skewX(${-Math.round((Math.atan(LIGHT.lean) * 180) / Math.PI * 100) / 100}deg)`

/** The band's transform for a light at `at`: translateX is a percentage of the band's own width. */
export function lightTransform(at: number): string {
  return `translateX(${Math.round((at / LIGHT.band - 0.5) * 10000) / 100}%) ${SKEW}`
}

export function lightKeyframes(plan: LightPlan, ease: (x: number) => number, steps = Math.max(2, Math.ceil(plan.ms / 16))): Keyframe[] {
  const frames: Keyframe[] = []
  for (let i = 0; i <= steps; i++) {
    const k = i / steps
    const { at, alpha } = lightAt(plan, k * plan.ms, ease)
    frames.push({ offset: k, transform: lightTransform(at), opacity: Math.round(alpha * 1000) / 1000 })
  }
  return frames
}

/**
 * Where a band shows the light to be, from its computed transform (`matrix(…, e, f)`, e the
 * translation in px) and opacity, with the band's and the sheet's widths. Null if unreadable.
 */
export function lightFromStyle(transform: string, opacity: string, bandWidth: number, sheetWidth: number): LightState | null {
  const m = /^matrix\(([^)]+)\)$/.exec(transform.trim())
  const e = m ? parseFloat(m[1]!.split(',')[4] ?? '') : NaN
  const alpha = parseFloat(opacity)
  if (!Number.isFinite(e) || !Number.isFinite(alpha) || !(sheetWidth > 0)) return null
  return { at: (e + bandWidth / 2) / sheetWidth, alpha: clamp01(alpha) }
}

/** The light's default travel: the site's --ease-sine, an even glide across the slab with soft ends. */
export const LIGHT_EASE: Ease = [0.45, 0, 0.55, 1]

interface Pass {
  layers: HTMLElement[]
  bands: HTMLElement[]
  animations: Animation[]
  /** Counts the passes run on these layers, so only the latest one removes them. */
  run: number
}

const passes = new WeakMap<HTMLElement, Pass>()

function makeLayers(sheet: HTMLElement): Pass {
  const layers = ['panel__light', 'panel__light panel__light--edge'].map((name) => {
    const layer = document.createElement('div')
    layer.className = name
    layer.setAttribute('aria-hidden', 'true')
    layer.append(document.createElement('i'))
    return layer
  })
  sheet.append(...layers)
  return { layers, bands: layers.map((l) => l.firstElementChild as HTMLElement), animations: [], run: 0 }
}

/** Takes the light out of `sheet` at once, if it is passing (the panel closing or opening). */
export function clearLight(sheet: HTMLElement | null) {
  const pass = sheet ? passes.get(sheet) : undefined
  if (!sheet || !pass) return
  passes.delete(sheet)
  pass.animations.forEach((a) => a.cancel())
  pass.layers.forEach((l) => l.remove())
}

/** Passes the lamp's light through `sheet` in `dir` (none with reduced motion: --turn-light is 0ms there). */
export function passLight(sheet: HTMLElement | null, dir: 1 | -1) {
  if (!sheet || prefersReducedMotion() || typeof sheet.animate !== 'function') return
  const scope = sheet.closest('.panel') ?? sheet
  const ms = cssTimeMs(cssToken('--turn-light', '0ms', scope), 0)
  if (ms <= 0) return

  let pass = passes.get(sheet)
  let current: LightState | null = null
  if (pass?.layers[0]?.isConnected) {
    const band = pass.bands[0]!
    const style = getComputedStyle(band)
    current = lightFromStyle(style.transform, style.opacity, band.offsetWidth, pass.layers[0].clientWidth)
    for (const a of pass.animations) a.cancel()
  } else {
    pass?.layers.forEach((l) => l.remove())
    pass = makeLayers(sheet)
    passes.set(sheet, pass)
  }

  const plan = planLight(current, dir, ms)
  const ease = bezierFromCss(cssToken('--turn-light-ease', '', scope), LIGHT_EASE)
  const frames = lightKeyframes(plan, ease)
  // A fresh pass waits for the mark to set off first; one taken up mid-way carries straight on.
  const delay = current ? 0 : cssTimeMs(cssToken('--turn-light-at', '0ms', scope), 0)
  const owner = pass
  const run = ++owner.run
  owner.animations = owner.bands.map((band) => band.animate(frames, { duration: plan.ms, delay, easing: 'linear', fill: 'backwards' }))
  // Gone when it has passed. A pass the next turn takes over is cancelled and leaves its layers
  // to the new one.
  owner.animations[0]!.finished.then(
    () => {
      if (passes.get(sheet) !== owner || owner.run !== run) return
      owner.layers.forEach((l) => l.remove())
      passes.delete(sheet)
    },
    () => {},
  )
}
