import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { content } from '../../content/content'
import { stationById } from '../../audio/playlist'
import { clock, focusLeft, rainAudible, rainLevelOf, roomRadio } from '../../audio/radio'
import { useRainFromScene, useRoomRadio } from '../../audio/useRoomRadio'
import { DiscoveryHint } from '../DiscoveryHint/DiscoveryHint'
import { ROOM_POSTER_SRC } from '../../scene/layout'
import { SoundSheet } from './SoundSheet'
import { StationIcon } from './StationIcon'
import './SiteFooter.css'

/**
 * Beneath the room (the name, menu and scene control are in the masthead
 * above it): the "Focus with me" player at the room's left corner, and the
 * copyright small at the right; on a first visit, the "Explore the room" cue rests just inside
 * the room's bottom edge.
 *
 * The player is a small glass tile: the station's animated drawing (rain falling
 * across it when rain is in the mix), the
 * session's time left, a fine line that fills over the session, and two buttons:
 * sound (the station and the mix, in a sheet that rises from the tile) and
 * play / pause.
 */
export function SiteFooter() {
  const radio = useRoomRadio()
  useRainFromScene()
  const progressRef = useRef<HTMLSpanElement>(null)
  const leftRef = useRef<HTMLSpanElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const soundRef = useRef<HTMLButtonElement>(null)
  const sheetId = useId()
  const [sheetOpen, setSheetOpen] = useState(false)

  const on = radio.status === 'playing' || radio.status === 'loading'
  const inSession = on || radio.status === 'paused'
  const station = stationById(radio.station)
  const withRain = rainAudible(radio)
  const rainInMix = rainLevelOf(radio) > 0

  const closeSheet = useCallback((returnFocus: boolean) => {
    setSheetOpen(false)
    if (returnFocus) soundRef.current?.focus()
  }, [])

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
          ? `Paused · ${station.name}`
          : on
            ? `${station.name}${withRain ? ' · rain' : ''}`
            : `${station.name}${rainInMix ? ' and rain' : ''} · 25 min`

  return (
    <div className="credits">
      <div ref={dockRef} className="player-dock">
        {sheetOpen && <SoundSheet id={sheetId} dockRef={dockRef} onClose={closeSheet} />}

        <div className="player" role="group" aria-label="Focus with me" data-on={on ? '' : undefined}>
          <span className="player__ambient" aria-hidden="true">
            <img src={ROOM_POSTER_SRC} alt="" decoding="async" />
          </span>

          <span
            className="player__art player__focus"
            aria-hidden="true"
            data-on={on ? '' : undefined}
            data-rain={rainInMix ? '' : undefined}
          >
            <StationIcon station={radio.station} playing={on} />
            {/* rain in the mix: a few drops fall across the tile */}
            <svg className="player__drops" viewBox="0 0 40 40">
              <path d="M8 2v3.5" />
              <path d="M32 3v3.5" />
              <path d="M21 1v3.5" />
            </svg>
          </span>

          <p className="player__title">
            <span className="player__name">{radio.status === 'done' ? 'Nice focus' : 'Focus with me'}</span>
            {inSession && (
              <span ref={leftRef} className="player__left" title="Time left in this session">
                {clock(focusLeft(roomRadio().focus().elapsed))}
              </span>
            )}
          </p>
          <p className="player__meta" aria-live="polite">
            {on && (
              <span className="player__eq" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
            )}
            {meta}
          </p>

          <span className="player__progress" aria-hidden="true">
            <span ref={progressRef} className="player__progress-fill" />
          </span>

          <div className="player__buttons">
            <button
              ref={soundRef}
              type="button"
              className="player__tool"
              aria-label="Sound: station and mix"
              title="Station and mix"
              aria-expanded={sheetOpen}
              aria-controls={sheetOpen ? sheetId : undefined}
              onClick={() => setSheetOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 8h9M17.5 8h2M4.5 16h3M11.5 16h8" />
                <circle cx="15.5" cy="8" r="2" />
                <circle cx="9.5" cy="16" r="2" />
              </svg>
            </button>
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
      </div>

      <footer className="credits__copy">
        © {new Date().getFullYear()} {content.profile.fullName}
        {content.footer.note && <span> · {content.footer.note}</span>}
      </footer>

      <DiscoveryHint />
    </div>
  )
}
