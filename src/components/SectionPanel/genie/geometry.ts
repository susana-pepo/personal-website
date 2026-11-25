/**
 * The genie's shape and timing: how the glass slab pours out of an object into the dock and back.
 * Pure (no DOM), so it is tested on its own; shaders.ts runs the same per-slice maths on the GPU.
 *
 * The slab is cut into slices across its travel axis. First a small piece of the glass forms in
 * the object's painted heart and swells to the neck (`seed`); then each slice eases from the neck
 * to its place in the dock, the far edge leading and the near edge following (`lag`). Objects
 * left of the dock pour sideways through a funnel: the stream stays narrow across the room and
 * fans out to the slab's full height only over the last part of the way (`fan`), so it never
 * stands in the room as a tall sheet. Objects under the dock (or above it) rise (or fall) out of
 * the object and widen as they travel (`flare`). Closing runs the same shape backwards: the slab
 * narrows into the stream, and a small piece shrinks into the object last.
 */

export type Bezier = readonly [number, number, number, number]

/** A CSS cubic-bezier as a function of 0-1 → 0-1 (Newton's method on x, as the browser does). */
export function cubicBezier([x1, y1, x2, y2]: Bezier): (x: number) => number {
  const at = (p1: number, p2: number, t: number) => {
    const u = 1 - t
    return 3 * p1 * u * u * t + 3 * p2 * u * t * t + t * t * t
  }
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 12; i++) {
      const u = 1 - t
      const dx = at(x1, x2, t) - x
      const d = 3 * x1 * u * u + 6 * (x2 - x1) * u * t + 3 * (1 - x2) * t * t
      if (Math.abs(dx) < 1e-7 || Math.abs(d) < 1e-6) break
      t = Math.min(1, Math.max(0, t - dx / d))
    }
    return at(y1, y2, t)
  }
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return k * k * (3 - 2 * k)
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Where an object's drawing really is: the heart of its silhouette and its painted size. */
export interface Silhouette {
  cx: number
  cy: number
  w: number
  h: number
}

/** 0: pours sideways (+x), 1: rises (-y), 2: falls (+y). */
export type Axis = 0 | 1 | 2

/** Which per-slice curve a move follows: the opening's, or the close's (accelerating into the object). */
export type Shape = 'open' | 'close'

export interface Tuning {
  /** Share of the move by which the near edge trails the far edge. */
  lag: number
  /** Rising or falling: a slice has widened to the slab's full span once it has travelled this far. */
  flare: number
  /**
   * Pouring sideways: the stream fans out from the neck's height to the slab's from this share of
   * the way between the object and the dock's near edge (top edge, bottom edge).
   */
  fan: readonly [top: number, bottom: number]
  /** Share of the move in which the piece forms in the object (opening) or shrinks into it (closing). */
  seed: { open: number; close: number }
  /** The piece's size as it first shows, as a share of the neck. */
  seedScale: number
  /** Each slice's travel when opening: one calm S-curve, no overshoot. */
  ease: Bezier
  /** Each slice's travel back into the object: accelerating (an ease-in). */
  closeEase: Bezier
  /** The neck's size, from the object's silhouette (px). */
  neck: { scale: number; min: number; max: number }
  /** An object's heart must sit this far left of the dock for a sideways pour, else it rises. */
  sideMargin: number
}

export const TUNING: Tuning = {
  lag: 0.32,
  flare: 0.78,
  fan: [0.62, 0.42],
  seed: { open: 0.13, close: 0.2 },
  seedScale: 0.3,
  ease: [0.4, 0, 0.22, 1],
  closeEase: [0.5, 0, 0.78, 0.42],
  neck: { scale: 0.5, min: 44, max: 170 },
  sideMargin: 56,
}

/** A box in the move's own frame: along the travel axis (a0 → a1) and across it (c0 → c1). */
export type Frame = readonly [a0: number, a1: number, c0: number, c1: number]

export interface Plan {
  axis: Axis
  neck: Rect
  shell: Rect
  /** The neck and the dock in the travel frame (what the shader gets). */
  N: Frame
  D: Frame
}

const frameOf = (axis: Axis, r: Rect): Frame =>
  axis === 0
    ? [r.x, r.x + r.w, r.y, r.y + r.h]
    : axis === 1
      ? [-(r.y + r.h), -r.y, r.x, r.x + r.w]
      : [r.y, r.y + r.h, r.x, r.x + r.w]

