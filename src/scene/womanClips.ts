import { woman } from './scene-layout.json'

/**
 * The woman's clips: each one her animation exactly as exported, ending with a short
 * bridge back to the pose they all start from (scripts/build-woman.py). The page plays
 * them one after another, in a calm random order, with a short rest at that pose between
 * them: she writes, pauses, writes on, now and then turns a page.
 * Kept free of React and the DOM so it can be tested on its own.
 */

export interface WomanClip {
  name: string
  src: string
  /** Its full length, bridge included, in ms. */
  ms: number
}

export const WOMAN_CLIPS: readonly WomanClip[] = woman.clips

/** Her breath at rest (from the home pose and back), played once or twice between clips. */
export const WOMAN_BREATH: WomanClip = woman.breath

/** The clip every visit starts with (the still is its first frame). */
export const HOME_CLIP = WOMAN_CLIPS[0]!

/** How often each clip is picked, relative to the others (a page turn is the rarest). */
export const CLIP_WEIGHTS: Readonly<Record<string, number>> = { writing: 0.45, calm: 0.35, page: 0.2 }

/**
 * The next clip, from those ready to play. `recent` is what played last (most recent
 * last). A page is never turned twice running, and no clip plays three times running
 * when another is ready. `random` is 0-1 (Math.random()).
 */
export function nextClip(ready: readonly WomanClip[], recent: readonly string[], random: number): WomanClip {
  const last = recent.at(-1)
  const twice = recent.length >= 2 && recent.at(-2) === last ? last : undefined
  let pool = ready.filter((c) => !(c.name === 'page' && last === 'page') && c.name !== twice)
  if (pool.length === 0) pool = ready.filter((c) => !(c.name === 'page' && last === 'page'))
  if (pool.length === 0) pool = [...ready]
  const weight = (c: WomanClip) => CLIP_WEIGHTS[c.name] ?? 0.3
  const total = pool.reduce((sum, c) => sum + weight(c), 0)
  let at = Math.min(Math.max(random, 0), 0.999999) * total
  for (const c of pool) {
    at -= weight(c)
    if (at < 0) return c
  }
  return pool[pool.length - 1]!
}

/**
 * The rest at her home pose after a clip: she settles for a moment, takes one or two calm
 * breaths (always two after turning a page: she reads), and settles again before the next.
 * `random` is 0-1.
 */
export function restAfter(clip: string, random: number): { breaths: 1 | 2; settleMs: number; afterMs: number } {
  const r = Math.min(Math.max(random, 0), 1)
  return {
    breaths: clip === 'page' || r >= 0.55 ? 2 : 1,
    settleMs: Math.round(250 + r * 350),
    afterMs: Math.round(150 + (1 - r) * 250),
  }
}

/** Without her breath (not arrived yet): a short still rest instead, never the same twice. */
export function stillRest(clip: string, random: number): number {
  const [min, max] = clip === 'page' ? [1500, 2800] : [600, 1900]
  const r = Math.min(Math.max(random, 0), 1)
  return Math.round(min + r * r * (max - min))
}
