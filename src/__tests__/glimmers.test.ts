import { describe, expect, it } from 'vitest'
import { GLIMMERS, TELL_CYCLE_MS, TELL_START_MS, isGlimmer, tellStarts } from '../scene/glimmers'
import { HOTSPOTS } from '../scene/hotspots'

describe('the room’s small surprises (glimmers)', () => {
  it('are the objects that answer in place rather than opening a section', () => {
    const inPlace = HOTSPOTS.filter((h) => h.action).map((h) => h.id)
    expect([...GLIMMERS].sort()).toEqual([...inPlace].sort())
    expect(isGlimmer('cat')).toBe(true)
    expect(isGlimmer('laptop')).toBe(false)
    expect(isGlimmer(null)).toBe(false)
  })

  it('give their hints once a cycle, spread evenly across it, so only one moves at a time', () => {
    expect(tellStarts(['cat', 'lamp'])).toEqual([
      { id: 'cat', at: TELL_START_MS },
      { id: 'lamp', at: TELL_START_MS + TELL_CYCLE_MS / 2 },
    ])
  })

  it('start at once for the one left when the other has been found', () => {
    expect(tellStarts(['lamp'])).toEqual([{ id: 'lamp', at: TELL_START_MS }])
    expect(tellStarts(['cat'])).toEqual([{ id: 'cat', at: TELL_START_MS }])
  })

  it('stop once every one has been found', () => {
    expect(tellStarts([])).toEqual([])
  })

  it('leave each hint room to finish before the next one starts', () => {
    // the longest hint (the cat's z's, about 4.4 s) fits in each glimmer's share of a cycle
    expect(TELL_CYCLE_MS / GLIMMERS.length).toBeGreaterThanOrEqual(4400)
  })
})
