/**
 * Glimmers: the room's small surprises. They don't open a section; they answer in place,
 * like the cat (pet it), the lamp (click it) and the piano (click it to bring it close and play it). Section objects are found by their amber
 * halo and the room's first look around. Glimmers have no halo and no label, so each has a
 * *hint* instead: a small sign of life that makes a visitor curious, never an instruction
 * (no hands, arrows, rings or words like "click").
 *
 * One rule for all of them, so a new glimmer only needs a hint:
 *  - Moonlight is theirs: every hint is drawn in one soft moonlight blue (--moon in
 *    tokens.css) that nothing else in the room uses, so the colour alone says "a different
 *    kind of thing". The bloom is an edge on the hint's own small marks, never a halo.
 *  - In its own nature: the sleeping cat breathes out z's; the lamp's bulb catches, as if a
 *    switch had been touched, and glints run up its brass. The little piano computer plays its
 *    own hover for a moment (it grows a touch, its screen flickers on and blinks its name, a
 *    few cream notes float up): the one hint not in moonlight, since its screen is its voice.
 *  - The room's pace: hints ease in softly (about a second, out of a slight blur, like her
 *    greeting), drift on the room's curves, and fade as they go. Never held, never snapped.
 *  - Bolder, not bigger: noticed through a firm stroke, each covering about the same area.
 *  - Looped while unfound, one at a time, on the room's one clock (src/scene/roomCues.ts):
 *    each unfound glimmer once every TELL_CYCLE_MS, in turn (and a glimmer Susana mentions when
 *    she's hovered answers her with its hint). The first starts once the room's first
 *    look and her greeting are over. Never while a page is open, the room is paused, the tab
 *    is hidden or an object is being pointed at (that turn waits, it isn't queued). With
 *    reduced motion a hint fades in and out where it stands.
 *  - Their own cursors, in the room's ink (GlimmerCursor): over the cat, a hand that
 *    strokes; over the lamp, a little bulb that flicks on; over the piano, a pixel-art note
 *    that hops on the beat. No hover label on any of them (screen readers keep each one's name).
 *  - Found: once a glimmer has been met (hovered, focused or tapped), its hint stops, for
 *    good, in this browser. When all are found, the room is quiet again.
 *
 * Kept free of React and the DOM, apart from the memory at the end, so it can be tested.
 */

/** Every glimmer in the room, in the order their hints come in each cycle. */
export const GLIMMERS = ['cat', 'lamp', 'piano'] as const
export type GlimmerId = (typeof GLIMMERS)[number]

export const isGlimmer = (id: string | null): id is GlimmerId => GLIMMERS.includes(id as GlimmerId)

/** Each unfound glimmer gives its hint once per cycle (long enough for each of the three to finish its own). */
export const TELL_CYCLE_MS = 13500

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
