/**
 * The animated clips' files (the woman's and the cat's), each fetched once per visit and
 * kept as a Blob, so a clip can be played again and again from a fresh copy (a new object
 * URL always starts at its first frame) without downloading it twice.
 *
 * Each clip is named by its animated WebP, but where the browser can show transparent video the
 * clip is played as video instead (scripts/clip_video.py writes both): video is decoded by the
 * graphics chip and always holds its last frame, where a large animated WebP can blink out for a
 * frame while the browser catches up. Safari's engine plays HEVC with alpha (.mov), the others
 * VP9 with alpha (.webm). Chrome on a Mac can also play HEVC, but without its alpha (a black
 * box), so the choice is made by engine, and the first video's first frame is checked for
 * transparency before any is shown. Anything that goes wrong falls back to the WebP for the visit.
 */

export type ClipFormat = 'webm' | 'mov' | 'webp'

function engineFormat(): ClipFormat {
  if (typeof document === 'undefined') return 'webp'
  const probe = document.createElement('video')
  if (typeof probe.canPlayType !== 'function') return 'webp'
  const ua = navigator.userAgent
  // Safari, and every browser on iOS (all WebKit): HEVC with alpha. Chrome, Edge, Opera and
  // Firefox say "Chrome/", "Edg/", "OPR/" or "Firefox/" on the desktop; their iOS versions don't.
  const webkit = /AppleWebKit/.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\/|Firefox\//.test(ua)
  if (webkit) return probe.canPlayType('video/mp4; codecs="hvc1"') ? 'mov' : 'webp'
  return probe.canPlayType('video/webm; codecs="vp9"') ? 'webm' : 'webp'
}

let format: ClipFormat | null = null
/** Whether a video's transparency has been seen to work (null: not checked yet). */
let alphaWorks: boolean | null = null

/** How clips play in this browser, for this visit. */
export function clipFormat(): ClipFormat {
  if (format === null) format = engineFormat()
  return format
}

/** Plays the WebP from now on (video failed: no alpha, or the browser won't play it). */
export function fallBackToWebp() {
  format = 'webp'
}

/** The file to fetch for a clip named by its WebP, in this visit's format. */
export const clipFileUrl = (src: string, as: ClipFormat = clipFormat()) => (as === 'webp' ? src : src.replace(/\.webp$/, `.${as}`))

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

/** A clip's file (named by its WebP), in this visit's format; a missing video falls back to the WebP. */
export async function fetchClipFile(src: string): Promise<Blob | null> {
  const as = clipFormat()
  if (as === 'webp') return fetchUrl(src)
  const blob = await fetchUrl(clipFileUrl(src, as))
  return blob ?? fetchUrl(src)
}

/** The file, if it has already arrived (no waiting). */
export const arrivedClipFile = (src: string): Blob | undefined => arrived.get(clipFileUrl(src)) ?? arrived.get(src)

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
    if (!alphaWorks) fallBackToWebp()
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
            fallBackToWebp() // e.g. Low Power Mode on iOS won't play video by itself
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

async function preparePicture(blob: Blob, name: string): Promise<PreparedClip | null> {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.alt = ''
  img.draggable = false
  // decoded before it's drawn: an animated picture this large would otherwise be drawn blank
  // (the whole figure blinking out) while the browser catches up with its first frames
  img.decoding = 'sync'
  img.dataset.clip = name
  img.src = url
  try {
    await img.decode()
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
  return {
    el: img,
    start: () => afterPainted(0),
    release: () => {
      img.remove()
      URL.revokeObjectURL(url)
    },
  }
}

/**
 * A fresh copy of a clip (named by its WebP), ready to go on screen at its first frame: as video
 * where that works, otherwise as the animated picture. Null if it couldn't be had.
 */
export async function prepareClip(src: string, name: string): Promise<PreparedClip | null> {
  const blob = arrivedClipFile(src) ?? (await fetchClipFile(src))
  if (!blob) return null
  // a video file, unless it's the WebP (a video missing on the server falls back to it)
  const isVideo = blob.type.startsWith('video/') || (!blob.type.startsWith('image/') && clipFormat() !== 'webp')
  if (!isVideo) return preparePicture(blob, name)
  const video = await prepareVideo(blob, name)
  if (video) return video
  // video didn't work here: the picture instead, from now on
  fallBackToWebp()
  const picture = await fetchUrl(src)
  return picture ? preparePicture(picture, name) : null
}
