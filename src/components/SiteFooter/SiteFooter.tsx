import { useEffect, useRef, type RefObject } from 'react'
import { content } from '../../content/content'
import { useNowPlaying } from '../../hooks/useNowPlaying'
import { DiscoveryHint } from '../DiscoveryHint/DiscoveryHint'
import { ROOM_PLAYBACK_RATE, ROOM_POSTER_SRC, ROOM_VIDEO_SRC } from '../../scene/layout'
import type { ScenePlayback } from '../../hooks/useScenePlayback'
import './SiteFooter.css'

interface SiteFooterProps {
  playback: ScenePlayback
  videoRef: RefObject<HTMLVideoElement | null>
}

// Fallback until the video reports its own length; shown in real (slowed) seconds.
const LOOP_SECONDS = 8.04 / ROOM_PLAYBACK_RATE

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds) % 60).padStart(2, '0')}`

/**
 * Beneath the room (the name, menu and scene control are in the masthead
 * above it): the player widget, centred, and the copyright small at the right;
 * on a first visit, the "Explore the room" cue rests just inside the room's
 * bottom edge. The widget is a small 2×1 glass tile: artwork in
 * miniature on the left (the room itself, or the album cover once Spotify is
 * connected), then the title, a fine progress line for the room's loop, and the play / pause control for the room's animation.
 */
export function SiteFooter({ playback, videoRef }: SiteFooterProps) {
  const nowPlaying = useNowPlaying()
  const progressRef = useRef<HTMLSpanElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const durationRef = useRef<HTMLSpanElement>(null)
  const playing = !playback.isPausedByChoice && !playback.unavailable
  const track = nowPlaying.status === 'ready' ? nowPlaying.track : null
  // The miniature artwork: the album cover when Spotify says what's playing, otherwise the room.
  const art = track?.imageUrl ?? ROOM_POSTER_SRC

  // Follow the video's clock without re-rendering React on every frame.
  useEffect(() => {
    let frame = 0
    let lastText = ''
    const tick = () => {
      const video = videoRef.current
      // Clock in real seconds: the clip plays slowed, so divide media time by the rate.
      const rate = video?.playbackRate || ROOM_PLAYBACK_RATE
      const duration = video && Number.isFinite(video.duration) && video.duration > 0 ? video.duration / rate : LOOP_SECONDS
      const t = video ? video.currentTime / rate : 0
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${Math.min(1, t / duration)})`
      const text = clock(t)
      if (timeRef.current && text !== lastText) {
        timeRef.current.textContent = text
        lastText = text
      }
      const total = clock(duration)
      if (durationRef.current && durationRef.current.textContent !== total) durationRef.current.textContent = total
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [videoRef])

  return (
    <div className="credits">
      <div className="player" role="group" aria-label="Player" data-still={ROOM_VIDEO_SRC ? undefined : ''}>
        <span className="player__ambient" aria-hidden="true">
          <img src={art} alt="" decoding="async" />
        </span>

        <span className="player__art">
          <img src={art} alt={track ? `${track.album ?? track.title} cover` : ''} decoding="async" />
        </span>

        <div className="player__body">
          <div className="player__text">
            {track ? (
              <>
                <a className="player__title" href={track.url} target="_blank" rel="noreferrer">
                  {track.title}
                  <span className="visually-hidden"> by {track.artist}, on Spotify (opens in a new tab)</span>
                </a>
                <p className="player__meta" aria-hidden="true">
                  {track.isPlaying ? 'Listening now' : 'Last played'} · {track.artist}
                </p>
              </>
            ) : (
              <>
                <p className="player__title">The room</p>
                <p className="player__meta">{playing ? 'Playing' : 'Paused'}</p>
              </>
            )}
          </div>

          <div className="player__controls">
            {/* The loop's progress only exists when the room itself is a video. */}
            {ROOM_VIDEO_SRC && (
              <>
                <span className="player__progress" aria-hidden="true">
                  <span ref={progressRef} className="player__progress-fill" />
                </span>
                <span className="player__clock" aria-hidden="true">
                  <span ref={timeRef}>0:00</span> / <span ref={durationRef}>{clock(LOOP_SECONDS)}</span>
                </span>
              </>
            )}
            {!playback.unavailable && (
              <button
                type="button"
                className="player__button"
                data-playing={playing ? '' : undefined}
                onClick={playback.toggle}
                aria-label={playing ? 'Pause the room’s animation' : 'Play the room’s animation'}
              >
                <svg className="player__icon player__icon--pause" viewBox="0 0 20 20" aria-hidden="true">
                  <rect x="6.2" y="5.5" width="2.3" height="9" rx="0.6" />
                  <rect x="11.5" y="5.5" width="2.3" height="9" rx="0.6" />
                </svg>
                <svg className="player__icon player__icon--play" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M7.6 5.4v9.2a.5.5 0 0 0 .76.43l7.1-4.6a.5.5 0 0 0 0-.84l-7.1-4.6a.5.5 0 0 0-.76.42z" />
                </svg>
              </button>
            )}
          </div>
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
