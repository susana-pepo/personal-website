import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'
import { coverFit, roomFocus } from '../scene/layout'

/**
 * Size the scene box so the 1920×1080 canvas covers `frameRef` as one unit.
 * Everything inside the scene (video, overlays, outlines, tags) is positioned
 * in canvas percentages, so it all scales and crops together.
 *
 * The frame is wider than the canvas (ROOM_VIEW, 1.9:1), so the canvas fills
 * its width and a thin band above and below is hidden, split as ROOM_VIEW says
 * (see roomFocus). Returns `undefined` while the frame has the canvas's own
 * shape, so the CSS default of filling the frame applies.
 */
export function useCoverFit(frameRef: RefObject<HTMLElement | null>): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined)

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const update = () => {
      // Layout size, not getBoundingClientRect: that includes transforms (the
      // room's entrance zoom), which would leave the scene a little short.
      const width = frame.clientWidth
      const height = frame.clientHeight
      if (!width || !height) return
      const fit = coverFit(width, height, roomFocus(width, height))
      const exact = Math.abs(fit.width - width) < 0.5 && Math.abs(fit.height - height) < 0.5
      setStyle(
        exact
          ? undefined
          : { width: `${fit.width}px`, height: `${fit.height}px`, left: `${fit.left}px`, top: `${fit.top}px` },
      )
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [frameRef])

  return style
}
