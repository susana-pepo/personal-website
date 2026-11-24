import { useEffect, useRef, useState } from 'react'
import { GLIMMERS, firstLookTells, nextTell, tellDelay, unfoundGlimmers, type GlimmerId } from '../../scene/glimmers'

type Tells = Record<GlimmerId, number>
const NONE = Object.fromEntries(GLIMMERS.map((g) => [g, 0])) as Tells

interface Options {
  /** The room is moving (not paused, no page open, motion allowed). */
  moving: boolean
  /** The room's first look around has just ended. */
  firstLookDone: boolean
  /** Something in the room is being pointed at or focused: no tell then. */
  busy: boolean
}

/**
 * Asks the room's unfound glimmers for their tells (src/scene/glimmers.ts): each gets a counter
 * that goes up when it should give one. Its component reacts to the change.
 */
export function useGlimmerTells({ moving, firstLookDone, busy }: Options): Tells {
  const [tells, setTells] = useState<Tells>(NONE)
  const busyRef = useRef(busy)
  busyRef.current = busy
  const last = useRef<GlimmerId | null>(null)
  const told = (id: GlimmerId) => {
    last.current = id
    setTells((t) => ({ ...t, [id]: t[id] + 1 }))
  }

  // The first look: each unfound glimmer once, in turn, right after the halos have been round.
  const firstLookGiven = useRef(false)
  useEffect(() => {
    if (!firstLookDone || !moving || firstLookGiven.current) return
    firstLookGiven.current = true
    const timers = firstLookTells(unfoundGlimmers()).map(({ id, at }) =>
      window.setTimeout(() => {
        if (unfoundGlimmers().includes(id)) told(id)
      }, at),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [firstLookDone, moving])

  // Then one at a time, every 12-20 s, while any is unfound.
  useEffect(() => {
    if (!moving) return
    let timer: number | undefined
    const schedule = () => {
      timer = window.setTimeout(() => {
        const id = nextTell(unfoundGlimmers(), last.current)
        if (id === null) return // all found: the room is quiet again
        if (!document.hidden && !busyRef.current) told(id)
        schedule()
      }, tellDelay(Math.random()))
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [moving])

  return tells
}
