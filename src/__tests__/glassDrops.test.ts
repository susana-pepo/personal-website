import { describe, expect, it } from 'vitest'
import { DROPS, isGlass, makeGlass, merge, overcastRgb, paneBottom, stepGlass, wetGlass, type GlassMap } from '../scene/glassDrops'
import { seeded } from '../scene/weather'

/** A window of four panes: bars down the middle and across at y 300. */
function panes(): GlassMap {
  const width = 600
  const height = 600
  const step = 2
  const cols = width / step
  const rows = height / step
  const alpha = new Uint8ClampedArray(cols * rows)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * step
      const y = r * step
      const bar = Math.abs(x - 300) < 10 || Math.abs(y - 300) < 10 || x < 10 || y < 10 || x > 590 || y > 590
      alpha[r * cols + c] = bar ? 0 : 255
    }
  }
  return { width, height, step, alpha }
}

describe('the glass', () => {
  const map = panes()

  it('knows glass from bars', () => {
    expect(isGlass(map, 100, 100)).toBe(true)
    expect(isGlass(map, 300, 100)).toBe(false)
    expect(isGlass(map, 100, 300)).toBe(false)
    expect(isGlass(map, -5, 100)).toBe(false)
  })

  it('finds the bar under a pane', () => {
    const bottom = paneBottom(map, 100, 50)
    expect(bottom).toBeGreaterThan(280)
    expect(bottom).toBeLessThan(292)
    expect(paneBottom(map, 100, 400)).toBeGreaterThan(580)
  })
})

describe('drops', () => {
  const map = panes()

  it('keep their water when they merge', () => {
    const a = { x: 0, y: 0, r: 3, alpha: 1, life: 1, gain: 0 }
    merge(a, { x: 4, y: 0, r: 4 })
    expect(a.r).toBeCloseTo(5)
    expect(a.x).toBeCloseTo((0 * 9 + 4 * 16) / 25)
  })

  it('land only on glass, and the glass fills to its limit', () => {
    const glass = makeGlass()
    wetGlass(glass, map, 60, seeded(1))
    expect(glass.beads.length).toBeGreaterThan(100)
    expect(glass.beads.length).toBeLessThanOrEqual(DROPS.maxBeads)
    for (const b of glass.beads) expect(isGlass(map, b.x, b.y)).toBe(true)
  })

  it('are mostly fine beads, with a few fuller ones', () => {
    const glass = makeGlass()
    wetGlass(glass, map, 60, seeded(2))
    const sizes = glass.beads.map((b) => b.r).sort((a, b) => a - b)
    expect(sizes[sizes.length >> 1]!).toBeLessThan(2.6)
    expect(sizes.filter((r) => r >= 4).length).toBeGreaterThan(0)
  })

  it('now and then run, and stop on the bar under their pane', () => {
    const glass = makeGlass()
    const rand = seeded(3)
    wetGlass(glass, map, 45, rand)
    let runs = 0
    let seen = 0
    for (let t = 0; t < 120; t += 1 / 30) {
      stepGlass(glass, map, 1 / 30, true, rand)
      if (glass.runners.length > seen) runs += glass.runners.length - seen
      seen = glass.runners.length
      for (const d of glass.runners) expect(d.y).toBeLessThanOrEqual(d.stopY + 1)
    }
    expect(runs).toBeGreaterThan(2) // a few runs in two minutes
    expect(runs).toBeLessThan(60) // never a stream
  })

  it('dry away once the rain stops', () => {
    const glass = makeGlass()
    const rand = seeded(4)
    wetGlass(glass, map, 30, rand)
    for (let t = 0; t < DROPS.dryS + 5; t += 0.1) stepGlass(glass, map, 0.1, false, rand)
    expect(glass.beads.length).toBe(0)
    expect(glass.runners.length).toBe(0)
  })
})

describe('the view through a drop by day', () => {
  it('turns a blue sky grey, as the view itself does', () => {
    const [r, g, b] = overcastRgb(55, 161, 251)
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(16)
  })

  it('keeps leaves green, only duller', () => {
    const [r, g, b] = overcastRgb(52, 120, 48)
    expect(g).toBeGreaterThan(r)
    expect(g).toBeGreaterThan(b)
    expect(g).toBeLessThan(120)
  })
})
