import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { afterPainted, clipsCanPlay, fetchClipFile, prepareClip, type PreparedClip } from '../../../scene/clipFiles'
import { whenSettled } from '../../../scene/entrance'
import { PLANT_MEDIA, overlay } from '../../../scene/layout'
import { FIRST_SWAY_MS, SWAY_EVERY_MS, onHover, onSwayEnd, swaysOnItsOwn, type SwayState } from '../../../scene/plantSway'
import { SceneObject } from './SceneObject'
import './PlantOverlay.css'

const PLANT = overlay('plant')
/** If a sway's end is never heard (a hidden tab pauses it), it hands back this long after its length. */
const END_GRACE_MS = 1500

interface PlantOverlayProps {
  /** The room is allowed to move right now (see useScenePlayback). */
  motionAllowed: boolean
  /** Bumped each time a pointer comes onto the plant (its hover outline lives in HotspotLayer). */
  stir: number
}

/**
 * The hanging pothos on the shelf. Its leaves sway and settle (plant-stir, about 5 s, one turn of
 * the record; scripts/build-plant.py): on their own, at the room's pace, and whenever a pointer
 * comes onto it (src/scene/plantSway.ts). Played the way the cat plays its clips
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

  useEffect(() => {
    const box = host.current
    if (!moving || !box) {
      setSwaying(false)
      return
    }
    let stopped = false
    let state: SwayState = 'rest'
    let current: PreparedClip | null = null
    let ownTimer: number | undefined
    let endTimer: number | undefined

    const rest = () => {
      // The last frame is the still: show it, then take the clip away once that has been painted.
      state = 'rest'
      const clip = current
      current = null
      setSwaying(false)
      void afterPainted(0).then(() => clip?.release())
    }

    const play = async () => {
      const clip = await prepareClip(PLANT_MEDIA.stir.src, 'plant-stir')
      if (stopped) return clip?.release()
      if (!clip) return rest() // not here yet, or video can't play: it stays still this time
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
    }

    // Its own sways, one every SWAY_EVERY_MS from the last sway that started (a hover's included).
    const scheduleOwn = (ms: number) => {
      window.clearTimeout(ownTimer)
      ownTimer = window.setTimeout(() => {
        if (stopped) return
        if (!document.hidden && swaysOnItsOwn(state) && clipsCanPlay()) {
          state = 'swaying'
          void play()
        }
        scheduleOwn(SWAY_EVERY_MS)
      }, ms)
    }

    hover.current = () => {
      if (stopped) return
      const next = onHover(state)
      state = next.state
      if (next.start) {
        void play()
        scheduleOwn(SWAY_EVERY_MS)
      }
    }

    // Once the room is at rest: its file loads (it sways on its own soon after), and its pace starts.
    void whenSettled().then(() => {
      if (stopped) return
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
      if (!saveData) void fetchClipFile(PLANT_MEDIA.stir.src) // (saving data: only a hover fetches it)
      scheduleOwn(FIRST_SWAY_MS)
    })

    return () => {
      stopped = true
      hover.current = null
      window.clearTimeout(ownTimer)
      window.clearTimeout(endTimer)
      current?.release()
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
