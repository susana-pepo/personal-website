import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { WOMAN_MEDIA, overlay } from '../../../scene/layout'
import { HOME_CLIP, WOMAN_BREATH, WOMAN_CLIPS, nextClip, restAfter, stillRest, type WomanClip } from '../../../scene/womanClips'
import { afterPainted, arrivedClipFile, fetchClipFile, fetchLater, prepareClip, type PreparedClip } from '../../../scene/clipFiles'
import { whenSettled } from '../../../scene/entrance'
import { SceneObject } from './SceneObject'

const WOMAN = overlay('woman')

/** Used only when a clip may have been paused mid-way (the tab was hidden): the next one fades in over it. */
const RECOVER_FADE_MS = 450
/** How long the picture underneath stays after a new clip goes on top (same pose: unseen). */
const SETTLE_MS = 300
/** Her breath (played at rest) is fetched this soon after the first clip starts. */
const BREATH_AFTER_MS = 1500

interface WomanOverlayProps {
  /** The room is allowed to move right now (see useScenePlayback). */
  motionAllowed: boolean
  /** Lit while her hotspot is hovered or focused. */
  highlighted: boolean
  /** Order in the first-visit discovery sequence. */
  discoveryIndex: number
}

/**
 * The woman writing at the desk, with the armchair drawn over her (they share one
 * box, so the chair always sits exactly over her and they magnify together on hover).
 * With reduced motion or a paused room: one still picture of her in the chair. She
 * opens About (she says "Hey there, I’m Susana").
 *
 * Her animation is a set of clips, each exactly as exported, that all start from the
 * same pose and end with a short bridge back to it (scripts/build-woman.py). They play
 * one after another in a calm random order, with a rest at that pose between them,
 * where she takes one or two calm breaths (src/scene/womanClips.ts), so the change from
 * one to the next can't be seen:
 *  - each clip plays once from a fresh copy of its file (so it always starts at its
 *    first frame) and stops on the shared pose; if the next one is a moment late, she
 *    just rests a moment longer;
 *  - each clip plays as transparent video where the browser can show it (src/scene/clipFiles.ts),
 *    else as an animated picture: a large animated picture can blink out for a frame, a video holds;
 *  - the next clip is ready at its first frame before it's put on screen, on top of the last one,
 *    which is removed only once the new one has been drawn: never a blank frame;
 *  - the still holds her place until the first clip has arrived (it's that clip's first
 *    frame with the chair on top).
 */
export function WomanOverlay({ motionAllowed, highlighted, discoveryIndex }: WomanOverlayProps) {
  const reducedMotion = usePrefersReducedMotion()
  const moving = motionAllowed && !reducedMotion
  const clipsBox = useRef<HTMLSpanElement>(null)
  const [playing, setPlaying] = useState(false)
  const size = { width: Math.round(WOMAN.width), height: Math.round(WOMAN.height) }

  useEffect(() => {
    const host = clipsBox.current
    if (!moving || !host) {
      setPlaying(false)
      return
    }
    let stopped = false
    let timer: number | undefined
    let current: PreparedClip | null = null
    let hiddenDuringClip = false
    let waitingForVisible = false
    const recent: string[] = []

    /** Puts a fresh copy of a clip on screen, over the last one (same pose); false if it couldn't. */
    const mount = async (clip: WomanClip, fade: boolean) => {
      const next = await prepareClip(clip.src, clip.name)
      if (!next) return false
      if (stopped) {
        next.release()
        return false
      }
      const previous = current
      current = next
      hiddenDuringClip = document.hidden
      host.appendChild(next.el) // on top of the last clip, which shows the same pose
      if (fade) next.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: RECOVER_FADE_MS, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' })
      try {
        await next.start() // resolves once its first frame is on screen
      } catch {
        next.release()
        current = previous
        return false
      }
      // The still (or the last clip, in the same pose) stays underneath until this one has surely
      // been drawn: never a blank frame. A video says when its frame is up, so it goes a frame
      // later; a picture can't, so it waits a while longer.
      const settle = next.el instanceof HTMLVideoElement ? 0 : SETTLE_MS
      void afterPainted(settle).then(() => !stopped && setPlaying(true))
      void afterPainted(fade ? RECOVER_FADE_MS + 50 : settle).then(() => previous?.release())
      return true
    }

    const show = async (clip: WomanClip, fade: boolean) => {
      if (!(await mount(clip, fade))) {
        // this one didn't arrive: try again with another (or the first) shortly
        if (!stopped) timer = window.setTimeout(next, 1000)
        return
      }
      recent.push(clip.name)
      if (recent.length > 4) recent.shift()
      timer = window.setTimeout(() => rest(clip.name), clip.ms + 30)
    }

    /** At her home pose after a clip: a moment's stillness, one or two breaths, then the next clip. */
    const rest = (after: string) => {
      if (stopped) return
      if (document.hidden) {
        waitingForVisible = true
        return
      }
      if (!arrivedClipFile(WOMAN_BREATH.src)) {
        timer = window.setTimeout(next, stillRest(after, Math.random()))
        return
      }
      const { breaths, settleMs, afterMs } = restAfter(after, Math.random())
      timer = window.setTimeout(() => void breathe(breaths, afterMs), settleMs)
    }

    const breathe = async (left: number, afterMs: number) => {
      if (stopped) return
      if (document.hidden) {
        waitingForVisible = true
        return
      }
      const ok = await mount(WOMAN_BREATH, hiddenDuringClip)
      if (stopped) return
      timer = window.setTimeout(
        () => (left > 1 ? void breathe(left - 1, afterMs) : (timer = window.setTimeout(next, afterMs))),
        ok ? WOMAN_BREATH.ms + 20 : 0,
      )
    }

    const next = () => {
      if (stopped) return
      if (document.hidden) {
        waitingForVisible = true // carry on when she can be seen
        return
      }
      const pool = WOMAN_CLIPS.filter((c) => arrivedClipFile(c.src))
      void show(nextClip(pool.length > 0 ? pool : [HOME_CLIP], recent, Math.random()), hiddenDuringClip)
    }

    const onVisibility = () => {
      if (document.hidden) {
        hiddenDuringClip = true
      } else if (waitingForVisible) {
        waitingForVisible = false
        next()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // once the page's entrance has settled (the still, her first frame, holds her place till then)
    void whenSettled().then(() => {
      if (!stopped) void show(HOME_CLIP, false)
    })
    // Her breath comes next (it's needed at the first rest), then the other clips, one after another.
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
    let breathTimer: number | undefined
    if (!saveData) void whenSettled().then(() => {
      if (!stopped) breathTimer = window.setTimeout(() => void fetchClipFile(WOMAN_BREATH.src), BREATH_AFTER_MS)
    })
    const moreTimer = fetchLater(
      WOMAN_CLIPS.filter((c) => c !== HOME_CLIP).map((c) => c.src),
      () => stopped,
    )

    return () => {
      stopped = true
      window.clearTimeout(timer)
      window.clearTimeout(moreTimer)
      window.clearTimeout(breathTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      current?.release()
      for (const el of [...host.children]) el.remove()
      setPlaying(false)
    }
  }, [moving])

  return (
    <SceneObject overlay={WOMAN} highlighted={highlighted} discoveryIndex={discoveryIndex}>
      <span ref={clipsBox} className="woman__clips" />
      {moving && <img src={WOMAN_MEDIA.chair} alt="" {...size} decoding="async" draggable={false} />}
      {!(moving && playing) && <img src={WOMAN_MEDIA.still} alt="" {...size} decoding="async" draggable={false} />}
    </SceneObject>
  )
}
