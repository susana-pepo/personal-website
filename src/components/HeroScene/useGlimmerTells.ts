import { useEffect, useRef, useState } from 'react'
import { GLIMMERS, TELL_CYCLE_MS, tellStarts, unfoundGlimmers, type GlimmerId } from '../../scene/glimmers'

type Tells = Record<GlimmerId, number>
const NONE = Object.fromEntries(GLIMMERS.map((g) => [g, 0])) as Tells

interface Options {
  /** The room is moving (not paused, no page open). With reduced motion the hints still come, as fades. */
  moving: boolean
  /** The room's first look around and her greeting are over. */
  ready: boolean
  /** Something in the room is being pointed at or focused: no hint then. */
  busy: boolean
}

/**
 * Asks the room's unfound glimmers for their hints (src/scene/glimmers.ts): each gets a counter
 * that goes up when it should give one, once a cycle, spread across the cycle so only one moves
 * at a time. Its component reacts to the change. A glimmer that is found stops; a turn that
 * falls while busy or hidden is skipped, not queued.
 */
export function useGlimmerTells({ moving, ready, busy }: Options): Tells {
  const [tells, setTells] = useState<Tells>(NONE)
  const busyRef = useRef(busy)
  busyRef.current = busy

  useEffect(() => {
    if (!moving || !ready) return
    const timers = new Map<GlimmerId, number>()
    for (const { id, at } of tellStarts(unfoundGlimmers())) {
      const turn = () => {
        if (!unfoundGlimmers().includes(id)) return // found: this one is quiet for good
        if (!document.hidden && !busyRef.current) setTells((t) => ({ ...t, [id]: t[id] + 1 }))
        timers.set(id, window.setTimeout(turn, TELL_CYCLE_MS))
      }
      timers.set(id, window.setTimeout(turn, at))
    }
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [moving, ready])

  return tells
}
