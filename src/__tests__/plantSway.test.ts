import { describe, expect, it } from 'vitest'
import { PLANT_MEDIA } from '../scene/layout'
import { FIRST_SWAY_MS, SWAY_EVERY_MS, onHover, onSwayEnd, swaysOnItsOwn, type SwayState } from '../scene/plantSway'

describe('the hanging plant’s sway', () => {
  it('lasts about one turn of the record (5 s), and sways again every 7 s, with a short rest between', () => {
    expect(PLANT_MEDIA.stir.ms).toBeGreaterThan(4500)
    expect(PLANT_MEDIA.stir.ms).toBeLessThan(5500)
    expect(SWAY_EVERY_MS).toBe(7_000)
    expect(SWAY_EVERY_MS).toBeGreaterThan(PLANT_MEDIA.stir.ms) // it always comes to rest between its own sways
  })

  it('waits for her greeting to be gone (about 5.25 s after the room settles) before its first sway', () => {
    expect(FIRST_SWAY_MS).toBeGreaterThan(5250 + 1000)
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
