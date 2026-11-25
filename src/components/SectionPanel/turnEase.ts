import { cubicBezier, type Bezier } from './genie/geometry'

/** A CSS cubic-bezier's four numbers. */
export type Ease = Bezier

/**
 * A curve from a token as the page resolves it ("cubic-bezier(0.23, 1, 0.32, 1)"), as a function
 * of 0-1 → 0-1, or `fallback` when it isn't one. The page turn's effects run their own keyframes,
 * so they read the site's curves this way instead of keeping copies.
 */
export function bezierFromCss(value: string, fallback: Ease): (x: number) => number {
  return cubicBezier(parseBezier(value) ?? fallback)
}

export function parseBezier(value: string): Ease | null {
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(value.trim())
  if (!m) return null
  const v = m[1]!.split(',').map((s) => parseFloat(s))
  if (v.length !== 4 || v.some((n) => !Number.isFinite(n))) return null
  const [x1, y1, x2, y2] = v as [number, number, number, number]
  // x must stay within 0-1 for a curve that is a function of time, as in CSS.
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null
  return [x1, y1, x2, y2]
}
