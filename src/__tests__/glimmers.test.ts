import { describe, expect, it } from 'vitest'
import { GLIMMERS, TELL_CYCLE_MS, isGlimmer } from '../scene/glimmers'
import { MIXED_GAP_MS } from '../scene/roomCues'
import { HOTSPOTS } from '../scene/hotspots'

describe('the room’s small surprises (glimmers)', () => {
  it('are the objects that answer in place rather than opening a section', () => {
    const inPlace = HOTSPOTS.filter((h) => h.action).map((h) => h.id)
    expect([...GLIMMERS].sort()).toEqual([...inPlace].sort())
    expect(isGlimmer('cat')).toBe(true)
    expect(isGlimmer('laptop')).toBe(false)
    expect(isGlimmer(null)).toBe(false)
  })

  it('leave each hint room to finish before the next one starts', () => {
    // the longest hint (the cat's z's, about 4.4 s) fits in each glimmer's share of a cycle,
    // and between two cues while section breaths take turns with the hints (src/scene/roomCues.ts)
    expect(TELL_CYCLE_MS / GLIMMERS.length).toBeGreaterThanOrEqual(4400)
    expect(MIXED_GAP_MS).toBeGreaterThanOrEqual(4400)
  })
})
