import { useEffect, type RefObject } from 'react'

type FrameMeta = { mediaTime: number }
type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: FrameMeta) => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

/**
 * Smooth slowed-down playback by blending consecutive frames.
 *
 * A clip slowed to 0.6× shows each of its frames for ~70 ms, which can read
 * as slightly steppy. Here every newly presented frame is covered at once by
 * the previous frame (held on a canvas), and that cover fades out over one
 * frame interval, so each frame dissolves into the next, the way an editor's
 * frame blending smooths slow motion. Two canvases take turns: one fades
 * while the other receives the current frame for the next step.
 *
 * The fade is driven on every screen refresh (one opacity write per frame),
 * so it never waits on the browser to start an animation.
 * Needs requestVideoFrameCallback; elsewhere playback is simply un-blended.
 */
export function useFrameBlend(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRefs: readonly [RefObject<HTMLCanvasElement | null>, RefObject<HTMLCanvasElement | null>],
  { enabled = true, frameRate = 24 }: { enabled?: boolean; frameRate?: number } = {},
) {
  useEffect(() => {
    const video = videoRef.current as FrameVideo | null
    const canvases = canvasRefs.map((ref) => ref.current)
    if (!enabled || !video || canvases.some((c) => !c) || typeof video.requestVideoFrameCallback !== 'function') return
    const pair = canvases as [HTMLCanvasElement, HTMLCanvasElement]
    const contexts = pair.map((c) => c.getContext('2d', { alpha: false }))
    if (contexts.some((c) => !c)) return

    let frameHandle = 0
    let rafHandle = 0
    let back = 0 // index of the canvas that holds the previous frame
    let hasPrevious = false
    let lastMediaTime = -1
    let fading: HTMLCanvasElement | null = null
    let fadeStart = 0
    let fadeLength = 0

    const fade = (now: number) => {
      rafHandle = 0
      if (!fading) return
      const progress = Math.min(1, (now - fadeStart) / fadeLength)
      fading.style.opacity = String(1 - progress)
      if (progress < 1) rafHandle = requestAnimationFrame(fade)
      else fading = null
    }

    const step = (now: number, meta: FrameMeta) => {
      const rate = video.playbackRate || 1
      const interval = 1000 / (frameRate * rate)
      const jumped = lastMediaTime >= 0 && Math.abs(meta.mediaTime - lastMediaTime) > 3 / frameRate // seek or loop wrap
      const holder = pair[back]!
      const next = 1 - back
      const canvas = pair[next]!

      // The canvas about to receive this frame must be out of sight first.
      if (fading === canvas) fading = null
      canvas.style.opacity = '0'

      if (hasPrevious && !jumped && !video.paused) {
        // Previous frame on top, dissolving into the one just presented underneath.
        if (fading && fading !== holder) fading.style.opacity = '0'
        holder.style.opacity = '1'
        fading = holder
        fadeStart = now
        fadeLength = interval * 0.95
        if (!rafHandle) rafHandle = requestAnimationFrame(fade)
      } else {
        holder.style.opacity = '0'
      }

      // Hold the current frame on the other canvas, for the next step.
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      contexts[next]!.drawImage(video, 0, 0, canvas.width, canvas.height)
      back = next
      hasPrevious = true
      lastMediaTime = meta.mediaTime
      frameHandle = video.requestVideoFrameCallback!(step)
    }
    frameHandle = video.requestVideoFrameCallback(step)

    return () => {
      video.cancelVideoFrameCallback?.(frameHandle)
      cancelAnimationFrame(rafHandle)
      for (const c of pair) c.style.opacity = '0'
    }
  }, [videoRef, canvasRefs, enabled, frameRate])
}
