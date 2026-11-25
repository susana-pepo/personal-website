import { useCallback, useEffect, useRef, useState } from 'react'
import { GLIMMERS, unfoundGlimmers, type GlimmerId } from '../../scene/glimmers'
import { FIRST_CUE_MS, QUIET_AFTER_MS, cueGap, nextHint } from '../../scene/roomCues'

type Tells = Record<GlimmerId, number>
const NONE = Object.fromEntries(GLIMMERS.map((g) => [g, 0])) as Tells
/** A turn that falls while the room must keep still tries again this soon. */
const RETRY_MS = 1500

interface Options {
  /** The room is moving (not paused, no page open). With reduced motion the hints still come, as fades. */
  moving: boolean
  /** The room's first look around and her greeting are over. */
  ready: boolean
  /** Something in the room is being pointed at or focused, or the piano is up close: keep still. */
  busy: boolean
}

/**
 * The glimmers' hints on one clock (src/scene/roomCues.ts), each in turn until it's found.
 *  - `tells`: a counter per glimmer that goes up when it should give its hint.
 *  - `tell(id)`: asks a glimmer for its hint now (when Susana mentions it).
 */
export function useRoomCues({ moving, ready, busy }: Options) {
  const [tells, setTells] = useState<Tells>(NONE)
  const tell = useCallback((id: GlimmerId) => setTells((t) => ({ ...t, [id]: t[id] + 1 })), [])
  const busyRef = useRef(busy)
  busyRef.current = busy
  // when the visitor last stopped pointing at something: the room keeps still a moment after
  const quietSince = useRef(Number.NEGATIVE_INFINITY)
  const wasBusy = useRef(busy)
  useEffect(() => {
    if (wasBusy.current && !busy) quietSince.current = performance.now()
    wasBusy.current = busy
  }, [busy])

  useEffect(() => {
    if (!moving || !ready) return
    let timer: number | undefined
    let lastHint: GlimmerId | null = null
    const turn = () => {
      if (document.hidden || busyRef.current || performance.now() - quietSince.current < QUIET_AFTER_MS) {
        timer = window.setTimeout(turn, RETRY_MS)
        return
      }
      const id = nextHint(unfoundGlimmers(), lastHint)
      if (!id) return // all found: the room is quiet
      lastHint = id
      tell(id)
      timer = window.setTimeout(turn, cueGap(unfoundGlimmers()))
    }
    timer = window.setTimeout(turn, FIRST_CUE_MS)
    return () => window.clearTimeout(timer)
  }, [moving, ready, tell])

  return { tells, tell }
}
