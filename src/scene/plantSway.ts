/**
 * The hanging plant's pace. Its sway (scripts/build-plant.py) lasts about one turn of the record
 * (12 rpm: one turn every 5 s), so it keeps the room's beat: on its own it sways for one turn and
 * rests for about two seconds, again and again, like a slow draught through the room.
 *
 * It moves with the rest of the room's choreography: its clip loads as the room is revealed, and
 * its beat starts the moment the room settles, with the coffee's steam, the cat and the woman. The
 * beats then fall every SWAY_EVERY_MS from that moment, on a fixed grid that never drifts (each
 * sway's next copy is decoded in advance, so it starts on its beat). A beat that comes before the
 * clip is ready, or while it is still swaying, is let pass: it never starts late, off the beat.
 *
 * A hover always gets an answer: at rest, it sways at once (the grid carries on as it was);
 * mid-sway, one more sway follows straight on from this one (it ends and
 * starts on the same pose, so the two join without a seam). More hovers in the meantime add nothing
 * further: one more is plenty, and the sway never stacks up into a long loop.
 */

/** From one sway of its own to the next: one record turn of sway (about 5 s), then about 2 s of rest. */
export const SWAY_EVERY_MS = 7_000

/** A beat that fell this little ago still counts as now (timers never fire exactly on time). */
export const BEAT_TOLERANCE_MS = 100

/**
 * How long until its next beat, `sinceSettledMs` after the room settled (the first beat is the
 * moment it settles). A beat less than BEAT_TOLERANCE_MS ago is now (0). Just after a beat has been
 * played (`afterBeat`), it's the one after that, counted from the grid, so a late timer never
 * shifts the rhythm and no beat is played twice.
 */
export function untilNextBeat(sinceSettledMs: number, afterBeat = false): number {
  const beat = afterBeat
    ? Math.round(sinceSettledMs / SWAY_EVERY_MS) + 1
    : Math.max(0, Math.ceil((sinceSettledMs - BEAT_TOLERANCE_MS) / SWAY_EVERY_MS))
  return Math.max(0, beat * SWAY_EVERY_MS - sinceSettledMs)
}

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
