import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { clipFileUrl, clipFormat, videoAlphaWorks } from '../../../scene/clipFiles'

interface LoopClipProps {
  /** The clip's name: its old animated WebP path (no longer served); its videos sit beside it (scripts/clip_video.py). */
  src: string
  /** Shown instead where video can't play (none: show nothing, as when a still sits underneath already). */
  still?: string
  /** A transparent clip (WebM, or HEVC on Safari), or an opaque one (one H.264 MP4 for every browser). */
  alpha: boolean
  /** The clip's frame size in pixels: its video is padded to an even size on the right and at the bottom. */
  size: readonly [number, number]
  /** Once its first frame is on screen and it's playing. */
  onArrived?: () => void
  style?: CSSProperties
}

const canPlayMp4 = () =>
  typeof document !== 'undefined' && document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"') !== ''

/** How close to its end (s) a turn hands over to the other copy: about two frames at 15-30 fps. */
const HANDOVER_S = 0.09

/**
 * A clip that loops for as long as it's on screen (the window's views, the coffee's steam), as
 * video: decoded by the graphics chip, it always holds its last frame (see src/scene/clipFiles.ts).
 *
 * `<video loop>` isn't reliably gapless (Firefox and Safari can hitch at the seam), so two copies
 * take turns: as one nears its end, the other, waiting on its first frame, starts and is shown the
 * moment its first frame is up; the first goes back to the start and waits. Browsers without
 * requestVideoFrameCallback use the plain loop. Where video can't play at all (or a transparent
 * one comes out opaque), the still picture shows instead.
 */
export function LoopClip({ src, still, alpha, size, onArrived, style }: LoopClipProps) {
  const [failed, setFailed] = useState(false)
  const format = alpha ? clipFormat() : canPlayMp4() ? 'mp4' : 'none'
  const a = useRef<HTMLVideoElement>(null)
  const b = useRef<HTMLVideoElement>(null)
  const arrivedRef = useRef(onArrived)
  arrivedRef.current = onArrived
  const url = format === 'mp4' ? src.replace(/\.webp$/, '.mp4') : format === 'none' ? '' : clipFileUrl(src, format)

  useEffect(() => {
    const first = a.current
    const second = b.current
    if (!first || !second || !url) return
    let stopped = false
    for (const v of [first, second]) {
      v.muted = true // as a property and an attribute before playing: Safari on iOS only autoplays it then
      v.setAttribute('muted', '')
    }
    // the waiting copy is hidden by its own attribute (React owns the style): .loop-clip[data-waiting]
    const shown = (v: HTMLVideoElement, on: boolean) => (on ? v.removeAttribute('data-waiting') : v.setAttribute('data-waiting', ''))
    const start = first.play()
    void start.catch(() => {}) // e.g. iOS Low Power Mode: it rests on its first frame
    let arrived = false
    const onPlaying = () => {
      if (arrived) return
      arrived = true
      arrivedRef.current?.()
    }
    first.addEventListener('playing', onPlaying)
    if (typeof (first as { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback !== 'function') {
      first.loop = true
      // nobody sees it while the tab is hidden: it rests (saves battery), and carries on after
      const onHidden = () => (document.hidden ? first.pause() : void first.play().catch(() => {}))
      document.addEventListener('visibilitychange', onHidden)
      return () => {
        stopped = true
        first.removeEventListener('playing', onPlaying)
        document.removeEventListener('visibilitychange', onHidden)
      }
    }
    let active = first
    let waiting = second
    let handing = false
    // Watches the playing copy frame by frame; near its end, the waiting copy takes over.
    const watch = () => {
      active.requestVideoFrameCallback((_, frame) => {
        if (stopped) return
        const left = active.duration - frame.mediaTime
        if (Number.isFinite(left) && left <= HANDOVER_S && waiting.readyState >= 2) {
          handing = true
          const next = waiting
          const done = active
          next.requestVideoFrameCallback(() => {
            if (stopped) return
            // its first frame is up: show it, and send the other back to the start to wait
            shown(next, true)
            shown(done, false)
            done.pause()
            done.currentTime = 0
            active = next
            waiting = done
            handing = false
            watch()
          })
          void next.play().catch(() => {
            handing = false
            watch() // it wouldn't start: keep watching this one (its end restarts it)
          })
          return
        }
        watch()
      })
    }
    // if a turn ever ends before the other copy is ready, it simply starts again
    const onEnded = (e: Event) => {
      const v = e.currentTarget as HTMLVideoElement
      if (v === active && !handing) {
        v.currentTime = 0
        void v.play().catch(() => {})
      }
    }
    first.addEventListener('ended', onEnded)
    second.addEventListener('ended', onEnded)
    // Nobody sees it while the tab is hidden: both copies rest (saves battery), and it carries on
    // where it was after (mid-handover, the other copy too, so the handover completes).
    const onHidden = () => {
      if (document.hidden) {
        first.pause()
        second.pause()
        return
      }
      void active.play().catch(() => {})
      if (handing) void waiting.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onHidden)
    watch()
    return () => {
      stopped = true
      first.removeEventListener('playing', onPlaying)
      first.removeEventListener('ended', onEnded)
      second.removeEventListener('ended', onEnded)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [url])

  if (failed || format === 'none') {
    return still ? <img src={still} alt="" decoding="async" draggable={false} style={style} /> : null
  }
  const [w, h] = size
  const [W, H] = [w + (w % 2), h + (h % 2)]
  // the padding falls just outside the box: the picture keeps its own pixels and place
  const box: CSSProperties = { ...style, width: `${(100 * W) / w}%`, height: `${(100 * H) / h}%`, objectFit: 'fill', objectPosition: '0 0' }
  const copy = (ref: typeof a, primary: boolean) => (
    <video
      ref={ref}
      className="loop-clip"
      // the second copy starts hidden (from its very first frame, never doubling the first);
      // from then on the handover moves the attribute itself
      data-waiting={primary ? undefined : ''}
      style={box}
      src={url}
      autoPlay={primary}
      muted
      playsInline
      disablePictureInPicture
      preload="auto"
      aria-hidden="true"
      onLoadedData={primary && alpha ? (e) => !videoAlphaWorks(e.currentTarget) && setFailed(true) : undefined}
      onError={() => setFailed(true)}
    />
  )
  return (
    <>
      {copy(a, true)}
      {copy(b, false)}
    </>
  )
}
