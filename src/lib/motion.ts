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

/**
 * A quick start that settles softly (0-1 → 0-1): a quintic ease-out, the JS twin of the
 * site's --ease-out, cubic-bezier(0.23, 1, 0.32, 1), for things that should answer at once.
 */
export function easeOut(k: number): number {
  const c = Math.min(1, Math.max(0, k))
  return 1 - Math.pow(1 - c, 5)
}

/*
 * Timings live in CSS (tokens.css and each component's stylesheet). JS that has to wait
 * for a motion reads it from the computed style instead of keeping its own copy, so a
 * change in the stylesheet, or the shorter reduced-motion values, reach the timers too.
 * Each reader takes a fallback for when there is no style to read (tests, no element).
 */

/** A CSS time such as "460ms" or "0.46s" in ms, or `fallback` when it isn't one. */
export function cssTimeMs(value: string, fallback: number): number {
  const v = value.trim()
  const n = parseFloat(v)
  if (Number.isNaN(n)) return fallback
  return v.endsWith('ms') ? n : v.endsWith('s') ? n * 1000 : fallback
}

/** A token as the page resolves it, such as --ease-drawer from tokens.css, or `fallback`. */
export function cssToken(name: string, fallback: string, el?: Element | null): string {
  const target = el ?? (typeof document === 'undefined' ? null : document.documentElement)
  if (!target || typeof getComputedStyle === 'undefined') return fallback
  return getComputedStyle(target).getPropertyValue(name).trim() || fallback
}

const timeList = (list: string) => list.split(',').map((t) => Math.max(0, cssTimeMs(t, 0)))
/** A shorter list of times repeats to cover every property or animation, as CSS does. */
const nth = (list: number[], i: number) => list[i % list.length] ?? 0

/**
 * How long `property` takes to transition on `el` right now, delay included: 0 when it
 * doesn't transition (as with `transition: none` under reduced motion). Read it after the
 * state that starts the transition has been committed, since open and closed can differ.
 */
export function transitionMs(el: Element | null | undefined, property: string, fallback: number): number {
  if (!el || typeof getComputedStyle === 'undefined') return fallback
  const style = getComputedStyle(el)
  if (!style.transitionProperty) return fallback
  const durations = timeList(style.transitionDuration)
  const delays = timeList(style.transitionDelay)
  let ms = 0
  // The last entry that names the property wins, as in CSS.
  style.transitionProperty.split(',').forEach((name, i) => {
    const p = name.trim()
    if (p === property || p === 'all') ms = nth(durations, i) + nth(delays, i)
  })
  return ms
}

/** When the one-shot animations on `el` have all finished, in ms from their start, delays included. */
export function animationMs(el: Element | null | undefined, fallback: number): number {
  if (!el || typeof getComputedStyle === 'undefined') return fallback
  const style = getComputedStyle(el)
  if (!style.animationName) return fallback
  const durations = timeList(style.animationDuration)
  const delays = timeList(style.animationDelay)
  let ms = 0
  style.animationName.split(',').forEach((name, i) => {
    if (name.trim() !== 'none') ms = Math.max(ms, nth(durations, i) + nth(delays, i))
  })
  return ms
}
