import { useEffect, useRef, useState } from 'react'
import { GLIMMERS, unfoundGlimmers, type GlimmerId } from '../../scene/glimmers'
import { BREATH_MS, FIRST_CUE_MS, QUIET_AFTER_MS, cueGap, nextCue, type Cue } from '../../scene/roomCues'

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
  /** The section objects that may breathe now (none with reduced motion). */
  breathers: readonly string[]
}

/**
 * The room's cues on one clock (src/scene/roomCues.ts): glimmer hints and section breaths take
 * turns, so only one thing moves at a time.
 *  - `tells`: a counter per glimmer that goes up when it should give its hint (its component
 *    reacts to the change).
 *  - `breath`: the section object breathing right now (its halo swells and settles), or null.
 */
export function useRoomCues({ moving, ready, busy, breathers }: Options): { tells: Tells; breath: string | null } {
  const [tells, setTells] = useState<Tells>(NONE)
  const [breath, setBreath] = useState<string | null>(null)
  const busyRef = useRef(busy)
  busyRef.current = busy
  const breathersRef = useRef(breathers)
  breathersRef.current = breathers
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
    let breathTimer: number | undefined
    let last: Cue | null = null
    let lastHint: GlimmerId | null = null
    let lastBreath: string | null = null
    const waiting = () => ({ unfound: unfoundGlimmers(), breathers: breathersRef.current })

    const turn = () => {
      const still = document.hidden || busyRef.current || performance.now() - quietSince.current < QUIET_AFTER_MS
      if (still) {
        timer = window.setTimeout(turn, RETRY_MS)
        return
      }
      const cue = nextCue({ ...waiting(), last, lastHint, lastBreath }, Math.random())
      if (!cue) return // all found and opened: the room is quiet
      last = cue
      if (cue.kind === 'hint') {
        lastHint = cue.id
        setTells((t) => ({ ...t, [cue.id]: t[cue.id] + 1 }))
      } else {
        lastBreath = cue.id
        setBreath(cue.id)
        window.clearTimeout(breathTimer)
        breathTimer = window.setTimeout(() => setBreath(null), BREATH_MS)
      }
      timer = window.setTimeout(turn, cueGap(waiting(), Math.random()))
    }
    timer = window.setTimeout(turn, FIRST_CUE_MS)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(breathTimer)
      setBreath(null)
    }
  }, [moving, ready])

  return { tells, breath }
}
