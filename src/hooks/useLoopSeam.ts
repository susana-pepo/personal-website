import { useEffect, type RefObject } from 'react'

type FrameMeta = { mediaTime: number }
type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: FrameMeta) => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

/**
 * Hide the jump where a looping clip wraps from its last frame to its first.
 *
 * Every presented frame near the end of the clip is copied to a canvas that
 * sits just above the video. When the video wraps, that canvas (still showing
 * the last frame) is revealed at once and then faded out, so the end dissolves
 * into the beginning instead of cutting. Only one video decodes; the canvas
 * costs one drawImage per frame during the final half-second of each loop.
 *
 * Needs requestVideoFrameCallback (Chrome, Edge, Safari 15.4+, Firefox 132+);
 * elsewhere the loop simply cuts as before.
 */
export function useLoopSeam(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  { fadeMs = 500, enabled = true }: { fadeMs?: number; enabled?: boolean } = {},
) {
  useEffect(() => {
    const video = videoRef.current as FrameVideo | null
    const canvas = canvasRef.current
    if (!enabled || !video || !canvas || typeof video.requestVideoFrameCallback !== 'function') return
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return

    let handle = 0
    let last = -1
    let captured = false
    let fadeTimer = 0

    const reveal = () => {
      window.clearTimeout(fadeTimer)
      canvas.style.transition = 'none'
      canvas.style.opacity = '1'
      // Next frame: let it dissolve into the restarted clip.
      requestAnimationFrame(() => {
        canvas.style.transition = `opacity ${fadeMs}ms ease-in-out`
        canvas.style.opacity = '0'
      })
      fadeTimer = window.setTimeout(() => (canvas.style.transition = 'none'), fadeMs + 50)
    }

    const step = (_now: number, meta: FrameMeta) => {
      const duration = video.duration
      const t = meta.mediaTime
      if (Number.isFinite(duration) && duration > 0) {
        if (t < last - duration / 2 && captured) reveal() // wrapped round
        // Capture the final stretch of the clip (in media seconds, whatever the playback rate).
        if (duration - t < ((fadeMs / 1000) * 0.6 + 0.1) * (video.playbackRate || 1)) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
          }
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          captured = true
        } else if (t < duration / 2) {
          captured = captured && t < 0.2 // keep the capture only across the wrap
        }
        last = t
      }
      handle = video.requestVideoFrameCallback!(step)
    }
    handle = video.requestVideoFrameCallback(step)

    return () => {
      video.cancelVideoFrameCallback?.(handle)
      window.clearTimeout(fadeTimer)
      canvas.style.opacity = '0'
    }
  }, [videoRef, canvasRef, fadeMs, enabled])
}
