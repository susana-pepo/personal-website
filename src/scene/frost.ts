/*
 * Frost on the lower panes of the window while it snows: fine, feathery
 * crystals that grow from the bottom edge of each pane, thickest along the sill
 * and up into the corners, thinning upward into wisps, with the view softening
 * behind them. This file works out, once, where the frost lies and how dense
 * it is, from the glass mask; FrostLayer draws it. No DOM here.
 */

/** Smooth, repeatable noise in [0, 1): a hashed lattice, eased between points. */
function lattice(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const tx = x - ix
  const ty = y - iy
  const sx = tx * tx * (3 - 2 * tx)
  const sy = ty * ty * (3 - 2 * ty)
  const a = lattice(ix, iy, seed)
  const b = lattice(ix + 1, iy, seed)
  const c = lattice(ix, iy + 1, seed)
  const d = lattice(ix + 1, iy + 1, seed)
  const top = a + (b - a) * sx
  const bottom = c + (d - c) * sx
  return top + (bottom - top) * sy
}

/** Layered noise: `cell` is the size of the largest features, in px. */
export function fbm(x: number, y: number, cell: number, octaves: number, seed: number): number {
  let sum = 0
  let amp = 1
  let total = 0
  let size = cell
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x / size, y / size, seed + o * 101)
    total += amp
    amp *= 0.5
    size /= 2
  }
  return sum / total
}

/** Thin bright veins (ridges of the noise), stretched along a direction: the frost's feathers. */
function feathers(x: number, y: number, angleDeg: number, seed: number): number {
  const a = (angleDeg * Math.PI) / 180
  const u = x * Math.cos(a) + y * Math.sin(a)
  const v = -x * Math.sin(a) + y * Math.cos(a)
  const n = fbm(u * 0.35, v, 10, 3, seed)
  const ridge = 1 - Math.abs(2 * n - 1)
  return ridge * ridge * ridge
}

/** Where the frost lies, at the mask's resolution divided by `step`. */
export interface FrostField {
  cols: number
  rows: number
  step: number
  /** 0-1: how frosted the glass is here (1 along the sill) */
  cover: Float32Array
  /** 0-1: how bright the crystals are here */
  crystals: Float32Array
  /** 0-1: 1 at the bottom of the pane, 0 at the top of the frost: the order it forms in */
  rise: Float32Array
  /** 0-1: rare points where a crystal catches the light */
  glint: Float32Array
}

/** The highest the frost can reach above a pane's bottom (px): rows above it are skipped. */
/** How tall the frost grows, as a share of a pane's lower part (1 = the original, slighter frost). */
export const FROST_HEIGHT = 1.45
const MAX_REACH = (26 + 40 + 52 + 12) * FROST_HEIGHT

/**
 * Works out the frost from the glass mask's opacity (`alpha`, `width` × `height`,
 * row-major, 0-255). Only the lower row of panes frosts: those below the last
 * bar that runs across the window above the sill.
 */
export function frostField(alpha: ArrayLike<number>, width: number, height: number, step = 2): FrostField {
  const builder = frostBuilder(alpha, width, height, step)
  while (!builder.next(Infinity));
  return builder.field
}

/**
 * The same, a few rows at a time, so a page can work it out between frames:
 * call `next(rows)` until it returns true; `field` fills in as it goes.
 */
export function frostBuilder(alpha: ArrayLike<number>, width: number, height: number, step = 2) {
  const glass = (x: number, y: number) => (alpha[Math.min(height - 1, y) * width + Math.min(width - 1, x)] ?? 0) > 128

  // The crossbar: the lowest row, in the window's lower half, with almost no glass, above the sill.
  const rowGlass = (y: number) => {
    let n = 0
    for (let x = 0; x < width; x += 4) if (glass(x, y)) n++
    return n / Math.ceil(width / 4)
  }
  let sill = height - 1
  while (sill > 0 && rowGlass(sill) < 0.3) sill--
  let crossbar = -1
  for (let y = sill; y > height / 3; y--) {
    if (rowGlass(y) < 0.15) {
      crossbar = y
      break
    }
  }
  const lowerTop = crossbar + 1

  const cols = Math.ceil(width / step)
  const rows = Math.ceil(height / step)
  const cover = new Float32Array(cols * rows)
  const crystals = new Float32Array(cols * rows)
  const rise = new Float32Array(cols * rows)
  const glint = new Float32Array(cols * rows)

  // Each column's pane bottom, and each pixel's distance to its pane's sides.
  const bottom = new Int32Array(cols)
  for (let c = 0; c < cols; c++) {
    const x = c * step
    let y = height - 1
    while (y > lowerTop && !glass(x, y)) y--
    bottom[c] = y
  }

  const deepest = Math.max(...bottom)
  let r = Math.max(0, Math.floor((lowerTop) / step))
  const field: FrostField = { cols, rows, step, cover, crystals, rise, glint }
  const row = (r: number) => {
    const y = r * step
    if (y < lowerTop || y < deepest - MAX_REACH - 40) return
    // distance to the nearest bar along this row
    const side = new Float32Array(cols).fill(9999)
    let last = -9999
    for (let c = 0; c < cols; c++) {
      if (!glass(c * step, y)) last = c * step
      side[c] = c * step - last
    }
    last = 99999
    for (let c = cols - 1; c >= 0; c--) {
      if (!glass(c * step, y)) last = c * step
      side[c] = Math.min(side[c]!, last - c * step)
    }
    for (let c = 0; c < cols; c++) {
      const x = c * step
      if (!glass(x, y)) continue
      const i = r * cols + c
      const above = bottom[c]! - y // height above the pane's bottom
      if (above < 0 || above > MAX_REACH) continue
      const coarse = fbm(x, y, 90, 4, 1)
      let reach = 26 + 40 * coarse * coarse // how far up it creeps: uneven
      reach += 52 * Math.exp(-side[c]! / 18) // further up the sides, most in the corners
      reach *= FROST_HEIGHT
      const wisp = fbm(x, y, 12, 3, 3) // a ragged, wispy front
      const g = Math.min(1, Math.max(0, 1 - above / Math.max(4, reach + 22 * (wisp - 0.5))))
      const cov = Math.pow(g, 1.4)
      if (cov <= 0) continue
      const feather = Math.max(feathers(x, y, 62, 11), feathers(x, y, 118, 21))
      const grain = fbm(x, y, 2.2, 2, 31)
      cover[i] = cov
      crystals[i] = Math.min(1, cov * (0.15 + 0.7 * feather + 0.15 * grain))
      rise[i] = g
      if (cov > 0.35 && feather > 0.45 && lattice(c, r, 77) < 0.016) glint[i] = 0.6 + 0.4 * lattice(c, r, 78)
    }
  }
  return {
    field,
    /** Works out up to `count` more rows; true once the whole field is done. */
    next(count: number): boolean {
      for (let n = 0; n < count && r < rows; n++, r++) row(r)
      return r >= rows
    },
  }
}

/** How much of the frost has formed (0-1) at a point that forms at `rise`, as it grows from the sill up. */
export function formed(rise: number, progress: number): number {
  if (progress >= 1) return 1
  if (progress <= 0) return 0
  const front = 1 - progress // the frost's growing edge, from 1 (the sill) to 0 (its top)
  const t = (rise - front + 0.12) / 0.24
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}
