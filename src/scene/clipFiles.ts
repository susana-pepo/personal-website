/**
 * The animated clips' files (the woman's and the cat's), each fetched once per visit and
 * kept as a Blob, so a clip can be played again and again from a fresh copy (a new object
 * URL always starts at its first frame) without downloading it twice.
 *
 * Every clip plays as transparent video (scripts/clip_video.py): video is decoded by the
 * graphics chip and always holds its last frame, where a large animated picture blinked out for
 * single frames. Safari's engine plays HEVC with alpha (.mov), the others VP9 with alpha (.webm).
 * Chrome on a Mac can also play HEVC, but without its alpha (a black box), so the choice is made
 * by engine, and the first video's first frame is checked for transparency before any is shown.
 * A clip is named by its old animated WebP path (`…/woman-writing.webp`), which is no longer
 * served: only its videos are. Where video can't play (no alpha, an old browser, or iOS Low
 * Power Mode refusing to start it), nothing animates for the visit and each figure rests on its
 * still picture, which is what reduced motion shows too.
 */

export type ClipFormat = 'webm' | 'mov' | 'none'

function engineFormat(): ClipFormat {
  if (typeof document === 'undefined') return 'none'
  const probe = document.createElement('video')
  if (typeof probe.canPlayType !== 'function') return 'none'
  const ua = navigator.userAgent
  // Safari, and every browser on iOS (all WebKit): HEVC with alpha. Chrome, Edge, Opera and
  // Firefox say "Chrome/", "Edg/", "OPR/" or "Firefox/" on the desktop; their iOS versions don't.
  const webkit = /AppleWebKit/.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\/|Firefox\//.test(ua)
  if (webkit) return probe.canPlayType('video/mp4; codecs="hvc1"') ? 'mov' : 'none'
  return probe.canPlayType('video/webm; codecs="vp9"') ? 'webm' : 'none'
}

let format: ClipFormat | null = null
/** Whether a video's transparency has been seen to work (null: not checked yet). */
let alphaWorks: boolean | null = null

/** How clips play in this browser, for this visit ('none': they don't, the stills stay). */
export function clipFormat(): ClipFormat {
  if (format === null) format = engineFormat()
  return format
}

/** Whether the clips can play at all in this visit (else every figure rests on its still). */
export const clipsCanPlay = () => clipFormat() !== 'none'

/** Video failed (no alpha, or the browser won't play it): nothing animates from now on. */
export function noVideo() {
  format = 'none'
}

/** A clip's video file, from its name (its old WebP path). */
export const clipFileUrl = (src: string, as: 'webm' | 'mov') => src.replace(/\.webp$/, `.${as}`)

const files = new Map<string, Promise<Blob | null>>()
const arrived = new Map<string, Blob>()

function fetchUrl(url: string): Promise<Blob | null> {
  let file = files.get(url)
  if (!file) {
    file = fetch(url)
      .then((r) => (r.ok ? r.blob() : null))
      .catch(() => null)
      .then((blob) => {
        if (blob) arrived.set(url, blob)
        else files.delete(url) // let a later turn try again
        return blob
      })
    files.set(url, file)
  }
  return file
}

/** A clip's video, in this visit's format (null where clips don't play, or if it can't be had). */
export async function fetchClipFile(src: string): Promise<Blob | null> {
  const as = clipFormat()
  return as === 'none' ? null : fetchUrl(clipFileUrl(src, as))
}

/** The video, if it has already arrived (no waiting). */
export const arrivedClipFile = (src: string): Blob | undefined => {
  const as = clipFormat()
  return as === 'none' ? undefined : arrived.get(clipFileUrl(src, as))
}

/** The clips that aren't needed at once load later, one after another, and only for visitors not saving data. */
export const LATER_CLIPS_AFTER_MS = 12_000

export function fetchLater(srcs: readonly string[], isStopped: () => boolean): number | undefined {
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  if (saveData) return undefined
  return window.setTimeout(async () => {
    for (const src of srcs) {
      if (isStopped()) return
      await fetchClipFile(src)
    }
  }, LATER_CLIPS_AFTER_MS)
}

/**
 * Resolves once `ms` have passed *and* the browser has drawn at least two frames since the call,
 * so a clip just put on screen has really been painted before what was under it is taken away.
 * (A busy or hidden page draws no frames, so the old clip simply stays a little longer.)
 */
export function afterPainted(ms: number): Promise<void> {
  const frames = new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  const time = new Promise<void>((done) => window.setTimeout(done, ms))
  return Promise.all([frames, time]).then(() => undefined)
}

/** One clip, ready to go on screen: its first frame is decoded and will show as soon as it's added. */
export interface PreparedClip {
  el: HTMLImageElement | HTMLVideoElement
  /** Starts it (a video plays; a picture already runs) and resolves once its first frame is on screen. */
  start: () => Promise<void>
  /** Takes it off screen and frees it. */
  release: () => void
}

const VIDEO_READY_MS = 5000

/**
 * For a transparent clip's video, once its first frame is decoded: whether this browser really
 * shows it transparent (checked once per visit, on the first such video; if not, every clip
 * falls back to its WebP from then on).
 */
export function videoAlphaWorks(video: HTMLVideoElement): boolean {
  if (alphaWorks === null) {
    alphaWorks = cornerIsClear(video)
    if (!alphaWorks) noVideo()
  }
  return alphaWorks
}

/** Whether the video's top-left corner (transparent in every clip) really comes out transparent. */
function cornerIsClear(video: HTMLVideoElement): boolean {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 4
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false
    ctx.drawImage(video, 0, 0, 4, 4, 0, 0, 4, 4)
    return ctx.getImageData(1, 1, 1, 1).data[3]! < 128
  } catch {
    return false
  }
}

function prepareVideo(blob: Blob, name: string): Promise<PreparedClip | null> {
  const url = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.disablePictureInPicture = true
  video.preload = 'auto'
  video.setAttribute('muted', '')
  video.setAttribute('playsinline', '')
  video.setAttribute('aria-hidden', 'true')
  video.dataset.clip = name
  const release = () => {
    video.pause()
    video.remove()
    video.removeAttribute('src')
    video.load() // lets the browser free its decoder now, not whenever it collects the element
    URL.revokeObjectURL(url)
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => done(false), VIDEO_READY_MS)
    const done = (ok: boolean) => {
      window.clearTimeout(timer)
      video.removeEventListener('loadeddata', onData)
      video.removeEventListener('error', onError)
      if (!ok) {
        release()
        resolve(null)
        return
      }
      resolve({
        el: video,
        start: async () => {
          const shown = new Promise<void>((on) => {
            if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(() => on())
            else void afterPainted(0).then(on)
          })
          try {
            await video.play()
          } catch {
            noVideo() // e.g. iOS Low Power Mode won't start video by itself: the stills stay
            throw new Error('video would not play')
          }
          await shown
        },
        release,
      })
    }
    const onData = () => done(videoAlphaWorks(video))
    const onError = () => done(false)
    video.addEventListener('loadeddata', onData)
    video.addEventListener('error', onError)
    video.src = url
    video.load()
  })
}

/**
 * A fresh copy of a clip (named by its old WebP path), ready to go on screen at its first frame.
 * Null if it can't be had, or if clips don't play in this visit.
 */
export async function prepareClip(src: string, name: string): Promise<PreparedClip | null> {
  if (!clipsCanPlay()) return null
  const blob = arrivedClipFile(src) ?? (await fetchClipFile(src))
  if (!blob || !clipsCanPlay()) return null
  const video = await prepareVideo(blob, name)
  if (!video && alphaWorks === false) noVideo()
  return video
}
