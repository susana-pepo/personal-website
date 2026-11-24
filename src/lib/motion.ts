/** The visitor has asked for less motion. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Right now, outside React (in event handlers and timers). In components, use usePrefersReducedMotion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false)
}

/** A gentle ease in and out (0-1 → 0-1), the JS twin of cubic-bezier(0.45, 0, 0.55, 1). */
export function easeInOut(k: number): number {
  const c = Math.min(1, Math.max(0, k))
  return 0.5 - 0.5 * Math.cos(Math.PI * c)
}
