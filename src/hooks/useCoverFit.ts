import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'
import { coverFit, panFit, roomFocus, type CoverFit } from '../scene/layout'

export interface RoomFit {
  /** The scene box's size and place, or undefined while the frame has the canvas's own shape. */
  style: CSSProperties | undefined
  /** Set while the frame pans sideways (a portrait phone): the canvas's size in it. */
  pan: CoverFit | null
}

const UNFIT: RoomFit = { style: undefined, pan: null }

/**
 * Size the scene box so the 1920×1080 canvas covers `frameRef` as one unit.
 * Everything inside the scene (video, overlays, outlines, tags) is positioned
 * in canvas percentages, so it all scales and crops together.
 *
 * The frame is wider than the canvas (ROOM_VIEW, 1.9:1), so the canvas fills
 * its width and a thin band above and below is hidden, split as ROOM_VIEW says
 * (see roomFocus). The style is `undefined` while the frame has the canvas's
 * own shape, so the CSS default of filling the frame applies.
 *
 * On a portrait phone the frame is taller than that and scrolls sideways
 * (App.css): the canvas then fills its height from the left edge, and the
 * frame pans across it (useRoomPan).
 */
export function useCoverFit(frameRef: RefObject<HTMLElement | null>): RoomFit {
  const [fit, setFit] = useState<RoomFit>(UNFIT)

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const update = () => {
      // Layout size, not getBoundingClientRect: that includes transforms (the
      // room's entrance zoom), which would leave the scene a little short.
      const width = frame.clientWidth
      const height = frame.clientHeight
      if (!width || !height) return
      const overflowX = getComputedStyle(frame).overflowX
      const pans = overflowX === 'auto' || overflowX === 'scroll'
      const fit = pans ? panFit(width, height) : coverFit(width, height, roomFocus(width, height))
      const exact = Math.abs(fit.width - width) < 0.5 && Math.abs(fit.height - height) < 0.5
      const style = exact
        ? undefined
        : { width: `${fit.width}px`, height: `${fit.height}px`, left: `${fit.left}px`, top: `${fit.top}px` }
      setFit((current) =>
        current.style?.width === style?.width &&
        current.style?.height === style?.height &&
        current.style?.left === style?.left &&
        current.style?.top === style?.top &&
        (current.pan !== null) === (pans && !exact)
          ? current
          : { style, pan: pans && !exact ? fit : null },
      )
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [frameRef])

  return fit
}