/** Plans a move between an object and the slab's place in the dock (`shell`, in CSS px). */
export function planMove(object: Silhouette, shell: Rect, t: Tuning = TUNING): Plan {
  const nk = t.neck
  let nw = Math.min(nk.max, Math.max(nk.min, object.w * nk.scale))
  const nh = Math.min(nk.max, Math.max(nk.min, object.h * nk.scale))
  let axis: Axis = 0
  if (object.cx > shell.x - t.sideMargin) axis = object.cy > shell.y + shell.h / 2 ? 1 : 2
  // A sideways neck stays left of the dock, so the near edge always travels right.
  else nw = Math.max(16, Math.min(nw, 2 * (shell.x - 12 - object.cx)))
  const neck = { x: object.cx - nw / 2, y: object.cy - nh / 2, w: nw, h: nh }
  return { axis, neck, shell, N: frameOf(axis, neck), D: frameOf(axis, shell) }
}

const seedOf = (shape: Shape, t: Tuning) => (shape === 'open' ? t.seed.open : t.seed.close)

/** How far one slice has travelled (0 in the object, 1 home) at the move's progress T. */
export function travel(T: number, k: number, shape: Shape, t: Tuning = TUNING): number {
  const seed = seedOf(shape, t)
  const Tp = clamp01((T - seed) / (1 - seed))
  const kc = clamp01(k)
  const tau = clamp01((Tp - (1 - kc) * t.lag) / (1 - t.lag))
  return shape === 'open' ? cubicBezier(t.ease)(tau) : 1 - cubicBezier(t.closeEase)(1 - tau)
}

/** How grown the piece in the object is (0 → 1) at progress T: it forms first, and goes last. */
export function seedAt(T: number, shape: Shape, t: Tuning = TUNING): number {
  return smoothstep(0, seedOf(shape, t), T)
}

/** How visible the slab is at progress T: the piece fades in as it forms and out as it goes. */
export function appearAt(T: number, shape: Shape, t: Tuning = TUNING): number {
  return smoothstep(0, seedOf(shape, t) * 0.7, T)
}

/** The neck at progress T: the piece swells from `seedScale` of it, about its centre. */
export function neckAt(plan: Plan, T: number, shape: Shape, t: Tuning = TUNING): Frame {
  const g = t.seedScale + (1 - t.seedScale) * seedAt(T, shape, t)
  const [a0, a1, c0, c1] = plan.N
  const am = (a0 + a1) / 2
  const cm = (c0 + c1) / 2
  return [am + (a0 - am) * g, am + (a1 - am) * g, cm + (c0 - cm) * g, cm + (c1 - cm) * g]
}

/** Slice k (0 near edge, 1 far edge) at progress T: its place along the travel and its span across. */
export function sliceAt(plan: Plan, T: number, k: number, shape: Shape, t: Tuning = TUNING) {
  const s = travel(T, k, shape, t)
  const [na0, na1, nc0, nc1] = neckAt(plan, T, shape, t)
  const [da0, da1, dc0, dc1] = plan.D
  const from = na0 + (na1 - na0) * k
  const to = da0 + (da1 - da0) * k
  const a = from + (to - from) * s
  let w0: number
  let w1: number
  if (plan.axis === 0) {
    // the funnel: full height only near the dock, wherever the slice is in its own travel
    const mid = (plan.N[0] + plan.N[1]) / 2
    const q = clamp01((a - mid) / Math.max(1, da0 - mid))
    w0 = smoothstep(t.fan[0], 1, q)
    w1 = smoothstep(t.fan[1], 1, q)
  } else w0 = w1 = smoothstep(0, t.flare, s)
  return { s, a, c0: nc0 + (dc0 - nc0) * w0, c1: nc1 + (dc1 - nc1) * w1 }
}

/** The furthest any part of the slab is from its place in the dock, in px. */
export function worstDistance(plan: Plan, T: number, shape: Shape = 'open', t: Tuning = TUNING): number {
  const [da0, da1, dc0, dc1] = plan.D
  let worst = 0
  for (let i = 0; i <= 32; i++) {
    const k = i / 32
    const q = sliceAt(plan, T, k, shape, t)
    const home = da0 + (da1 - da0) * k
    worst = Math.max(worst, Math.abs(q.a - home), Math.abs(q.c0 - dc0), Math.abs(q.c1 - dc1))
  }
  return worst
}

