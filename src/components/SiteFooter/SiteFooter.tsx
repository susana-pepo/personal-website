import { useEffect, useRef, type RefObject } from 'react'
import { content } from '../../content/content'
import { PLAYLIST } from '../../audio/playlist'
import { clock, rainAudible, roomRadio } from '../../audio/radio'
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
 * above it): the room radio, centred, and the copyright small at the right;
 * on a first visit, the "Explore the room" cue rests just inside the room's
 * bottom edge.
 *
 * The radio is a small glass tile: the room in miniature (it also pauses the
 * room's animation), the track, a fine progress line, and the controls: rain
 * (only while it rains outside), next, and play / pause.
 */
export function SiteFooter({ playback }: SiteFooterProps) {
  const radio = useRoomRadio()
  useRainFromScene()
  const progressRef = useRef<HTMLSpanElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const durationRef = useRef<HTMLSpanElement>(null)

  const on = radio.status === 'playing' || radio.status === 'loading'
  const started = radio.status !== 'idle'
  const track = PLAYLIST[radio.index] ?? PLAYLIST[0]!
  const withRain = rainAudible(radio)
  const roomMoving = !playback.isPausedByChoice && !playback.unavailable

  // Follow the track's clock without re-rendering React on every frame.
  useEffect(() => {
    let frame = 0
    const tick = () => {
      const { time, duration } = roomRadio().position()
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${duration ? Math.min(1, time / duration) : 0})`
      const now = clock(time)
      if (timeRef.current && timeRef.current.textContent !== now) timeRef.current.textContent = now
      const total = clock(duration)
      if (durationRef.current && durationRef.current.textContent !== total) durationRef.current.textContent = total
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const meta =
    radio.status === 'error'
      ? 'Couldn’t play. Try again'
      : !started
        ? `Lo-fi · ${track.artist}`
        : radio.status === 'paused'
          ? 'Paused'
          : `${track.artist}${withRain ? ' · with rain' : ''}`

  return (
    <div className="credits">
      <div className="player" role="group" aria-label="Lo-fi radio" data-on={on ? '' : undefined}>
        <span className="player__ambient" aria-hidden="true">
          <img src={ROOM_POSTER_SRC} alt="" decoding="async" />
        </span>

        {playback.unavailable ? (
          <span className="player__art">
            <img src={ROOM_POSTER_SRC} alt="" decoding="async" />
          </span>
        ) : (
          <button
            type="button"
            className="player__art"
            onClick={playback.toggle}
            aria-label={roomMoving ? 'Pause the room’s animation' : 'Play the room’s animation'}
            data-moving={roomMoving ? '' : undefined}
          >
            <img src={ROOM_POSTER_SRC} alt="" decoding="async" />
            <span className="player__art-badge" aria-hidden="true">
              <svg viewBox="0 0 20 20">
                {roomMoving ? (
                  <>
                    <rect x="6.2" y="5.5" width="2.3" height="9" rx="0.6" />
                    <rect x="11.5" y="5.5" width="2.3" height="9" rx="0.6" />
                  </>
                ) : (
                  <path d="M7.6 5.4v9.2a.5.5 0 0 0 .76.43l7.1-4.6a.5.5 0 0 0 0-.84l-7.1-4.6a.5.5 0 0 0-.76.42z" />
                )}
              </svg>
            </span>
          </button>
        )}

        <p className="player__title" aria-live="polite">
          {started ? track.title : 'Lo-fi radio'}
        </p>
        <p className="player__meta">{meta}</p>

        <span className="player__progress" aria-hidden="true">
          <span ref={progressRef} className="player__progress-fill" />
        </span>
        <span className="player__clock" aria-hidden="true">
          <span ref={timeRef}>0:00</span> / <span ref={durationRef}>{clock(track.duration)}</span>
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
          {started && (
            <button type="button" className="player__tool" aria-label="Next track" title="Next track" onClick={roomRadio().next}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.5 6.5v11l8-5.5zM17.5 6.5v11" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="player__button"
            data-playing={on ? '' : undefined}
            onClick={roomRadio().toggle}
            aria-label={on ? 'Pause the radio' : 'Play the lo-fi radio'}
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
