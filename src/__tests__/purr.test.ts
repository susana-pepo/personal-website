import { describe, expect, it } from 'vitest'
import { RESTING, purrGain, purrLevel, strokeEnergy } from '../audio/purr'
import { DEFAULT_PREFS } from '../audio/radio'

describe('the cat’s purr', () => {
  it('is as loud as the music is set, and silent when the music is at zero', () => {
    expect(purrGain(0)).toBe(0)
    expect(purrGain(DEFAULT_PREFS.musicLevel)).toBeCloseTo(0.24)
    expect(purrGain(1)).toBeGreaterThan(purrGain(0.3))
    expect(purrGain(2)).toBe(purrGain(1))
  })

  it('starts the room at a gentle 30%', () => {
    expect(DEFAULT_PREFS.musicLevel).toBe(0.3)
  })

  it('grows fuller the faster the hand strokes', () => {
    const slow = strokeEnergy(0, 150, 0.016)
    const fast = strokeEnergy(0, 1200, 0.016)
    expect(fast).toBeGreaterThan(slow)
    expect(strokeEnergy(0, 5000, 0.016)).toBeLessThanOrEqual(1)
    // stroking on builds it up
    let e = 0
    for (let i = 0; i < 30; i++) e = strokeEnergy(e, 900, 0.016)
    expect(e).toBeGreaterThan(0.9)
  })

  it('settles when the hand stops, and a slow stroke never cuts a full purr short', () => {
    expect(strokeEnergy(1, 0, 0.9)).toBeCloseTo(Math.exp(-1))
    expect(strokeEnergy(1, 0, 5)).toBeLessThan(0.01)
    expect(strokeEnergy(0.8, 50, 0.016)).toBeGreaterThan(0.75)
  })

  it('keeps a quiet resting purr while the hand stays on the cat', () => {
    expect(purrLevel(1, 0)).toBeCloseTo(RESTING)
    expect(purrLevel(1, 1)).toBeCloseTo(1)
    expect(purrLevel(0.24, 0.5)).toBeLessThan(0.24)
    expect(purrLevel(0, 1)).toBe(0)
  })
})
