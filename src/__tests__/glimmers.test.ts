import { describe, expect, it } from 'vitest'
import { FIRST_LOOK_TELL_GAP_MS, FIRST_LOOK_TELL_MS, GLIMMERS, TELL_EVERY_MS, firstLookTells, isGlimmer, nextTell, tellDelay } from '../scene/glimmers'
import { HOTSPOTS } from '../scene/hotspots'

describe('the room’s small surprises (glimmers)', () => {
  it('are the objects that answer in place rather than opening a section', () => {
    const inPlace = HOTSPOTS.filter((h) => h.action).map((h) => h.id)
    expect([...GLIMMERS].sort()).toEqual([...inPlace].sort())
    expect(isGlimmer('cat')).toBe(true)
    expect(isGlimmer('laptop')).toBe(false)
    expect(isGlimmer(null)).toBe(false)
  })

  it('each give their tell once, in turn, right after the room’s first look', () => {
    expect(firstLookTells(['cat', 'lamp'])).toEqual([
      { id: 'cat', at: FIRST_LOOK_TELL_MS },
      { id: 'lamp', at: FIRST_LOOK_TELL_MS + FIRST_LOOK_TELL_GAP_MS },
    ])
    expect(firstLookTells(['lamp'])).toEqual([{ id: 'lamp', at: FIRST_LOOK_TELL_MS }])
    expect(firstLookTells([])).toEqual([])
  })

  it('then take turns, one at a time, among the ones not yet found', () => {
    expect(nextTell(['cat', 'lamp'], null)).toBe('cat')
    expect(nextTell(['cat', 'lamp'], 'cat')).toBe('lamp')
    expect(nextTell(['cat', 'lamp'], 'lamp')).toBe('cat')
    expect(nextTell(['lamp'], 'lamp')).toBe('lamp')
    expect(nextTell(['cat'], 'cat')).toBe('cat')
  })

  it('stop once every one has been found', () => {
    expect(nextTell([], 'cat')).toBeNull()
  })

  it('come every 12 to 20 seconds, never on a beat', () => {
    expect(tellDelay(0)).toBe(TELL_EVERY_MS[0])
    expect(tellDelay(1)).toBe(TELL_EVERY_MS[1])
    expect(new Set([0.1, 0.4, 0.8].map(tellDelay)).size).toBe(3)
  })
})
