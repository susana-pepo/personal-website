import { describe, expect, it } from 'vitest'
import { CRATE_GAP, CRATE_MIN_STRIP, crateOffsets, nextSleeve, playedAgo, sleeveAt } from '../components/sections/music/crate'

const S = 132 // 8.25rem

describe('crateOffsets', () => {
  it('stands sleeves side by side when every face fits', () => {
    expect(crateOffsets(3, S, 1000, null)).toEqual([0, S + CRATE_GAP, 2 * (S + CRATE_GAP)])
    // Focus changes nothing when there is room for all of them.
    expect(crateOffsets(3, S, 1000, 1)).toEqual(crateOffsets(3, S, 1000, null))
  })

  it('overlaps evenly across the width with nothing in focus', () => {
    const xs = crateOffsets(9, S, 560, null)
    expect(xs[0]).toBe(0)
    expect(xs.at(-1)).toBeCloseTo(560 - S)
    const steps = xs.slice(1).map((x, i) => x - xs[i]!)
    for (const step of steps) expect(step).toBeCloseTo(steps[0]!)
  })

  it('opens the focused sleeve to its full face and keeps the crate within its width', () => {
    for (const focus of [0, 3, 7]) {
      const xs = crateOffsets(9, S, 560, focus)
      expect(xs[focus + 1]! - xs[focus]!).toBeCloseTo(S + CRATE_GAP)
      expect(xs.at(-1)).toBeCloseTo(560 - S)
      xs.slice(1).forEach((x, i) => expect(x).toBeGreaterThanOrEqual(xs[i]!))
    }
  })

  it('never squeezes the others below a thin strip, even with fourteen records on a phone', () => {
    const width = 320
    const s = 104 // 6.5rem
    const xs = crateOffsets(14, s, width, 5)
    const steps = xs.slice(1).map((x, i) => x - xs[i]!)
    steps.forEach((step, i) => {
      if (i !== 5) expect(step).toBeGreaterThanOrEqual(CRATE_MIN_STRIP - 0.001)
    })
    expect(xs.at(-1)).toBeCloseTo(width - s)
  })

  it('treats the last sleeve as already open, since nothing covers it', () => {
    expect(crateOffsets(6, S, 400, 5)).toEqual(crateOffsets(6, S, 400, null))
  })

  it('copes with one, two and no records, and with an unmeasured width', () => {
    expect(crateOffsets(0, S, 500, null)).toEqual([])
    expect(crateOffsets(1, S, 500, 0)).toEqual([0])
    expect(crateOffsets(2, S, 200, 0)).toEqual([0, 200 - S])
    expect(crateOffsets(4, 0, 0, 1).every((x) => Number.isFinite(x))).toBe(true)
  })
})

describe('sleeveAt', () => {
  const xs = [0, 40, 80, 220]
  it('picks the front-most sleeve whose left edge is at or before the pointer', () => {
    expect(sleeveAt(xs, -5)).toBe(0)
    expect(sleeveAt(xs, 39)).toBe(0)
    expect(sleeveAt(xs, 40)).toBe(1)
    expect(sleeveAt(xs, 150)).toBe(2)
    expect(sleeveAt(xs, 999)).toBe(3)
  })
})

describe('nextSleeve', () => {
  it('moves with the arrow keys, clamped at both ends', () => {
    expect(nextSleeve('ArrowRight', 2, 5)).toBe(3)
    expect(nextSleeve('ArrowDown', 4, 5)).toBe(4)
    expect(nextSleeve('ArrowLeft', 0, 5)).toBe(0)
    expect(nextSleeve('ArrowUp', 3, 5)).toBe(2)
  })
  it('jumps with Home and End, and ignores other keys', () => {
    expect(nextSleeve('Home', 3, 5)).toBe(0)
    expect(nextSleeve('End', 0, 5)).toBe(4)
    expect(nextSleeve('Enter', 1, 5)).toBeNull()
    expect(nextSleeve('a', 1, 5)).toBeNull()
    expect(nextSleeve('ArrowRight', 0, 0)).toBeNull()
  })
})

describe('playedAgo', () => {
  const now = Date.parse('2026-11-23T12:00:00Z')
  it('describes recent plays in plain words', () => {
    expect(playedAgo('2026-11-23T11:59:30Z', now)).toBe('just now')
    expect(playedAgo('2026-11-23T11:35:00Z', now)).toBe('25 minutes ago')
    expect(playedAgo('2026-11-23T10:00:00Z', now)).toBe('2 hours ago')
    expect(playedAgo('2026-11-22T09:00:00Z', now)).toBe('yesterday')
  })
  it('says nothing when the date is missing, unreadable, in the future or long ago', () => {
    expect(playedAgo(undefined, now)).toBe('')
    expect(playedAgo('not a date', now)).toBe('')
    expect(playedAgo('2026-11-23T13:00:00Z', now)).toBe('')
    expect(playedAgo('2025-01-01T00:00:00Z', now)).toBe('')
  })
})
