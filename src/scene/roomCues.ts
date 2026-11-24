import { GLIMMERS, TELL_CYCLE_MS, type GlimmerId } from './glimmers'

/**
 * The room's cues, on one clock, so only one thing moves at a time:
 *  - glimmer hints (the cat, the lamp, the piano), until each is found (src/scene/glimmers.ts);
 *  - section breaths: now and then one section object's amber halo swells softly and settles,
 *    a sign it opens something, until its section has been opened in this visit.
 *
 * - The first cue is a breath, right after the room's first look and her greeting, so a
 *   visitor sees early that the objects open something.
 * - While both are waiting they alternate (a breath, a hint, a breath…), one start every
 *   MIXED_GAP_MS. With only hints left, they keep their own cycle (each glimmer every
 *   TELL_CYCLE_MS). With only breaths left, one comes every 9-13 s, never on a beat.
 * - Breaths take turns among the objects in a shuffled order, never the same one twice running.
 * - Nothing while a page is open, the room is paused, the tab is hidden or the visitor is
 *   pointing at something, nor for QUIET_AFTER_MS after: that turn waits, it isn't queued up.
 * - Breaths don't come with reduced motion (the steady resting glow stays); hints come as fades.
 *
 * Kept free of React and the DOM so it can be tested.
 */

export type Cue = { kind: 'hint'; id: GlimmerId } | { kind: 'breath'; id: string }

/** Between cue starts while both hints and breaths are waiting. */
export const MIXED_GAP_MS = 5500
/** Between breaths once only breaths are left. */
export const BREATH_EVERY_MS: readonly [number, number] = [9000, 13000]
/** One breath's length (HeroScene.css: halo-breath). */
export const BREATH_MS = 3800
/** After the visitor has pointed at something, the room keeps still this long. */
export const QUIET_AFTER_MS = 1500
/** The first cue (a breath), once the room's first look and her greeting are over. */
export const FIRST_CUE_MS = 500

export interface CueState {
  /** Glimmers not found yet. */
  unfound: readonly GlimmerId[]
  /** Section objects that may breathe (not opened yet in this visit). */
  breathers: readonly string[]
  /** The last cue given, of either kind. */
  last: Cue | null
  lastHint: GlimmerId | null
  lastBreath: string | null
}

/** The next glimmer to hint: the next unfound one after `last`, in GLIMMERS order. */
export function nextHint(unfound: readonly GlimmerId[], last: GlimmerId | null): GlimmerId | null {
  const order = GLIMMERS.filter((g) => unfound.includes(g))
  if (order.length === 0) return null
  const after = last ? GLIMMERS.indexOf(last) : -1
  return order.find((g) => GLIMMERS.indexOf(g) > after) ?? order[0]!
}

/** The next object to breathe: any but the last one. `random` is 0-1 (Math.random()). */
export function nextBreath(breathers: readonly string[], last: string | null, random: number): string | null {
  const pool = breathers.length > 1 ? breathers.filter((b) => b !== last) : breathers
  if (pool.length === 0) return null
  return pool[Math.min(pool.length - 1, Math.floor(Math.max(0, random) * pool.length))]!
}

/** Which cue comes now: when both kinds are waiting they alternate, starting with a breath. */
export function nextCue(state: CueState, random: number): Cue | null {
  const hint = nextHint(state.unfound, state.lastHint)
  const breath = nextBreath(state.breathers, state.lastBreath, random)
  if (hint && breath) return state.last?.kind === 'breath' ? { kind: 'hint', id: hint } : { kind: 'breath', id: breath }
  if (hint) return { kind: 'hint', id: hint }
  if (breath) return { kind: 'breath', id: breath }
  return null
}

/** How long until the cue after this one, from what is still waiting. `random` is 0-1. */
export function cueGap(state: Pick<CueState, 'unfound' | 'breathers'>, random: number): number {
  const hints = state.unfound.length > 0
  const breaths = state.breathers.length > 0
  if (hints && breaths) return MIXED_GAP_MS
  if (hints) return Math.round(TELL_CYCLE_MS / state.unfound.length)
  const [min, max] = BREATH_EVERY_MS
  return Math.round(min + Math.min(1, Math.max(0, random)) * (max - min))
}
