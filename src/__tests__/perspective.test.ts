import { describe, expect, it } from 'vitest'
import { projectPoint, type Pt } from '../scene/perspective'

describe('perspective mapping', () => {
  const quad: [Pt, Pt, Pt, Pt] = [
    [138, 6],
    [412, 10],
    [391, 196],
    [102, 196],
  ]
  it('lands each corner of the element on the matching corner of the shape', () => {
    const corners: Pt[] = [
      [0, 0],
      [400, 0],
      [400, 262],
      [0, 262],
    ]
    corners.forEach((c, i) => {
      const [x, y] = projectPoint(400, 262, quad, c)
      expect(x).toBeCloseTo(quad[i]![0], 2)
      expect(y).toBeCloseTo(quad[i]![1], 2)
    })
  })

  it('keeps the middle inside the shape', () => {
    const [x, y] = projectPoint(400, 262, quad, [200, 131])
    expect(x).toBeGreaterThan(102)
    expect(x).toBeLessThan(412)
    expect(y).toBeGreaterThan(6)
    expect(y).toBeLessThan(196)
  })

  it("keeps the element's lines running with the shape's edges (same vanishing points)", () => {
    // the laptop's glass, as drawn (LaptopTerminal's SCREEN on a 420 x 294 box): a real trapezoid
    const glass: [Pt, Pt, Pt, Pt] = [
      [0.3309 * 420, 0.0543 * 294],
      [0.9655 * 420, 0.0641 * 294],
      [0.9078 * 420, 0.6966 * 294],
      [0.2634 * 420, 0.6356 * 294],
    ]
    const meet = ([a, b]: [Pt, Pt], [c, d]: [Pt, Pt]): Pt => {
      const den = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0])
      const t = ((a[0] - c[0]) * (c[1] - d[1]) - (a[1] - c[1]) * (c[0] - d[0])) / den
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
    }
    // how far a point is off the line through p and q, in px
    const off = (p: Pt, q: Pt, r: Pt) =>
      Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / Math.hypot(q[0] - p[0], q[1] - p[1])
    const across = meet([glass[0], glass[1]], [glass[3], glass[2]]) // where the top and bottom edges meet
    const down = meet([glass[0], glass[3]], [glass[1], glass[2]]) // where the sides meet
    for (const v of [0.31 * 260, 0.5 * 260, 0.79 * 260]) {
      const p = projectPoint(400, 260, glass, [0.17 * 400, v])
      const q = projectPoint(400, 260, glass, [0.7 * 400, v])
      expect(off(p, q, across)).toBeLessThan(0.01 * Math.hypot(across[0] - p[0], across[1] - p[1]))
    }
    for (const u of [0.17 * 400, 0.7 * 400]) {
      const p = projectPoint(400, 260, glass, [u, 0.31 * 260])
      const q = projectPoint(400, 260, glass, [u, 0.79 * 260])
      expect(off(p, q, down)).toBeLessThan(0.01 * Math.hypot(down[0] - p[0], down[1] - p[1]))
    }
  })
})
