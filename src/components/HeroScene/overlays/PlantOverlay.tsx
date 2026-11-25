import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { afterPainted, arrivedClipFile, clipsCanPlay, fetchClipFile, prepareClip, type PreparedClip } from '../../../scene/clipFiles'
import { whenEntered, whenSettled } from '../../../scene/entrance'
import { PLANT_MEDIA, overlay } from '../../../scene/layout'
import { onHover, onSwayEnd, swaysOnItsOwn, untilNextBeat, type SwayState } from '../../../scene/plantSway'
import { SceneObject } from './SceneObject'
import './PlantOverlay.css'

const PLANT = overlay('plant')
const [CLIP_W, CLIP_H] = PLANT_MEDIA.size
/** If a sway's end is never heard (a hidden tab pauses it), it hands back this long after its length. */
const END_GRACE_MS = 1500
/** The middle of the pot, as a fraction of the clip's frame: solid in every frame (only the leaves move). */
const POT = [0.5, 0.55] as const

/**
 * How the sway reaches the screen, decided on the first sway of the visit:
 *  - 'canvas': each frame is copied into a canvas painted with the room, like a picture. The browser
 *    never draws the video itself, so it can't drop it: Chrome-based browsers put a video on a layer
 *    of its own and can leave that layer out for a moment (the woman blinked out that way; see
 *    HeroScene.css), and with the still stepped aside that left the shelf bare, caught on loads.
 *    The still steps aside in the same moment the canvas draws the clip's first frame, and comes
 *    back in the same moment as its last: both are the still's own pose, so nothing ever shows
 *    between them.
 *  - 'video': where a browser can't copy the frames with their transparency, the video is shown
 *    itself, and the still steps aside only once its frames are really there.
 */
let mode: 'canvas' | 'video' | null = null

/** When the room settled (performance.now()): its beat is counted from there, for the whole visit. */
let settledAt: number | null = null
if (typeof document !== 'undefined') void whenSettled().then(() => (settledAt ??= performance.now()))

const savingData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true

/** Copies the clip's current frame into the canvas (the video's padding row is left out). */
function drawFrame(ctx: CanvasRenderingContext2D, video: HTMLVideoElement) {
  ctx.clearRect(0, 0, CLIP_W, CLIP_H)
  ctx.drawImage(video, 0, 0, CLIP_W, CLIP_H, 0, 0, CLIP_W, CLIP_H)
}

/** Whether the canvas holds the plant with its transparency: the corner clear, the pot solid. */
function canvasLooksRight(ctx: CanvasRenderingContext2D): boolean {
  try {
    const corner = ctx.getImageData(1, 1, 1, 1).data[3]!
    const pot = ctx.getImageData(Math.floor(CLIP_W * POT[0]), Math.floor(CLIP_H * POT[1]), 1, 1).data[3]!
    return corner < 16 && pot > 200
  } catch {
    return false
  }
}

/** For 'video' mode: resolves true once the video shows the plant (a few frames in, the pot there), false if not soon. */
function whenVideoShown(video: HTMLVideoElement): Promise<boolean> {
  const rvfc = (video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: { presentedFrames: number }) => void) => number })
    .requestVideoFrameCallback
  if (typeof rvfc !== 'function') return new Promise((done) => window.setTimeout(() => done(true), 300))
  return new Promise((done) => {
    const probe = document.createElement('canvas')
    probe.width = CLIP_W
    probe.height = CLIP_H
    const ctx = probe.getContext('2d', { willReadFrequently: true })
    let from: number | null = null
    const timer = window.setTimeout(() => done(false), 700)
    const each = (_: number, meta: { presentedFrames: number }) => {
      from ??= meta.presentedFrames
      let drawn = true
      if (ctx) {
        drawFrame(ctx, video)
        drawn = canvasLooksRight(ctx)
      }
      if (meta.presentedFrames - from >= 2 && drawn) {
        window.clearTimeout(timer)
        void afterPainted(0).then(() => done(true))
      } else rvfc.call(video, each)
    }
    rvfc.call(video, each)
  })
}

