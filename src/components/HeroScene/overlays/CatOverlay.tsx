import { useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Ref } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import {
  DISSOLVE_MS,
  DREAM_MS,
  STILL_REPLY_MS,
  acceptsPet,
  catReducer,
  nextDreamDelay,
  nextReaction,
  playVariation,
  type CatClip,
  type CatPhase,
  type PetStyle,
} from '../../../scene/catReaction'
import { CAT_MEDIA, overlay } from '../../../scene/layout'
import { arrivedClipFile, fetchClipFile, fetchLater } from '../../../scene/clipFiles'
import { whenSettled } from '../../../scene/entrance'
import { SceneObject } from './SceneObject'

export interface CatHandle {
  pet: () => void
}

interface CatOverlayProps {
  ref?: Ref<CatHandle>
  /** The room is allowed to move right now (see useScenePlayback). */
  motionAllowed: boolean
  highlighted: boolean
  discoveryIndex: number
  /** `reaction` names what it did: 'asleep' (a purr and z's), or a reaction clip's name. */
  onReaction?: (phase: CatPhase, style: PetStyle | null, reaction: string | null) => void
}

const CAT = overlay('cat')
const EASE = 'cubic-bezier(0.45, 0, 0.55, 1)'
/** Only when a clip may have been paused mid-way (the tab was hidden): sleep fades back in over it. */
const RECOVER_FADE_MS = 450

interface Puff {
  text: string
  kind: 'purr' | 'z'
  /** drift, in em */
  dx: number
  dy: number
  rotate: number
  delay: number
  size: number
}

const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]!
const between = (a: number, b: number) => a + Math.random() * (b - a)

/** A small, airy, never-crowded splash: one purr and one or two z's, a little different every time. */
function makeSplash(): Puff[] {
  const purr: Puff = {
    text: pick(['purr', 'purrr', 'prrr']),
    kind: 'purr',
    dx: between(-1.4, -0.4),
    dy: between(-1.6, -1),
    rotate: between(-6, 2),
    delay: between(0, 0.15),
    size: between(0.95, 1.1),
  }
  const zs: Puff[] = Array.from({ length: Math.random() < 0.55 ? 2 : 1 }, (_, i) => ({
    text: pick(['z', 'zz', 'zzz']),
    kind: 'z' as const,
    dx: between(0.9, 2) + i * 0.9,
    dy: between(-2.6, -1.8) - i * 0.6,
    rotate: between(-4, 12),
    delay: 0.35 + i * 0.45 + between(0, 0.2),
    size: between(0.85, 1.15) + i * 0.15,
  }))
  return [purr, ...zs]
}

/** A dream: just one or two z's, softer and slower than a pet's, no purr. */
function makeDream(): Puff[] {
  return Array.from({ length: Math.random() < 0.6 ? 2 : 1 }, (_, i) => ({
    text: i === 0 ? pick(['z', 'zz']) : pick(['zz', 'zzz']),
    kind: 'z' as const,
    dx: between(0.7, 1.5) + i * 0.8,
    dy: between(-2.4, -1.8) - i * 0.6,
    rotate: between(-2, 10),
    delay: i * 0.9 + between(0, 0.3),
    size: between(1.05, 1.2) + i * 0.15,
  }))
}

/**
 * The sleeping cat: its sleeping clip (breathing, a slow sweep of the tail) loops,
 * exactly as exported (animated WebP, so it keeps its transparency in every browser,
 * Safari included). With reduced motion or a paused room it shows that clip's first
 * frame, still.
 *
 * Hovering it (or tapping it, or reaching it with the keyboard) plays one of its
 * reactions (never the same twice running): it dissolves in over the sleeping loop
 * in a quarter of a second, plays once, and ends on the sleeping pose, where a fresh
 * sleeping loop takes over without a jump. With it comes a small, airy splash from
 * its head (one "purr" and one or two z's, a little different every time) and a
 * screen-reader announcement. A new reaction waits until the last one is over.
 *
 * Left alone, it now and then lets out a couple of z's on its own (a dream),
 * so it feels alive between visits to it: only while the room moves, the page
 * is in view and nobody is petting it; silent for screen readers.
 */
