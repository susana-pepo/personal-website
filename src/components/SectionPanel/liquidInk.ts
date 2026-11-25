import { cssTimeMs, cssToken, prefersReducedMotion } from '../../lib/motion'
import { INK_BASE_WIDTH } from './folio'
import { bezierFromCss, type Ease } from './turnEase'

/**
 * The tab's vermilion mark moves like a drop of ink: on a page turn its leading edge runs ahead
 * to the far side of the new tab, so for a moment it reaches across both, then its trailing edge
 * gathers in behind it and it settles, a touch fuller for an instant, then exactly its own size.
 * Neither edge ever passes the new tab (each only eases from where it was to where it rests), and
 * nothing bounces. A turn that comes while it is still flowing sets off from wherever it is.
 *
 * The geometry is pure (planInk, inkPoseAt, inkKeyframes) and tested on its own; moveInk runs it
 * on the live mark as one Web Animation of its transform. Timings are read from turn-fx.css.
 */

/** Where the mark is: its left edge and width in the tab row (px), and how full it is (1 at rest). */
export interface InkPose {
  left: number
  width: number
  full: number
}

/** A tab's span in the row (px). */
export interface InkSpan {
  left: number
  width: number
}

export interface InkPlan {
  from: InkPose
  to: InkSpan
  /** +1 when the mark travels right, -1 left, 0 when it only changes size in place. */
  dir: 1 | -1 | 0
  ms: number
  /** When the trailing edge lets go: FLOW.trailAt, or 0 for a move taken up mid-flow, which never pauses. */
  trailAt: number
}

/** The shape of the flow, as fractions of the move. */
export const FLOW = {
  /** The leading edge has reached the far side of the new tab by here. */
  leadEnd: 0.5,
  /** The trailing edge lets go here (at once on a move taken up mid-flow)… */
  trailAt: 0.12,
  /** …and has gathered in under the new tab by here, so the swell is seen as it settles. */
  gatherEnd: 0.84,
  /** How much a stretched mark thins (0 never, 1 keeps its area)… */
  thin: 0.22,
  /** …easing back to its full thickness over this part of the move, before the swell. */
  thinFrom: 0.42,
  thinTo: 0.7,
  /** The swell as it gathers in: 1 + `fuller` at `fullAt`, rising from `fullFrom`, exactly 1 at the end. */
  fuller: 0.3,
  fullFrom: 0.7,
  fullAt: 0.88,
  /** The mark is never thinner than this, so it never breaks up on a long reach. */
  minFull: 0.6,
} as const

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
/** Exact at both ends (k 0 and 1), so a move lands on the pixel. */
const lerp = (a: number, b: number, k: number) => a * (1 - k) + b * k

/** A move from `from` to `to`; `carried` when it takes up a flow still under way. */
export function planInk(from: InkPose, to: InkSpan, ms: number, carried = false): InkPlan {
  const fromCentre = from.left + from.width / 2
  const toCentre = to.left + to.width / 2
  const d = toCentre - fromCentre
  const dir = Math.abs(d) < 0.5 ? 0 : d > 0 ? 1 : -1
  return { from, to, dir, ms: Math.max(0, ms), trailAt: carried ? 0 : FLOW.trailAt }
}

/** 0 → 1 with no slope at either end. */
const smooth = (x: number) => {
  const c = clamp01(x)
  return c * c * (3 - 2 * c)
}

/** The swell's shape over the move: 0 until FLOW.fullFrom, 1 at FLOW.fullAt, 0 again exactly at the end, with no corners. */
export function swellAt(t: number): number {
  if (t <= FLOW.fullFrom || t >= 1) return 0
  if (t < FLOW.fullAt) return Math.sin((Math.PI / 2) * ((t - FLOW.fullFrom) / (FLOW.fullAt - FLOW.fullFrom))) ** 2
  return Math.cos((Math.PI / 2) * ((t - FLOW.fullAt) / (1 - FLOW.fullAt))) ** 2
}

/**
 * The default curves: the site's --ease-drawer for the edge that leads (it answers at once but
 * with a little weight, so the first frame flows instead of jumping), --ease-sine for the one
 * that gathers.
 */
export const INK_EASE: { lead: Ease; gather: Ease } = {
  lead: [0.32, 0.72, 0, 1],
  gather: [0.45, 0, 0.55, 1],
}

/**
 * The mark `ms` into a move. The edge in the direction of travel runs on `lead` and is home by
 * FLOW.leadEnd; the other lets go at the plan's trailAt and gathers on `gather`, home by
 * FLOW.gatherEnd. It thins a little while it is stretched, back to its full thickness as it
 * gathers, then swells once as it settles under the tab and eases to exactly its size. It starts
 * from the fullness it had (a move taken up mid-flow).
 */
