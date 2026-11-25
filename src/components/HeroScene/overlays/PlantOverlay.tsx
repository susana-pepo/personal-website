import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { afterPainted, arrivedClipFile, clipsCanPlay, fetchClipFile, prepareClip, type PreparedClip } from '../../../scene/clipFiles'
import { whenEntered, whenSettled } from '../../../scene/entrance'
import { PLANT_MEDIA, overlay } from '../../../scene/layout'
import { onHover, onSwayEnd, swaysOnItsOwn, untilNextBeat, type SwayState } from '../../../scene/plantSway'
import { SceneObject } from './SceneObject'
import './PlantOverlay.css'

const PLANT = overlay('plant')
/** If a sway's end is never heard (a hidden tab pauses it), it hands back this long after its length. */
const END_GRACE_MS = 1500
/** When the room settled (performance.now()): its beat is counted from there, for the whole visit. */
let settledAt: number | null = null
if (typeof document !== 'undefined') void whenSettled().then(() => (settledAt ??= performance.now()))

const savingData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true

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
 * (src/scene/plantSway.ts). Its clip loads as the room is revealed, and the copy for its next
 * sway is always decoded in advance, so each sway starts right on its beat. Played the way the cat plays its clips
 * (src/scene/clipFiles.ts): as transparent video, each sway from a fresh copy of the file, put on
 * screen only once its first frame is decoded. The still stays underneath until that frame has
 * surely been painted, and comes back the same way at the end. Every sway starts and ends exactly
 * on the still, so no hand-over shows, and one sway can follow another without a seam (the last
 * copy holds its final frame until the next one's first is up). With reduced motion, a paused room,
 * or where video can't play, it simply stays still.
 */
export function PlantOverlay({ motionAllowed, stir }: PlantOverlayProps) {
  const reducedMotion = usePrefersReducedMotion()
  const moving = motionAllowed && !reducedMotion
  const host = useRef<HTMLSpanElement>(null)
  const [swaying, setSwaying] = useState(false)
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
    if (!moving || !box) {
      setSwaying(false)
      return
    }
    let stopped = false
    let state: SwayState = 'rest'
    let current: PreparedClip | null = null
    // The copy for the next sway, its first frame already decoded (so a sway starts on its beat).
    let ready: PreparedClip | null = null
    let preparing = false
    let beatTimer: number | undefined
    let endTimer: number | undefined

    const prepareNext = async () => {
      if (ready || preparing || stopped || !arrivedClipFile(PLANT_MEDIA.stir.src)) return
      preparing = true
      const clip = await prepareClip(PLANT_MEDIA.stir.src, 'plant-stir')
      preparing = false
      if (stopped) return clip?.release()
      ready = clip
    }

    const rest = () => {
      // The last frame is the still: show it, then take the clip away once that has been painted.
      state = 'rest'
      const clip = current
      current = null
      setSwaying(false)
      void afterPainted(0).then(() => clip?.release())
    }

    const play = async () => {
      const clip = ready ?? (await prepareClip(PLANT_MEDIA.stir.src, 'plant-stir')) // (a hover may come before it's ready)
      if (clip === ready) ready = null
      if (stopped) return clip?.release()
      if (!clip) return rest() // video can't play here: it stays still
      const previous = current // a sway just ended holds its last frame (the still) until this one is up
      current = clip
      box.appendChild(clip.el)
      let ended = false
      const end = () => {
        if (ended || stopped) return
        ended = true
        window.clearTimeout(endTimer)
        const next = onSwayEnd(state)
        state = next.state
        if (next.again) void play()
        else rest()
      }
      clip.el.addEventListener('ended', end, { once: true })
      try {
        await clip.start() // resolves once its first frame is on screen
      } catch {
        clip.release()
        current = previous
        return rest()
      }
      if (stopped) return
      // Its first frame is up, and it is the still: the still can step aside now. The sway before
      // (if any) goes once this one has surely been painted over it.
      setSwaying(true)
      void afterPainted(0).then(() => previous?.release())
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
      current?.release()
      ready?.release()
      for (const el of [...box.children]) el.remove()
      setSwaying(false)
    }
  }, [moving])

  useEffect(() => {
    if (stir > 0) hover.current?.()
  }, [stir])

  const [w, h] = PLANT_MEDIA.size
  const [W, H] = [w + (w % 2), h + (h % 2)]
  return (
    <SceneObject overlay={PLANT} highlighted={false} discoveryIndex={0} className="plant">
      <img
        src={PLANT_MEDIA.still}
        alt=""
        width={Math.round(PLANT.width)}
        height={Math.round(PLANT.height)}
        decoding="async"
        draggable={false}
        style={swaying ? { visibility: 'hidden' } : undefined}
      />
      {/* The video is padded to an even size on the right and at the bottom: that falls just outside the box. */}
      <span ref={host} className="plant__clip" style={{ width: `${(100 * W) / w}%`, height: `${(100 * H) / h}%` }} />
    </SceneObject>
  )
}
