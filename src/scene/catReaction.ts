/**
 * The cat's tiny state machine: idle → petting → idle.
 * Kept free of React and the DOM so it can be tested on its own.
 */

export type CatPhase = 'idle' | 'petting'
export type CatEvent = 'pet' | 'finished'

/** A pet while a reaction is already playing is ignored, so it never stacks or loops. */
export function catReducer(phase: CatPhase, event: CatEvent): CatPhase {
  if (event === 'finished') return 'idle'
  return phase === 'idle' ? 'petting' : phase
}

/** Whether a new pet should start a reaction right now. */
export const acceptsPet = (phase: CatPhase) => phase === 'idle'

/**
 * How the cat reacts:
 * - `video`: the transparent reaction clip plays once (normal case);
 * - `css`: a 1.7 s, 3-pixel stir of the still picture, when alpha video isn't available;
 * - `still`: no movement at all (reduced motion, or the room paused), just a whispered reply.
 */
export type PetStyle = 'video' | 'css' | 'still'

export function choosePetStyle(options: {
  motionAllowed: boolean
  idleVideoShowing: boolean
  petVideoUsable: boolean
}): PetStyle {
  if (!options.motionAllowed) return 'still'
  if (options.idleVideoShowing && options.petVideoUsable) return 'video'
  return 'css'
}

/** Lengths of the reactions that don't come from a video file. */
export const CSS_STIR_MS = 1700
export const STILL_REPLY_MS = 3500
/** Extra time allowed after a clip's own length before the reaction is ended regardless. */
export const VIDEO_GRACE_MS = 1500

/**
 * Now and then, with nobody touching it, the sleeping cat lets out a couple of
 * z's on its own. The first comes a little while after the room opens, then
 * one every 30-60 s, never on a fixed beat. `random` is 0-1 (Math.random()).
 */
export const FIRST_DREAM_MS: readonly [number, number] = [14_000, 24_000]
export const DREAM_EVERY_MS: readonly [number, number] = [30_000, 60_000]
export function nextDreamDelay(first: boolean, random: number): number {
  const [min, max] = first ? FIRST_DREAM_MS : DREAM_EVERY_MS
  return Math.round(min + Math.min(1, Math.max(0, random)) * (max - min))
}
/** How long a dream's z's take to drift up and fade (the longest one, with its delay). */
export const DREAM_MS = 4600

/** One of the cat's clips (scripts/build-cat.py): played exactly as exported, plus a bridge home. */
export interface CatClip {
  name: string
  src: string
  /** Its full length, bridge included, in ms. */
  ms: number
}

/**
 * What a hover brings: the cat either stays asleep (just its purr and z's: null) or plays
 * one of its reaction clips that has arrived. Never the same answer twice running.
 * `last` is the previous answer's name ('asleep' for staying asleep); `random` is 0-1.
 */
export function nextReaction(ready: readonly CatClip[], last: string | null, random: number): CatClip | null {
  const options: (CatClip | null)[] = [null, ...ready]
  const pool = options.length > 1 ? options.filter((c) => (c?.name ?? 'asleep') !== last) : options
  return pool[Math.min(pool.length - 1, Math.floor(Math.max(0, random) * pool.length))] ?? null
}

/**
 * While it sleeps, the peaceful sleeping clip is the base, and its variation (the slow
 * sweep of its tail) comes often: after one sleeping turn or two, at random (so every
 * 13-19 s or so, never on a beat), never twice running, and always right after a reaction
 * to a hover (CatOverlay asks for it then by passing 2).
 */
export function playVariation(sleepingTurnsSince: number, random: number): boolean {
  if (sleepingTurnsSince < 1) return false
  if (sleepingTurnsSince >= 2) return true
  return random < 0.5
}

/** A hover can come at any moment of the sleeping loop: the reaction dissolves in over this long. */
export const DISSOLVE_MS = 260
