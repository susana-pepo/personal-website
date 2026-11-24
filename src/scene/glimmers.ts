/**
 * Glimmers: the room's small surprises. They don't open a section; they answer in place,
 * like the cat (pet it) and the lamp (click it). Section objects are found by their amber
 * halo and the room's first look around. Glimmers have no glow and no label, so each one has a
 * *tell* instead: a small sign of life it gives on its own, in its own voice (the cat dreams a
 * couple of z's; the lamp wiggles by its shade and its bulb warms), so a visitor notices
 * something is there to find.
 *
 * One rule for all of them, so a new glimmer only needs a tell:
 *  - First look: on a visit where any is still unfound, right after the room's first look
 *    around (the halos, left to right), each unfound glimmer gives its tell once, in turn.
 *  - After that, one tell at a time, every 12-20 s (never on a beat), taking turns among
 *    the unfound ones. Never while a page is open, the room is still, the tab is hidden or
 *    an object is being pointed at; never with reduced motion.
 *  - Found: once a glimmer has been met (hovered, focused or tapped), the room stops asking
 *    for its tell, for good, in this browser. When all are found, the room is quiet again.
 *
 * Kept free of React and the DOM, apart from the memory at the end, so it can be tested.
 */

/** Every glimmer in the room, in the order their tells come (left to right isn't needed: this is the order of surprise). */
export const GLIMMERS = ['cat', 'lamp'] as const
export type GlimmerId = (typeof GLIMMERS)[number]

export const isGlimmer = (id: string | null): id is GlimmerId => GLIMMERS.includes(id as GlimmerId)

/** After the room's first look ends: the first tell, then the next ones this far apart. */
export const FIRST_LOOK_TELL_MS = 250
export const FIRST_LOOK_TELL_GAP_MS = 1400
/** Between later tells (one glimmer at a time). */
export const TELL_EVERY_MS: readonly [number, number] = [12_000, 20_000]

/** The first look's tells: every unfound glimmer once, in turn. */
export function firstLookTells(unfound: readonly GlimmerId[]): { id: GlimmerId; at: number }[] {
  return GLIMMERS.filter((g) => unfound.includes(g)).map((id, i) => ({ id, at: FIRST_LOOK_TELL_MS + i * FIRST_LOOK_TELL_GAP_MS }))
}

/** Whose tell comes next: the next unfound glimmer after `last`, in GLIMMERS order; null when all are found. */
export function nextTell(unfound: readonly GlimmerId[], last: GlimmerId | null): GlimmerId | null {
  const order = GLIMMERS.filter((g) => unfound.includes(g))
  if (order.length === 0) return null
  const after = last ? GLIMMERS.indexOf(last) : -1
  return order.find((g) => GLIMMERS.indexOf(g) > after) ?? order[0]!
}

/** How long until the next tell. `random` is 0-1 (Math.random()). */
export function tellDelay(random: number): number {
  const [min, max] = TELL_EVERY_MS
  return Math.round(min + Math.min(1, Math.max(0, random)) * (max - min))
}

// ── Which have been found, remembered in this browser only (if storage is unavailable, a
// visitor simply finds them again next time). ──

const KEY = 'room-glimmers-found'

let found: Set<GlimmerId> = (() => {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    return new Set((saved ? (JSON.parse(saved) as string[]) : []).filter(isGlimmer))
  } catch {
    return new Set<GlimmerId>()
  }
})()

export const unfoundGlimmers = (): GlimmerId[] => GLIMMERS.filter((g) => !found.has(g))

export function findGlimmer(id: GlimmerId) {
  if (found.has(id)) return
  found = new Set(found).add(id)
  try {
    localStorage.setItem(KEY, JSON.stringify([...found]))
  } catch {
    /* private mode: fine */
  }
}
