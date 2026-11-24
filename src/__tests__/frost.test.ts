import { describe, expect, it } from 'vitest'
import { fbm, formed, frostBuilder, frostField, valueNoise } from '../scene/frost'

/** A window 600 × 500: a crossbar at y 240-255, a sill from y 480, and bars at x 0-9, 295-305 and 590+. */
function windowMask() {
  const width = 600
  const height = 500
  const alpha = new Uint8ClampedArray(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bar = (y >= 240 && y <= 255) || y >= 480 || y < 6 || x < 10 || Math.abs(x - 300) <= 5 || x >= 590
      alpha[y * width + x] = bar ? 0 : 255
    }
  }
  return { alpha, width, height }
}

describe('noise', () => {
  it('is repeatable and stays in 0-1', () => {
    expect(valueNoise(3.3, 7.1, 5)).toBe(valueNoise(3.3, 7.1, 5))
    for (let i = 0; i < 200; i++) {
      const v = fbm(i * 3.7, i * 1.3, 40, 4, 2)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('frost on the window', () => {
  const { alpha, width, height } = windowMask()
  const field = frostField(alpha, width, height, 2)
  const at = (x: number, y: number) => field.cover[Math.floor(y / 2) * field.cols + Math.floor(x / 2)]!

  it('only on the lower panes', () => {
    for (let y = 0; y < 240; y += 6) for (let x = 0; x < width; x += 10) expect(at(x, y)).toBe(0)
  })

  it('never on the bars', () => {
    for (let y = 256; y < height; y += 4) expect(at(300, y)).toBe(0)
    for (let x = 0; x < width; x += 10) expect(at(x, 490)).toBe(0)
  })

  it('thickest along the sill, thinning upward, gone well before the crossbar', () => {
    for (const x of [100, 200, 420, 500]) {
      expect(at(x, 476)).toBeGreaterThan(0.5)
      expect(at(x, 476)).toBeGreaterThan(at(x, 420))
      expect(at(x, 300)).toBe(0)
    }
  })

  it('climbs higher up the sides than mid-pane', () => {
    let side = 0
    let middle = 0
    for (let y = 380; y < 478; y += 2) {
      side += at(14, y)
      middle += at(150, y)
    }
    expect(side).toBeGreaterThan(middle)
  })

  it('works out the same a few rows at a time', () => {
    const builder = frostBuilder(alpha, width, height, 2)
    let calls = 0
    while (!builder.next(3)) calls++
    expect(calls).toBeGreaterThan(10)
    expect(Array.from(builder.field.cover)).toEqual(Array.from(field.cover))
  })
})

describe('forming', () => {
  it('starts at the sill and climbs', () => {
    expect(formed(1, 0)).toBe(0)
    expect(formed(1, 0.3)).toBeGreaterThan(0.9) // along the sill, early
    expect(formed(0.2, 0.3)).toBe(0) // its top, not yet
    expect(formed(0.2, 1)).toBe(1)
  })

  it('grows steadily', () => {
    let previous = 0
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const v = formed(0.5, p)
      expect(v).toBeGreaterThanOrEqual(previous)
      previous = v
    }
  })
})
