import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { STATIONS } from '../../audio/playlist'
import { rainLevelOf, roomRadio } from '../../audio/radio'
import { useRoomRadio } from '../../audio/useRoomRadio'
import { StationIcon } from './StationIcon'

interface SoundSheetProps {
  id: string
  /** The player and its sheet: a press outside both closes the sheet. */
  dockRef: RefObject<HTMLDivElement | null>
  onClose: (returnFocus: boolean) => void
}

/**
 * The focus player's sound: three stations to choose between (each with a
 * Spotify playlist to carry on with), and the mix: how loud the music and the
 * rain are. It rises from the player in the same glass, and closes on Esc or a
 * press outside it.
 */
export function SoundSheet({ id, dockRef, onClose }: SoundSheetProps) {
  const radio = useRoomRadio()
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    sheetRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose(true)
    }
    const onPointer = (event: PointerEvent) => {
      if (!dockRef.current?.contains(event.target as Node)) onClose(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [dockRef, onClose])

  const rain = rainLevelOf(radio)
  const on = radio.status === 'playing' || radio.status === 'loading'

  return (
    <div ref={sheetRef} id={id} className="sound" role="dialog" aria-label="Sound">
      <p className="sound__heading" id={`${id}-stations`}>
        Station
      </p>
      <ul className="sound__stations" aria-labelledby={`${id}-stations`}>
        {STATIONS.map((station) => {
          const chosen = station.id === radio.station
          return (
            <li key={station.id} className="sound__station" data-chosen={chosen ? '' : undefined}>
              <button
                type="button"
                className="sound__choose"
                aria-pressed={chosen}
                onClick={() => roomRadio().setStation(station.id)}
              >
                <span className="sound__icon" aria-hidden="true">
                  <StationIcon station={station.id} playing={chosen && on} />
                </span>
                <span className="sound__text">
                  <span className="sound__name">{station.name}</span>
                  <span className="sound__blurb">{station.blurb}</span>
                </span>
              </button>
              <a
                className="sound__spotify"
                href={station.spotify.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${station.spotify.name} on Spotify`}
                title={`${station.spotify.name} on Spotify`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M7.2 9.6c3.3-1 6.9-.7 9.8.9M7.8 12.6c2.7-.8 5.6-.5 8 .8M8.5 15.4c2.1-.6 4.2-.4 6 .6" />
                </svg>
              </a>
            </li>
          )
        })}
      </ul>

      <p className="sound__heading">Mix</p>
      <label className="sound__level">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 17.5V6l9-2v11.5" />
          <circle cx="6.8" cy="17.5" r="2.3" />
          <circle cx="15.8" cy="15.5" r="2.3" />
        </svg>
        <span>Music</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(radio.musicLevel * 100)}
          aria-valuetext={`${Math.round(radio.musicLevel * 100)}%`}
          style={{ '--level': radio.musicLevel } as CSSProperties}
          onChange={(event) => roomRadio().setMusicLevel(Number(event.target.value) / 100)}
        />
      </label>
      <label className="sound__level">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8.6 4.5 7 9M13.6 4.5 12 9M18.6 4.5 17 9M7.1 12.5l-1.6 4.5M12.1 12.5l-1.6 4.5M17.1 12.5l-1.6 4.5" />
        </svg>
        <span>Rain</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(rain * 100)}
          aria-valuetext={rain ? `${Math.round(rain * 100)}%` : 'Off'}
          style={{ '--level': rain } as CSSProperties}
          onChange={(event) => roomRadio().setRainLevel(Number(event.target.value) / 100)}
        />
      </label>
    </div>
  )
}