/** The opening's T from which every part of the slab is within `px` of its place. */
export function landingT(plan: Plan, px = 1.5, t: Tuning = TUNING): number {
  let lo = 0.2
  let hi = 1
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (worstDistance(plan, mid, 'open', t) <= px) hi = mid
    else lo = mid
  }
  return hi
}

/**
 * The opening's T from which the dock is wholly under visible glass: the far edge is home and
 * the slice passing the dock's near edge already spans it. A sideways pour gets there well before
 * it lands; a rising one only as it lands.
 */
export function coverT(plan: Plan, t: Tuning = TUNING): number {
  const [da0, da1, dc0, dc1] = plan.D
  const ok = (T: number) => {
    if (sliceAt(plan, T, 1, 'open', t).a < da1 - 2) return false
    let lo = 0
    let hi = 1
    if (sliceAt(plan, T, 0, 'open', t).a >= da0) hi = 0
    else
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2
        if (sliceAt(plan, T, mid, 'open', t).a < da0) lo = mid
        else hi = mid
      }
    const q = sliceAt(plan, T, hi, 'open', t)
    return q.c0 <= dc0 + 2 && q.c1 >= dc1 - 2
  }
  if (!ok(1)) return 1
  let lo = 0.2
  let hi = 1
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (ok(mid)) hi = mid
    else lo = mid
  }
  return hi
}

/** A point of the slab given as a share of its box (0-1 across, 0-1 down), on screen at progress T. */
export function pointAt(plan: Plan, T: number, shape: Shape, u: number, v: number, t: Tuning = TUNING) {
  const k = plan.axis === 0 ? u : plan.axis === 1 ? 1 - v : v
  const cn = plan.axis === 0 ? v : u
  const q = sliceAt(plan, T, k, shape, t)
  const c = q.c0 + (q.c1 - q.c0) * cn
  return plan.axis === 0 ? { x: q.a, y: c } : plan.axis === 1 ? { x: c, y: -q.a } : { x: c, y: q.a }
}

/**
 * How lit the lamp-side glint is (0-1): it catches the bulb only as the slab's lamp edge arrives
 * where the bulb shines on it, and fades as it leaves. `lamp` is the bulb's place on the slab
 * (shares of its box).
 */
export function glintAt(plan: Plan, T: number, shape: Shape, lamp: { u: number; v: number }, t: Tuning = TUNING): number {
  const now = pointAt(plan, T, shape, lamp.u, lamp.v, t)
  const home = { x: plan.shell.x + plan.shell.w * lamp.u, y: plan.shell.y + plan.shell.h * lamp.v }
  return 1 - smoothstep(2, 90, Math.hypot(now.x - home.x, now.y - home.y))
}

/** The beats of an opening, in ms from the click. */
export interface OpenTimeline {
  /** The clicked object's halo warms; nothing moves yet. */
  anticipate: number
  /** Click to fully within `landPx` of the dock. */
  landAt: number
  /** The pour's own length (it is stretched so it lands at `landAt`). */
  pourMs: number
  /** The contents start their cascade. */
  contentAt: number
  /** The lamp's light sweeps across the slab. */
  sweepAt: number
  sweepMs: number
  /** The contact shadow trails the slab by this much. */
  shadowLag: number
  /** The real sheet takes over from the canvas. */
  handoffAt: number
}

export const OPEN = {
  anticipate: 100,
  landAt: 650,
  landPx: 1.5,
  /** The contents show once every part of the slab is this close to its place (px). */
  contentPx: 24,
  contentLead: 30,
  contentBefore: 130,
  sweepMs: 300,
  shadowLag: 50,
}

export function openTimeline(plan: Plan, t: Tuning = TUNING): OpenTimeline {
  const landT = landingT(plan, OPEN.landPx, t)
  const pourMs = (OPEN.landAt - OPEN.anticipate) / landT
  const contentT = Math.min(landT, landingT(plan, OPEN.contentPx, t), coverT(plan, t))
  // As the slab lands, not before: never earlier than `contentBefore` ahead of the landing.
  const contentAt = Math.round(Math.max(OPEN.landAt - OPEN.contentBefore, OPEN.anticipate + pourMs * contentT - OPEN.contentLead))
  const sweepAt = OPEN.landAt
  const handoffAt = Math.max(sweepAt + OPEN.sweepMs, OPEN.landAt + OPEN.shadowLag)
  return { anticipate: OPEN.anticipate, landAt: OPEN.landAt, pourMs, contentAt, sweepAt, sweepMs: OPEN.sweepMs, shadowLag: OPEN.shadowLag, handoffAt }
}

