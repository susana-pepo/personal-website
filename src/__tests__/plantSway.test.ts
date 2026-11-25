import { describe, expect, it } from 'vitest'
import { PLANT_MEDIA } from '../scene/layout'
import { BEAT_TOLERANCE_MS, SWAY_EVERY_MS, onHover, onSwayEnd, swaysOnItsOwn, untilNextBeat, type SwayState } from '../scene/plantSway'

describe('the hanging plant’s sway', () => {
  it('lasts about one turn of the record (5 s), and sways again every 7 s, with a short rest between', () => {
    expect(PLANT_MEDIA.stir.ms).toBeGreaterThan(4500)
    expect(PLANT_MEDIA.stir.ms).toBeLessThan(5500)
    expect(SWAY_EVERY_MS).toBe(7_000)
    expect(SWAY_EVERY_MS).toBeGreaterThan(PLANT_MEDIA.stir.ms) // it always comes to rest between its own sways
  })

  it('starts its beat the moment the room settles, with the rest of the room', () => {
    expect(untilNextBeat(0)).toBe(0)
    expect(untilNextBeat(-300)).toBe(300) // (not settled yet: the first beat is when it settles)
  })

  it('counts a beat that fell a moment ago as now (the room settling is the first beat)', () => {
    expect(untilNextBeat(0.2)).toBe(0) // measured a sliver after it settled
    expect(untilNextBeat(SWAY_EVERY_MS + 40)).toBe(0) // a beat timer that fired 40 ms late
    expect(untilNextBeat(BEAT_TOLERANCE_MS + 1)).toBe(SWAY_EVERY_MS - BEAT_TOLERANCE_MS - 1) // too long ago: the next one
  })

  it('keeps its beat on a fixed grid from that moment, so a late timer never shifts the rhythm', () => {
    expect(untilNextBeat(5 * SWAY_EVERY_MS - 2500)).toBe(2500)
    // just after a beat was played, the next is the one after it on the grid, even if this one was late
    expect(untilNextBeat(SWAY_EVERY_MS + 40, true)).toBe(SWAY_EVERY_MS - 40)
    expect(untilNextBeat(0.2, true)).toBeCloseTo(SWAY_EVERY_MS - 0.2)
  })

  it('answers every hover: at once from rest, and with one more sway straight after when mid-sway', () => {
    expect(onHover('rest')).toEqual({ state: 'swaying', start: true })
    expect(onHover('swaying')).toEqual({ state: 'swaying-again', start: false })
    expect(onHover('swaying-again')).toEqual({ state: 'swaying-again', start: false })
  })

  it('goes again once when asked mid-sway, then rests (hovers never stack into a loop)', () => {
    let state: SwayState = 'rest'
    state = onHover(state).state // sways
    state = onHover(state).state // asks for one more
    state = onHover(state).state // and another: still just one more
    const first = onSwayEnd(state)
    expect(first.again).toBe(true)
    const second = onSwayEnd(first.state)
    expect(second).toEqual({ state: 'rest', again: false })
  })

  it('sways on its own only from rest', () => {
    expect(swaysOnItsOwn('rest')).toBe(true)
    expect(swaysOnItsOwn('swaying')).toBe(false)
    expect(swaysOnItsOwn('swaying-again')).toBe(false)
  })
})
