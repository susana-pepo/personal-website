import { useEffect, useRef, type RefObject } from 'react'
import { content } from '../../content/content'
import { clock, focusLeft, rainAudible, roomRadio } from '../../audio/radio'
import { useRainFromScene, useRoomRadio } from '../../audio/useRoomRadio'
import { DiscoveryHint } from '../DiscoveryHint/DiscoveryHint'
import { ROOM_POSTER_SRC } from '../../scene/layout'
import type { ScenePlayback } from '../../hooks/useScenePlayback'
import './SiteFooter.css'

interface SiteFooterProps {
  playback: ScenePlayback
  videoRef: RefObject<HTMLVideoElement | null>
}

/**
 * Beneath the room (the name, menu and scene control are in the masthead
 * above it): the "Focus with me" player, centred, and the copyright small at
 * the right; on a first visit, the "Explore the room" cue rests just inside
 * the room's bottom edge.
 *
 * The player is a small glass tile: a pair of headphones (sound waves while it
 * plays, rain falling past them when it rains outside), the session's time left,
 * a fine line that fills over the session, and the controls: rain (only while it
 * rains) and play / pause.
 */
export function SiteFooter(_props: SiteFooterProps) {
  const radio = useRoomRadio()
  useRainFromScene()
  const progressRef = useRef<HTMLSpanElement>(null)
  const leftRef = useRef<HTMLSpanElement>(null)

  const on = radio.status === 'playing' || radio.status === 'loading'
  const inSession = on || radio.status === 'paused'
  const withRain = rainAudible(radio)

  // Follow the session's clock without re-rendering React on every frame.
  useEffect(() => {
    let frame = 0
    const tick = () => {
      const { elapsed, total } = roomRadio().focus()
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${Math.min(1, elapsed / total)})`
      const left = clock(focusLeft(elapsed, total))
      if (leftRef.current && leftRef.current.textContent !== left) leftRef.current.textContent = left
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const meta =
    radio.status === 'error'
      ? 'Couldn’t play. Try again'
      : radio.status === 'done'
        ? 'Take a breath'
        : radio.status === 'paused'
          ? 'Paused'
          : on
            ? `Focusing${withRain ? ' · rain on' : ''}`
            : `25 min · lo-fi${radio.raining && radio.rainOn ? ' and rain' : ''}`

  return (
    <div className="credits">
      <div className="player" role="group" aria-label="Focus with me" data-on={on ? '' : undefined}>
        <span className="player__ambient" aria-hidden="true">
          <img src={ROOM_POSTER_SRC} alt="" decoding="async" />
        </span>

        <span
          className="player__art player__focus"
          aria-hidden="true"
          data-on={on ? '' : undefined}
          data-rain={radio.raining ? '' : undefined}
        >
          <svg viewBox="0 0 40 40">
            <g className="player__drops">
              <path d="M9 3v3" />
              <path d="M30 2v3" />
              <path d="M20 1v3" />
            </g>
            <path d="M9 25v-4a11 11 0 0 1 22 0v4" />
            <rect className="player__cup" x="6" y="23" width="6" height="10" rx="2.5" />
            <rect className="player__cup" x="28" y="23" width="6" height="10" rx="2.5" />
            <g className="player__waves">
              <path d="M3.2 25.5q-1.5 2.5 0 5" />
              <path d="M36.8 25.5q1.5 2.5 0 5" />
              <path className="player__wave-far" d="M1 23.5q-2.5 4.5 0 9" />
              <path className="player__wave-far" d="M39 23.5q2.5 4.5 0 9" />
            </g>
          </svg>
        </span>

        <p className="player__title">
          {inSession ? (
            <span ref={leftRef} className="player__left">
              {clock(focusLeft(roomRadio().focus().elapsed))}
            </span>
          ) : radio.status === 'done' ? (
            'Nice focus'
          ) : (
            'Focus with me'
          )}
        </p>
        <p className="player__meta" aria-live="polite">
          {meta}
        </p>

        <span className="player__progress" aria-hidden="true">
          <span ref={progressRef} className="player__progress-fill" />
        </span>

        <div className="player__buttons">
          {radio.raining && (
            <button
              type="button"
              className="player__tool"
              aria-pressed={radio.rainOn}
              aria-label="Rain sounds"
              title="Rain sounds"
              onClick={() => roomRadio().setRainOn(!radio.rainOn)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.6 4.5 7 9M13.6 4.5 12 9M18.6 4.5 17 9M7.1 12.5l-1.6 4.5M12.1 12.5l-1.6 4.5M17.1 12.5l-1.6 4.5" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="player__button"
            data-playing={on ? '' : undefined}
            onClick={roomRadio().toggle}
            aria-label={on ? 'Pause focusing' : radio.status === 'done' ? 'Focus again' : 'Focus with me'}
          >
            <svg className="player__icon player__icon--pause" viewBox="0 0 20 20" aria-hidden="true">
              <rect x="6.2" y="5.5" width="2.3" height="9" rx="0.6" />
              <rect x="11.5" y="5.5" width="2.3" height="9" rx="0.6" />
            </svg>
            <svg className="player__icon player__icon--play" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M7.6 5.4v9.2a.5.5 0 0 0 .76.43l7.1-4.6a.5.5 0 0 0 0-.84l-7.1-4.6a.5.5 0 0 0-.76.42z" />
            </svg>
          </button>
        </div>
      </div>

      <footer className="credits__copy">
        © {new Date().getFullYear()} {content.profile.fullName}
        {content.footer.note && <span> · {content.footer.note}</span>}
      </footer>

      <DiscoveryHint />
    </div>
  )
}