export function inkPoseAt(
  plan: InkPlan,
  ms: number,
  lead: (x: number) => number,
  gather: (x: number) => number,
): InkPose {
  const { from, to, dir } = plan
  const t = plan.ms > 0 ? clamp01(ms / plan.ms) : 1
  const kLead = lead(clamp01(t / FLOW.leadEnd))
  const kGather = gather(clamp01((t - plan.trailAt) / (FLOW.gatherEnd - plan.trailAt)))
  const fromRight = from.left + from.width
  const toRight = to.left + to.width
  let left: number
  let right: number
  if (dir > 0) {
    right = lerp(fromRight, toRight, kLead)
    left = lerp(from.left, to.left, kGather)
  } else if (dir < 0) {
    left = lerp(from.left, to.left, kLead)
    right = lerp(fromRight, toRight, kGather)
  } else {
    left = lerp(from.left, to.left, kLead)
    right = lerp(fromRight, toRight, kLead)
  }
  // Taken up mid-flow, the gathering edge can be ahead of where the leading one starts: never
  // let the mark turn inside out.
  if (right < left) right = left = (left + right) / 2
  const width = right - left

  if (t >= 1) return { left, width, full: 1 }
  // Thinner while stretched (keeping some of its area), back to full as it gathers…
  const rest = lerp(from.width, to.width, kGather)
  const stretched = dir !== 0 && rest > 0 && width > rest ? Math.pow(rest / width, FLOW.thin) : 1
  const thin = lerp(stretched, 1, smooth((t - FLOW.thinFrom) / (FLOW.thinTo - FLOW.thinFrom)))
  // …then one swell as it settles, on top of its full thickness.
  const swell = dir === 0 ? 0 : FLOW.fuller * swellAt(t)
  // What it had when this move began fades out over the first part of the move.
  const carried = (from.full - 1) * (1 - smooth(t / FLOW.leadEnd))
  return { left, width, full: Math.max(FLOW.minFull, thin * (1 + swell) + carried) }
}

/** The pose as the mark's transform: it is INK_BASE_WIDTH wide, scaled from its bottom left. */
export function inkPoseTransform({ left, width, full }: InkPose): string {
  return `translateX(${round(left)}px) scaleX(${round(width / INK_BASE_WIDTH, 4)}) scaleY(${round(full, 4)})`
}

/** The move as evenly spaced keyframes, close enough together to play back linearly. */
export function inkKeyframes(
  plan: InkPlan,
  lead: (x: number) => number,
  gather: (x: number) => number,
  steps = Math.max(2, Math.ceil(plan.ms / 16)),
): Keyframe[] {
  const frames: Keyframe[] = []
  for (let i = 0; i <= steps; i++) {
    const k = i / steps
    frames.push({ offset: k, transform: inkPoseTransform(inkPoseAt(plan, k * plan.ms, lead, gather)) })
  }
  return frames
}

/**
 * The pose a computed transform shows: `matrix(a, b, c, d, e, f)` is scaleX a, scaleY d and
 * translateX e for the mark (it never rotates). `none` is the mark at the row's start, unscaled.
 */
export function poseFromMatrix(transform: string): InkPose | null {
  const t = transform.trim()
  if (t === 'none' || t === '') return { left: 0, width: INK_BASE_WIDTH, full: 1 }
  const m = /^matrix\(([^)]+)\)$/.exec(t)
  if (!m) return null
  const v = m[1]!.split(',').map((s) => parseFloat(s))
  if (v.length !== 6 || v.some((n) => !Number.isFinite(n))) return null
  return { left: v[4]!, width: v[0]! * INK_BASE_WIDTH, full: v[3]! }
}

const round = (n: number, places = 2) => {
  const f = 10 ** places
  return Math.round(n * f) / f
}

interface Flow {
  animation: Animation
  to: InkSpan
}

const running = new WeakMap<HTMLElement, Flow>()

const sameSpan = (a: InkSpan, b: InkSpan) => Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5
/** Still on its way (running, or held by a paused timeline). */
const underway = (flow: Flow | undefined): flow is Flow => !!flow && flow.animation.playState !== 'finished' && flow.animation.playState !== 'idle'

/**
 * Moves the mark under `to`. Flowing (a page turn): from wherever it is right now, even part-way
 * through a flow, over --turn-ink. Otherwise, or with reduced motion (--turn-ink is 0ms there),
 * it is placed at once; but a flow already on its way to that same place is left to finish (the
 * row reporting a resize mid-turn must not cut it short).
 */
export function moveInk(ink: HTMLElement, to: InkSpan, flow: boolean) {
  const current = running.get(ink)
  if (!flow && underway(current) && sameSpan(current.to, to)) return
  const rest: InkPose = { left: to.left, width: to.width, full: 1 }
  const scope = ink.closest('.panel') ?? ink
  const ms = cssTimeMs(cssToken('--turn-ink', '0ms', scope), 0)
  const from = flow ? poseFromMatrix(getComputedStyle(ink).transform) : null
  const carried = underway(current)
  current?.animation.cancel()
  running.delete(ink)
  ink.style.transform = inkPoseTransform(rest)
  if (!flow || !from || ms <= 0 || prefersReducedMotion() || typeof ink.animate !== 'function') return

  const plan = planInk(from, to, ms, carried)
  if (plan.dir === 0 && Math.abs(from.width - to.width) < 0.5 && Math.abs(from.full - 1) < 0.01) return
  const lead = bezierFromCss(cssToken('--turn-ink-lead', '', scope), INK_EASE.lead)
  const gather = bezierFromCss(cssToken('--turn-ink-gather', '', scope), INK_EASE.gather)
  const animation = ink.animate(inkKeyframes(plan, lead, gather), { duration: ms, easing: 'linear' })
  running.set(ink, { animation, to })
  const done = () => {
    if (running.get(ink)?.animation === animation) running.delete(ink)
  }
  animation.finished.then(done, done)
}