/** The beats of a close (about 72% of the opening): the contents fade, then the slab pours back. */
export const CLOSE = { fadeMs: 100, pourMs: 370 }

/** Turning a move round mid-way takes the share of a full move still to undo, never less than this. */
export const REVERSE_MIN_MS = 160

/** The time a turned-round move takes to get from T to `to`. */
export function reverseMs(T: number, to: 0 | 1, fullMs: number): number {
  return Math.max(REVERSE_MIN_MS, Math.round(fullMs * Math.abs(to - T)))
}

/** The contact shadow's strength (0-1) while opening, `ms` after the click. */
export function shadowOpenAt(ms: number, tl: OpenTimeline): number {
  return smoothstep(0, 1, (ms - tl.anticipate - tl.shadowLag) / (tl.landAt - tl.anticipate))
}

/** The contact shadow while closing: it lifts a little ahead of the slab. */
export function shadowCloseAt(pourMs: number, total: number): number {
  return 1 - smoothstep(0, 1, (pourMs + 50) / Math.max(1, total * 0.85))
}

/** The sweep's progress 0-1, or null when it is not running. */
export function sweepAt(ms: number, tl: OpenTimeline): number | null {
  const p = (ms - tl.sweepAt) / tl.sweepMs
  return p > 0 && p < 1 ? p : null
}

/**
 * An object's silhouette from where its link answers on a grid of samples over its box (the
 * woman's box is far larger than her drawing). The middle 80% of the hits gives the size.
 */
export function silhouetteOf(hits: readonly { x: number; y: number }[], box: { left: number; top: number; width: number; height: number }, grid: number): Silhouette {
  if (hits.length < 3) return { cx: box.left + box.width / 2, cy: box.top + box.height / 2, w: box.width, h: box.height }
  const q = (values: number[], f: number) => {
    const s = [...values].sort((m, n) => m - n)
    return s[Math.min(s.length - 1, Math.max(0, Math.round(f * (s.length - 1))))]!
  }
  const xs = hits.map((p) => p.x)
  const ys = hits.map((p) => p.y)
  return {
    cx: xs.reduce((m, n) => m + n, 0) / xs.length,
    cy: ys.reduce((m, n) => m + n, 0) / ys.length,
    w: q(xs, 0.9) - q(xs, 0.1) + box.width / grid,
    h: q(ys, 0.9) - q(ys, 0.1) + box.height / grid,
  }
}

/** A computed box-shadow list split into its shadows (commas inside colours don't count). */
export function splitShadows(list: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < list.length; i++) {
    const ch = list[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      out.push(list.slice(start, i).trim())
      start = i + 1
    }
  }
  const last = list.slice(start).trim()
  if (last && last !== 'none') out.push(last)
  return out
}

/** The shadows inside the slab (its thickness and shade) and the ones it casts on the room. */
export function partShadows(list: string): { inset: string; outer: string } {
  const all = splitShadows(list)
  const inset = all.filter((s) => /\binset\b/.test(s))
  const outer = all.filter((s) => !/\binset\b/.test(s))
  return { inset: inset.join(', ') || 'none', outer: outer.join(', ') || 'none' }
}

/**
 * Whether two readings of the glass's computed style paint the same: the words must match, and
 * every number too, except lengths, which may differ by a pixel or 0.3% (the room's box can land
 * a pixel apart, which moves the blurred reflection and the lamp's light by as much: invisible).
 */
export function sameGlass(a: string, b: string, px = 1.5): boolean {
  if (a === b) return true
  const NUM = /-?\d*\.?\d+(?:e-?\d+)?(px|%)?/g
  if (a.replace(NUM, '#') !== b.replace(NUM, '#')) return false
  const na = [...a.matchAll(NUM)]
  const nb = [...b.matchAll(NUM)]
  if (na.length !== nb.length) return false
  return na.every((m, i) => {
    const x = parseFloat(m[0])
    const y = parseFloat(nb[i]![0])
    if (m[1] !== nb[i]![1]) return false
    if (m[1] === 'px') return Math.abs(x - y) <= px
    if (m[1] === '%') return Math.abs(x - y) <= 0.3
    return Math.abs(x - y) <= 1e-4 * Math.max(1, Math.abs(x))
  })
}
