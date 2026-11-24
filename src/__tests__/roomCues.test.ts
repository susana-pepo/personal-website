import { describe, expect, it } from 'vitest'
import { TELL_CYCLE_MS } from '../scene/glimmers'
import { BREATH_EVERY_MS, BREATH_MS, FIRST_CUE_MS, MIXED_GAP_MS, QUIET_AFTER_MS, cueGap, nextBreath, nextCue, nextHint, type CueState } from '../scene/roomCues'

const state = (over: Partial<CueState>): CueState => ({ unfound: [], breathers: [], last: null, lastHint: null, lastBreath: null, ...over })
const SECTIONS = ['vinyl', 'books', 'deskbooks', 'laptop', 'coffee']

describe('the room’s cues (glimmer hints and section breaths)', () => {
  it('alternate while both are waiting, starting with a breath so the sections show early', () => {
    const both = { unfound: ['cat', 'lamp'] as const, breathers: SECTIONS }
    const first = nextCue(state(both), 0.5)
    expect(first?.kind).toBe('breath')
    const second = nextCue(state({ ...both, last: first, lastBreath: first!.id }), 0.5)
    expect(second).toEqual({ kind: 'hint', id: 'cat' })
    const third = nextCue(state({ ...both, last: second, lastHint: 'cat', lastBreath: first!.id }), 0.5)
    expect(third?.kind).toBe('breath')
    expect(third!.id).not.toBe(first!.id)
  })

  it('come soon after the first look, and pause only briefly after pointing', () => {
    expect(FIRST_CUE_MS).toBeLessThanOrEqual(600)
    expect(QUIET_AFTER_MS).toBeLessThanOrEqual(1500)
  })

  it('give only breaths once every glimmer is found, and nothing when all is found and opened', () => {
    expect(nextCue(state({ breathers: SECTIONS }), 0.2)?.kind).toBe('breath')
    expect(nextCue(state({ unfound: ['piano'] }), 0.2)).toEqual({ kind: 'hint', id: 'piano' })
    expect(nextCue(state({}), 0.2)).toBeNull()
  })

  it('never let the same object breathe twice running', () => {
    for (const last of SECTIONS)
      for (const random of [0, 0.25, 0.5, 0.99, 1]) {
        const next = nextBreath(SECTIONS, last, random)
        expect(next).not.toBe(last)
        expect(SECTIONS).toContain(next)
      }
    expect(nextBreath(['laptop'], 'laptop', 0.5)).toBe('laptop')
    expect(nextBreath([], null, 0.5)).toBeNull()
  })

  it('keep the glimmers taking turns in their usual order', () => {
    expect(nextHint(['cat', 'lamp', 'piano'], null)).toBe('cat')
    expect(nextHint(['cat', 'lamp', 'piano'], 'cat')).toBe('lamp')
    expect(nextHint(['cat', 'piano'], 'piano')).toBe('cat')
  })

  it('are well paced: a calm gap between starts, never on a beat once only breaths are left', () => {
    expect(cueGap({ unfound: ['cat'], breathers: SECTIONS }, 0.5)).toBe(MIXED_GAP_MS)
    expect(cueGap({ unfound: ['cat', 'lamp', 'piano'], breathers: [] }, 0.5)).toBe(TELL_CYCLE_MS / 3)
    expect(cueGap({ unfound: [], breathers: SECTIONS }, 0)).toBe(BREATH_EVERY_MS[0])
    expect(cueGap({ unfound: [], breathers: SECTIONS }, 1)).toBe(BREATH_EVERY_MS[1])
    expect(new Set([0.1, 0.5, 0.9].map((r) => cueGap({ unfound: [], breathers: SECTIONS }, r))).size).toBe(3)
    // a breath is always over before the next cue starts
    expect(Math.min(MIXED_GAP_MS, BREATH_EVERY_MS[0])).toBeGreaterThan(BREATH_MS)
  })
})