interface PlantOverlayProps {
  /** The room is allowed to move right now (see useScenePlayback). */
  motionAllowed: boolean
  /** Bumped each time a pointer comes onto the plant (its hover outline lives in HotspotLayer). */
  stir: number
}

/**
 * The hanging pothos on the shelf. Its leaves sway and settle (plant-stir, about 5 s, one turn of
 * the record; scripts/build-plant.py): on their own, on the room's beat from the moment it settles
 * (with the steam, the cat and the woman), and whenever a pointer comes onto it
 * (src/scene/plantSway.ts). Its clip loads as the room is revealed, and the copy for its next sway
 * is always decoded in advance, so each sway starts right on its beat. Every sway starts and ends
 * exactly on the still's pose, so one can follow another without a seam, and the still takes over
 * again without a jump. How its frames reach the screen: see `mode` above. With reduced motion, a
 * paused room, or where video can't play, it simply stays still.
 */
export function PlantOverlay({ motionAllowed, stir }: PlantOverlayProps) {
  const reducedMotion = usePrefersReducedMotion()
  const moving = motionAllowed && !reducedMotion
  const host = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stillRef = useRef<HTMLImageElement>(null)
  const hover = useRef<(() => void) | null>(null)

  // Its clip loads as the room is revealed, whatever else is going on (it's only skipped with
  // reduced motion, and when saving data: then only a hover fetches it).
  useEffect(() => {
    if (reducedMotion || savingData()) return
    let stopped = false
    void whenEntered().then(() => {
      if (!stopped) void fetchClipFile(PLANT_MEDIA.stir.src)
    })
    return () => {
      stopped = true
    }
  }, [reducedMotion])

  useEffect(() => {
    const box = host.current
    const canvas = canvasRef.current
    const still = stillRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true }) ?? null
    if (!moving || !box || !canvas || !still) return
    let stopped = false
    let state: SwayState = 'rest'
    let current: PreparedClip | null = null
    // The copy for the next sway, its first frame already decoded (so a sway starts on its beat).
    let ready: PreparedClip | null = null
    let preparing = false
    let beatTimer: number | undefined
    let endTimer: number | undefined
    let frameLoop = 0

    // The still and the sway trade places in one step (one painted frame), never with a gap.
    const showStill = (on: boolean) => {
      still.style.visibility = on ? '' : 'hidden'
      if (on && ctx) ctx.clearRect(0, 0, CLIP_W, CLIP_H)
    }

    const prepareNext = async () => {
      if (ready || preparing || stopped || !arrivedClipFile(PLANT_MEDIA.stir.src)) return
      preparing = true
      const clip = await prepareClip(PLANT_MEDIA.stir.src, 'plant-stir')
      preparing = false
      if (stopped) return clip?.release()
      ready = clip
    }

    const rest = () => {
      state = 'rest'
      cancelAnimationFrame(frameLoop)
      showStill(true)
      const clip = current
      current = null
      if (mode === 'canvas') clip?.release()
      else void afterPainted(0).then(() => clip?.release()) // (the video's last frame, the still's pose, until the still is painted)
    }

    const play = async () => {
      const clip = ready ?? (await prepareClip(PLANT_MEDIA.stir.src, 'plant-stir')) // (a hover may come before it's ready)
      if (clip === ready) ready = null
      if (stopped) return clip?.release()
      if (!clip || !(clip.el instanceof HTMLVideoElement)) return rest() // video can't play here: it stays still
      const video = clip.el
      const previous = current // a sway just ended: its last frame (the still's pose) is still showing
      current = clip

      // The first sway of the visit decides how frames reach the screen (see `mode`).
      if (mode === null) {
        if (ctx) {
          drawFrame(ctx, video)
          mode = canvasLooksRight(ctx) ? 'canvas' : 'video'
          ctx.clearRect(0, 0, CLIP_W, CLIP_H)
        } else mode = 'video'
      }
      box.dataset.mode = mode
      box.appendChild(video)

      let ended = false
      const end = () => {
        if (ended || stopped || current !== clip) return
        ended = true
        window.clearTimeout(endTimer)
        if (mode === 'canvas' && ctx) drawFrame(ctx, video) // its very last frame: the still's pose
        const next = onSwayEnd(state)
        state = next.state
        if (next.again) void play()
        else rest()
      }
      video.addEventListener('ended', end, { once: true })

      if (mode === 'canvas' && ctx) {
        // Its first frame (the still's pose) into the canvas, and the still away, in one step.
        drawFrame(ctx, video)
        showStill(false)
        previous?.release()
        try {
          await video.play()
        } catch {
          current = previous
          clip.release()
          return rest()
        }
        if (stopped || current !== clip) return
        // Each new frame into the canvas, painted with the room.
        let last = -1
        cancelAnimationFrame(frameLoop)
        const copy = () => {
          if (stopped || current !== clip || ended) return
          if (video.currentTime !== last) {
            last = video.currentTime
            drawFrame(ctx, video)
          }
          frameLoop = requestAnimationFrame(copy)
        }
        frameLoop = requestAnimationFrame(copy)
      } else {
        try {
          await clip.start() // resolves once its first frame is decoded
        } catch {
          current = previous
          clip.release()
          return rest()
        }
        if (stopped) return
        void whenVideoShown(video).then((shown) => {
          previous?.release()
          if (shown && !stopped && current === clip && !ended) showStill(false)
        })
      }
      endTimer = window.setTimeout(end, PLANT_MEDIA.stir.ms + END_GRACE_MS)
      void prepareNext() // the copy for the next sway, decoded while this one plays
    }

    // Its own sways, on the beat: every SWAY_EVERY_MS from the moment the room settled. A beat
    // that finds it mid-sway, or its clip not ready yet, passes: it never sways late, off the beat.
    const onBeat = () => {
      if (stopped || settledAt === null) return
      if (!document.hidden && swaysOnItsOwn(state) && ready && clipsCanPlay()) {
        state = 'swaying'
        void play()
      } else {
        void prepareNext()
      }
      // the next beat, from the grid (not from now), so a late timer never shifts the rhythm
      beatTimer = window.setTimeout(onBeat, untilNextBeat(performance.now() - settledAt, true))
    }

    hover.current = () => {
      if (stopped) return
      const next = onHover(state)
      state = next.state
      if (next.start) void play()
    }

    // Once its clip is here (it loads as the room is revealed, above), the copy for its first sway
    // is decoded, ready before the room settles.
    void whenEntered().then(async () => {
      if (stopped || savingData()) return
      await fetchClipFile(PLANT_MEDIA.stir.src) // (the same download, not a second one)
      void prepareNext()
    })
    // Its beat starts the moment the room settles, with the rest of the room's animations.
    void whenSettled().then(() => {
      if (stopped) return
      settledAt ??= performance.now()
      beatTimer = window.setTimeout(onBeat, untilNextBeat(performance.now() - settledAt))
    })

    return () => {
      stopped = true
      hover.current = null
      window.clearTimeout(beatTimer)
      window.clearTimeout(endTimer)
      cancelAnimationFrame(frameLoop)
      showStill(true)
      current?.release()
      ready?.release()
      for (const el of [...box.children]) el.remove()
    }
  }, [moving])

  useEffect(() => {
    if (stir > 0) hover.current?.()
  }, [stir])

  const [W, H] = [CLIP_W + (CLIP_W % 2), CLIP_H + (CLIP_H % 2)]
  return (
    <SceneObject overlay={PLANT} highlighted={false} discoveryIndex={0} className="plant">
      <img ref={stillRef} src={PLANT_MEDIA.still} alt="" width={Math.round(PLANT.width)} height={Math.round(PLANT.height)} decoding="async" draggable={false} />
      {/* The sway, painted with the room (see `mode`). */}
      <canvas ref={canvasRef} className="plant__frames" width={CLIP_W} height={CLIP_H} aria-hidden="true" />
      {/* The video: only the source of the frames, unless it has to be shown itself. Padded to an
          even size on the right and at the bottom, which falls just outside the box. */}
      <span ref={host} className="plant__clip" style={{ width: `${(100 * W) / CLIP_W}%`, height: `${(100 * H) / CLIP_H}%` }} />
    </SceneObject>
  )
}
