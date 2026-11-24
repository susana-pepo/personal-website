import { useState, type CSSProperties } from 'react'
import { clipFormat, clipFileUrl, videoAlphaWorks } from '../../../scene/clipFiles'

interface LoopClipProps {
  /** The clip's animated WebP (the fallback); its videos sit beside it (scripts/clip_video.py). */
  src: string
  /** A transparent clip (WebM or Safari's HEVC), or an opaque one (one H.264 MP4 for every browser). */
  alpha: boolean
  /** The clip's frame size in pixels: its video is padded to an even size on the right and at the bottom. */
  size: readonly [number, number]
  /** Once its first frame is on screen and it's playing. */
  onArrived?: () => void
  style?: CSSProperties
}

const canPlayMp4 = () =>
  typeof document !== 'undefined' && document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"') !== ''

/**
 * A clip that loops for as long as it's on screen (the window's views, the coffee's steam), as
 * video where the browser can show it, else as its animated WebP. Video is decoded by the
 * graphics chip and always holds its last frame, where a large animated picture can blink out
 * for a frame (see src/scene/clipFiles.ts).
 */
export function LoopClip({ src, alpha, size, onArrived, style }: LoopClipProps) {
  const [failed, setFailed] = useState(false)
  const format = alpha ? clipFormat() : canPlayMp4() ? 'mp4' : 'webp'

  if (failed || format === 'webp') {
    return <img src={src} alt="" decoding="async" draggable={false} style={style} onLoad={onArrived} />
  }
  const [w, h] = size
  const [W, H] = [w + (w % 2), h + (h % 2)]
  return (
    <video
      ref={(el) => {
        // muted as an attribute too, before it plays: Safari on iOS only autoplays it then
        if (!el || el.hasAttribute('muted')) return
        el.muted = true
        el.setAttribute('muted', '')
        void el.play().catch(() => {}) // e.g. Low Power Mode: it then rests on its first frame
      }}
      // the padding falls just outside the box: the picture keeps its own pixels and place
      style={{ ...style, width: `${(100 * W) / w}%`, height: `${(100 * H) / h}%`, objectFit: 'fill', objectPosition: '0 0' }}
      src={format === 'mp4' ? src.replace(/\.webp$/, '.mp4') : clipFileUrl(src, format)}
      autoPlay
      muted
      loop
      playsInline
      disablePictureInPicture
      preload="auto"
      aria-hidden="true"
      onLoadedData={(e) => {
        if (alpha && !videoAlphaWorks(e.currentTarget)) setFailed(true)
      }}
      onPlaying={onArrived}
      onError={() => setFailed(true)}
    />
  )
}
