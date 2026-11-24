import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { WOMAN_MEDIA, overlay } from '../../../scene/layout'
import { HOME_CLIP, WOMAN_BREATH, WOMAN_CLIPS, nextClip, restAfter, stillRest, type WomanClip } from '../../../scene/womanClips'
import { arrivedClipFile, fetchClipFile, fetchLater } from '../../../scene/clipFiles'
import { SceneObject } from './SceneObject'

const WOMAN = overlay('woman')

/** Used only when a clip may have been paused mid-way (the tab was hidden): the next one fades in over it. */
const RECOVER_FADE_MS = 450
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
 *  - the next clip is decoded before it's put on screen, on top of the last one, which
 *    is removed a frame later: never a blank frame;
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
    let current: { img: HTMLImageElement; url: string } | null = null
    let hiddenDuringClip = false
    let waitingForVisible = false
    const recent: string[] = []
    const fetchClip = (clip: WomanClip) => fetchClipFile(clip.src)

    /** Puts a fresh copy of a clip on screen, over the last one (same pose); false if it couldn't. */
    const mount = async (clip: WomanClip, fade: boolean) => {
      const blob = await fetchClip(clip)
      if (stopped || !blob) return false
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.alt = ''
      img.draggable = false
      img.decoding = 'async'
      img.dataset.clip = clip.name
      img.src = url
      try {
        await img.decode()
      } catch {
        URL.revokeObjectURL(url)
        return false
      }
      if (stopped) {
        URL.revokeObjectURL(url)
        return false
      }
      const previous = current
      current = { img, url }
      hiddenDuringClip = document.hidden
      host.appendChild(img) // on top of the last clip, which shows the same pose
      setPlaying(true)
      const letGo = () => {
        if (!previous) return
        previous.img.remove()
        URL.revokeObjectURL(previous.url)
      }
      if (fade) {
        img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: RECOVER_FADE_MS, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' })
        window.setTimeout(letGo, RECOVER_FADE_MS + 50)
      } else {
        requestAnimationFrame(() => requestAnimationFrame(letGo))
      }
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

    void show(HOME_CLIP, false)
    // Her breath comes next (it's needed at the first rest), then the other clips, one after another.
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
    const breathTimer = saveData ? undefined : window.setTimeout(() => void fetchClipFile(WOMAN_BREATH.src), BREATH_AFTER_MS)
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
      for (const img of [...host.querySelectorAll('img')]) img.remove()
      if (current) URL.revokeObjectURL(current.url)
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
