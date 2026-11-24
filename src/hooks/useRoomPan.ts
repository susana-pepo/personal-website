import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { ROOM_PAN, panCentreAt, panScrollFor, type CoverFit } from '../scene/layout'

export interface RoomPan {
  /** Whether more of the room lies to the left (start) and to the right (end). */
  more: { start: boolean; end: boolean }
  /** Bring a stretch of the canvas (x from `left` to `right`) into view, if it isn't already. */
  reveal: (left: number, right: number) => void
}

const NONE = { start: false, end: false }

/**
 * The sideways pan of the room on a portrait phone (`pan` from useCoverFit; null elsewhere,
 * where this does nothing). The room opens centred on ROOM_PAN.startX, and keeps the same
 * point in the middle if the frame is resized. Reports which edges have more room beyond
 * them, for the edge fades.
 */
export function useRoomPan(frameRef: RefObject<HTMLElement | null>, pan: CoverFit | null, reducedMotion: boolean): RoomPan {
  const [more, setMore] = useState(NONE)
  // The canvas x in the middle of the frame: where the room opens, then wherever it was left.
  const centre = useRef<number>(ROOM_PAN.startX)

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame || !pan) {
      setMore(NONE)
      return
    }
    const max = () => Math.max(0, pan.width - frame.clientWidth)
    const edges = () => {
      const next = { start: frame.scrollLeft > 1, end: frame.scrollLeft < max() - 1 }
      setMore((current) => (current.start === next.start && current.end === next.end ? current : next))
    }
    frame.scrollLeft = panScrollFor(pan, frame.clientWidth, centre.current)
    edges()
    let frameId = 0
    const onScroll = () => {
      if (frameId) return
      frameId = requestAnimationFrame(() => {
        frameId = 0
        centre.current = panCentreAt(pan, frame.clientWidth, frame.scrollLeft)
        edges()
      })
    }
    frame.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      frame.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frameId)
    }
  }, [frameRef, pan])

  // The same frame without a pan (a phone turned on its side) shows the whole room from x 0.
  useEffect(() => {
    const frame = frameRef.current
    if (frame && !pan && frame.scrollLeft) frame.scrollLeft = 0
  }, [frameRef, pan])

  const reveal = useCallback(
    (left: number, right: number) => {
      const frame = frameRef.current
      if (!frame || !pan) return
      const width = frame.clientWidth
      const from = frame.scrollLeft / pan.scale
      const to = (frame.scrollLeft + width) / pan.scale
      if (left >= from && right <= to) return
      frame.scrollTo({ left: panScrollFor(pan, width, (left + right) / 2), behavior: reducedMotion ? 'auto' : 'smooth' })
    },
    [frameRef, pan, reducedMotion],
  )

  return { more, reveal }
}
