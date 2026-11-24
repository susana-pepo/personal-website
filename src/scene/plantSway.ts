/**
 * The hanging plant's pace. Its sway (scripts/build-plant.py) lasts about one turn of the record
 * (12 rpm: one turn every 5 s), so it keeps the room's beat: on its own it sways for one turn and
 * rests for about two seconds, again and again, like a slow draught through the room. Its first sway waits
 * until her greeting has floated away (from the room settling: greeting in at 0.55 s, gone by
 * 5.25 s), so the two never draw the eye at once.
 *
 * A hover always gets an answer: at rest, it sways at once (and the next sway of its own then comes
 * a whole period later); mid-sway, one more sway follows straight on from this one (it ends and
 * starts on the same pose, so the two join without a seam). More hovers in the meantime add nothing
 * further: one more is plenty, and the sway never stacks up into a long loop.
 */

/** From one sway of its own to the next: one record turn of sway (about 5 s), then about 2 s of rest. */
export const SWAY_EVERY_MS = 7_000
/** Its first sway, from the room settling (after her greeting, which is gone by about 5.25 s). */
export const FIRST_SWAY_MS = 8_000

export type SwayState = 'rest' | 'swaying' | 'swaying-again'

/** What a hover does: start a sway now, ask for one more after this one, or nothing (one is already asked for). */
export function onHover(state: SwayState): { state: SwayState; start: boolean } {
  if (state === 'rest') return { state: 'swaying', start: true }
  return { state: 'swaying-again', start: false }
}

/** A sway has ended: go again straight on (a hover asked for it), or rest. */
export function onSwayEnd(state: SwayState): { state: SwayState; again: boolean } {
  return state === 'swaying-again' ? { state: 'swaying', again: true } : { state: 'rest', again: false }
}

/** A sway of its own is due: it only starts from rest (a sway already playing is the room's sway). */
export const swaysOnItsOwn = (state: SwayState) => state === 'rest'
