import { GLIMMERS, TELL_CYCLE_MS, type GlimmerId } from './glimmers'

/**
 * The room's cues:
 *  - Susana's greeting, and just behind it her second line ("Make yourself at home…"), on arrival
 *    (HotspotLayer, HeroScene: the greeting's own timing is untouched);
 *  - then the glimmers' hints (the cat, the lamp, the piano), one at a time, each in turn until it's
 *    found (src/scene/glimmers.ts). Nothing while a page is open, the room is paused, the tab is
 *    hidden or the visitor is pointing at something, nor for QUIET_AFTER_MS after: that turn waits,
 *    it isn't queued up.
 *  - Her lines about the room come only when the visitor hovers her: each time a new one about
 *    something not found or opened yet (linesLeft, nextLine), and what she mentions answers her:
 *    a section object breathes (BREATH_MS), a glimmer gives its hint.
 *
 * Kept free of React and the DOM so it can be tested.
 */

/** One of her lines, and the object it is about (a glimmer's id or a section object's overlay id). */
export interface Line {
  about: string | null
  text: string
}

/** One breath's length (HeroScene.css: halo-breath). */
export const BREATH_MS = 3800
/** After the visitor has pointed at something, the room keeps still this long. */
export const QUIET_AFTER_MS = 1500
/** The first hint, once the room's first look and her greeting are over (her second line is fading by then). */
export const FIRST_CUE_MS = 1000

/** The lines she can still say: those about something not found or opened yet. */
export function linesLeft(lines: readonly Line[], unfound: readonly string[], unopened: readonly string[]): Line[] {
  return lines.filter((l) => l.about !== null && (unfound.includes(l.about) || unopened.includes(l.about)))
}

/** The next line: any of those left but the last one said. `random` is 0-1 (Math.random()). */
export function nextLine(left: readonly Line[], last: string | null, random: number): Line | null {
  const pool = left.length > 1 ? left.filter((l) => l.text !== last) : left
  if (pool.length === 0) return null
  return pool[Math.min(pool.length - 1, Math.floor(Math.max(0, random) * pool.length))]!
}

/** The next glimmer to hint: the next unfound one after `last`, in GLIMMERS order; null when all are found. */
export function nextHint(unfound: readonly GlimmerId[], last: GlimmerId | null): GlimmerId | null {
  const order = GLIMMERS.filter((g) => unfound.includes(g))
  if (order.length === 0) return null
  const after = last ? GLIMMERS.indexOf(last) : -1
  return order.find((g) => GLIMMERS.indexOf(g) > after) ?? order[0]!
}

/** How long until the next hint: each unfound glimmer once every TELL_CYCLE_MS, spread evenly. */
export function cueGap(unfound: readonly GlimmerId[]): number {
  return Math.round(TELL_CYCLE_MS / Math.max(1, unfound.length))
}