export function CatOverlay({ ref, motionAllowed, highlighted, discoveryIndex, onReaction }: CatOverlayProps) {
  const reducedMotion = usePrefersReducedMotion()
  const moving = motionAllowed && !reducedMotion
  const [phase, setPhase] = useState<CatPhase>('idle')
  const [splash, setSplash] = useState<Puff[]>([])
  const phaseRef = useRef<CatPhase>('idle')
  const timer = useRef<number | undefined>(undefined)
  const onReactionRef = useRef(onReaction)
  onReactionRef.current = onReaction

  // Set by the player below while the room moves: starts a reaction clip, returning which and
  // how long it lasts (or null: the cat stays asleep and answers with its purr and z's).
  const react = useRef<(() => { name: string; ms: number } | null) | null>(null)
  const [reaction, setReaction] = useState<string>('asleep')

  const pet = useCallback(() => {
    if (!acceptsPet(phaseRef.current)) return
    phaseRef.current = catReducer(phaseRef.current, 'pet')
    // It stays asleep (a purr and z's), or plays a reaction clip (see the player below).
    const clip = react.current?.() ?? null
    const ms = clip?.ms ?? null
    setReaction(clip?.name ?? 'asleep')
    setSplash(clip ? [] : makeSplash())
    setPhase('petting')
    onReactionRef.current?.('petting', ms === null ? 'still' : 'video', clip?.name ?? 'asleep')
    timer.current = window.setTimeout(
      () => {
        phaseRef.current = catReducer(phaseRef.current, 'finished')
        setPhase('idle')
        onReactionRef.current?.('idle', null, null)
      },
      ms === null ? STILL_REPLY_MS : ms,
    )
  }, [])

  // The clips: the sleeping loop, and a reaction on request. Each plays from a fresh copy
  // of its file (so it starts at its first frame), decoded before it's put on screen.
  const clipsBox = useRef<HTMLSpanElement>(null)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    const host = clipsBox.current
    if (!moving || !host) {
      react.current = null
      setPlaying(false)
      return
    }
    let stopped = false
    let current: { img: HTMLImageElement; url: string } | null = null
    let lastReaction: string | null = null
    let hiddenDuringReaction = false
    let backTimer: number | undefined
    const fetchClip = (clip: CatClip) => fetchClipFile(clip.src)
    // Bumped when a reaction starts: a sleeping turn still decoding then gives way to it.
    let generation = 0
    const mount = async (clip: CatClip, entrance: 'cut' | 'dissolve' | 'fade', gen = generation) => {
      const blob = arrivedClipFile(clip.src) ?? (await fetchClip(clip))
      if (!blob || stopped) return false
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.alt = ''
      img.draggable = false
      // decoded before it's drawn: an animated picture this large would otherwise be drawn blank
      // (the whole figure blinking out) while the browser catches up with its first frames
      img.decoding = 'sync'
      img.dataset.clip = clip.name
      img.src = url
      try {
        await img.decode()
      } catch {
        URL.revokeObjectURL(url)
        return false
      }
      if (stopped || gen !== generation) {
        URL.revokeObjectURL(url)
        return false
      }
      const previous = current
      current = { img, url }
      host.appendChild(img)
      // the still (or the last clip, in the same pose) stays underneath a moment, until this one
      // has surely been drawn: never a blank frame while the browser gets the clip ready
      window.setTimeout(() => !stopped && setPlaying(true), 300)
      const letGo = () => {
        if (!previous) return
        previous.img.remove()
        URL.revokeObjectURL(previous.url)
      }
      if (entrance === 'cut') {
        window.setTimeout(letGo, 300) // same pose underneath, kept until the new clip is surely drawn
      } else {
        const ms = entrance === 'dissolve' ? DISSOLVE_MS : RECOVER_FADE_MS
        img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: EASE })
        window.setTimeout(letGo, ms + 40) // then the last clip goes, so it can't show round the new outline
      }
      return true
    }

    // Sleeping: the peaceful clip, turn after turn, with now and then a sweep of the tail in
    // its place. Each turn ends on the shared pose, where the next one starts.
    let sleepingTurns = 0
    let idleTimer: number | undefined
    const sleepOn = async (entrance: 'cut' | 'fade') => {
      window.clearTimeout(idleTimer)
      const ready = CAT_MEDIA.variations.filter((c) => arrivedClipFile(c.src))
      const variation = ready.length > 0 && playVariation(sleepingTurns, Math.random()) ? ready[Math.floor(Math.random() * ready.length)]! : null
      const clip = variation ?? CAT_MEDIA.sleep
      sleepingTurns = variation ? 0 : sleepingTurns + 1
      const ok = await mount(clip, entrance)
      if (stopped || reacting) return
      idleTimer = window.setTimeout(() => {
        if (document.hidden) waitingForVisible = true
        else void sleepOn('cut')
      }, ok ? clip.ms + 30 : 2000)
    }
    let reacting = false
    let waitingForVisible = false
    // once the page's entrance has settled (the still, its first frame, holds its place till then)
    void whenSettled().then(() => {
      if (!stopped) void sleepOn('cut')
    })
    // The variation and the reactions load later, one after another (sleep comes first);
    // a hover before they've arrived simply finds it staying asleep, with its purr.
    const moreTimer = fetchLater(
      [...CAT_MEDIA.variations, ...CAT_MEDIA.reactions].map((c) => c.src), // the tail first: it's needed soonest
      () => stopped,
    )

    react.current = () => {
      const ready = CAT_MEDIA.reactions.filter((c) => arrivedClipFile(c.src))
      const clip = nextReaction(ready, lastReaction, Math.random())
      lastReaction = clip?.name ?? 'asleep'
      if (!clip) {
        sleepingTurns = 2 // it stays asleep (just its purr and z's), and sweeps its tail next
        return null
      }
      reacting = true
      generation++
      window.clearTimeout(idleTimer)
      hiddenDuringReaction = document.hidden
      void mount(clip, 'dissolve').then((ok) => {
        if (stopped) return
        // it ends on the sleeping pose (and rests there): sleep takes over again
        backTimer = window.setTimeout(
          () => {
            reacting = false
            sleepingTurns = 2 // after a reaction, it always settles with the sweep of its tail
            void sleepOn(hiddenDuringReaction ? 'fade' : 'cut')
          },
          ok ? clip.ms + 60 : 0,
        )
      })
      return { name: clip.name, ms: clip.ms + DISSOLVE_MS }
    }
    const onVisibility = () => {
      if (document.hidden) {
        hiddenDuringReaction = true
      } else if (waitingForVisible) {
        waitingForVisible = false
        if (!reacting) void sleepOn('fade') // the last turn may have paused mid-way while hidden
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopped = true
      react.current = null
      window.clearTimeout(moreTimer)
      window.clearTimeout(backTimer)
      window.clearTimeout(idleTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const img of [...host.querySelectorAll('img')]) img.remove()
      if (current) URL.revokeObjectURL(current.url)
      setPlaying(false)
    }
  }, [moving])

  useImperativeHandle(ref, () => ({ pet }), [pet])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Dreams: a z or two now and then, while the room is moving.
  const [dream, setDream] = useState<{ id: number; puffs: Puff[] } | null>(null)
  useEffect(() => {
    if (!moving) {
      setDream(null)
      return
    }
    let first = true
    let next: number | undefined
    let fade: number | undefined
    const schedule = () => {
      next = window.setTimeout(() => {
        if (!document.hidden && phaseRef.current === 'idle') {
          setDream((d) => ({ id: (d?.id ?? 0) + 1, puffs: makeDream() }))
          window.clearTimeout(fade)
          fade = window.setTimeout(() => setDream(null), DREAM_MS)
        }
        schedule()
      }, nextDreamDelay(first, Math.random()))
      first = false
    }
    schedule()
    return () => {
      window.clearTimeout(next)
      window.clearTimeout(fade)
    }
  }, [moving])

  return (
    <SceneObject
      overlay={CAT}
      highlighted={highlighted}
      discoveryIndex={discoveryIndex}
      className="cat"
      dataAttributes={{ 'data-phase': phase }}
    >
      <span ref={clipsBox} className="cat__clips" />
      {!(moving && playing) && (
        <img
          className="cat__art"
          src={CAT_MEDIA.still}
          alt=""
          width={Math.round(CAT.width)}
          height={Math.round(CAT.height)}
          decoding="async"
          draggable={false}
        />
      )}
      {dream && phase === 'idle' && (
        <span key={dream.id} className="cat__purr cat__purr--dream" aria-hidden="true">
          {dream.puffs.map((puff, i) => (
            <span
              key={i}
              className="cat__puff cat__puff--z"
              style={
                {
                  '--dx': `${puff.dx}em`,
                  '--dy': `${puff.dy}em`,
                  '--rot': `${puff.rotate}deg`,
                  '--size': puff.size,
                  animationDelay: `${puff.delay}s`,
                } as CSSProperties
              }
            >
              {puff.text}
            </span>
          ))}
        </span>
      )}
      {phase === 'petting' && reaction === 'head-turn' && (
        // A sleepy question as it turns its head, drifting the way the head goes.
        <span className="cat__purr" aria-hidden="true">
          <span className="cat__puff cat__puff--mrrp">mrrp?</span>
        </span>
      )}
      {phase === 'petting' && reaction === 'stretch' && (
        <>
          {/* A slow yawn from its mouth as its eyes open, the letters drifting apart as it stretches… */}
          <span className="cat__yawn" aria-hidden="true">
            <span>mrraow</span>
          </span>
          {/* …and three small reach marks beside its paws at the height of the stretch. */}
          <span className="cat__reach" aria-hidden="true">
            {[-22, 0, 22].map((angle, i) => (
              <span key={angle} className="cat__reach-mark" style={{ '--a': `${180 + angle}deg`, animationDelay: `${2.3 + i * 0.07}s` } as CSSProperties} />
            ))}
          </span>
        </>
      )}
      {phase === 'petting' && reaction === 'asleep' && (
        <span className="cat__purr" aria-hidden="true">
          {splash.map((puff, i) => (
            <span
              key={i}
              className={`cat__puff cat__puff--${puff.kind}`}
              style={
                {
                  '--dx': `${puff.dx}em`,
                  '--dy': `${puff.dy}em`,
                  '--rot': `${puff.rotate}deg`,
                  '--size': puff.size,
                  animationDelay: `${puff.delay}s`,
                } as CSSProperties
              }
            >
              {puff.text}
            </span>
          ))}
        </span>
      )}
    </SceneObject>
  )
}
