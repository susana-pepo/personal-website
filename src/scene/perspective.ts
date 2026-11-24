/** A point as [x, y]. */
export type Pt = readonly [number, number]

/**
 * The CSS `matrix3d()` that maps a w × h element (with `transform-origin: 0 0`)
 * onto any four-cornered shape: top-left, top-right, bottom-right, bottom-left,
 * in the element's parent's pixels. Used to lay a flat element onto a surface
 * painted in perspective, like the laptop's screen. (Heckbert's square-to-quad
 * projective mapping, scaled to the element's size.)
 */
export function quadMatrix(w: number, h: number, [p0, p1, p2, p3]: readonly [Pt, Pt, Pt, Pt]): string {
  const [x0, y0] = p0
  const [x1, y1] = p1
  const [x2, y2] = p2
  const [x3, y3] = p3
  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const dy3 = y0 - y1 + y2 - y3
  const den = dx1 * dy2 - dx2 * dy1
  const g = den === 0 ? 0 : (dx3 * dy2 - dx2 * dy3) / den
  const k = den === 0 ? 0 : (dx1 * dy3 - dx3 * dy1) / den
  const a = x1 - x0 + g * x1
  const b = x3 - x0 + k * x3
  const d = y1 - y0 + g * y1
  const e = y3 - y0 + k * y3
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1]
  return `matrix3d(${m.map((v) => +v.toFixed(8)).join(',')})`
}

/** Where a point of the w × h element lands under `quadMatrix` (for tests). */
export function projectPoint(w: number, h: number, quad: readonly [Pt, Pt, Pt, Pt], [px, py]: Pt): Pt {
  const m = quadMatrix(w, h, quad).slice(9, -1).split(',').map(Number)
  const X = m[0]! * px + m[4]! * py + m[12]!
  const Y = m[1]! * px + m[5]! * py + m[13]!
  const W = m[3]! * px + m[7]! * py + m[15]!
  return [X / W, Y / W]
}
