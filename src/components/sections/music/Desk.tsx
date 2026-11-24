import { useEffect, useId, useRef, useState, type CSSProperties, type Ref } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { SpotifyPlayer } from './SpotifyPlayer'
import { CoverArt, Vinyl } from './Vinyl'
import type { CrateRecord } from './types'

/** Must match --dur-panel in tokens.css: the player drawer stays mounted while it closes. */
const DRAWER_MS = 420

const PLAY_ICON = <path d="M7.2 4.8v10.4l8.4-5.2z" fill="currentColor" />
const PAUSE_ICON = (
  <g fill="currentColor">
    <rect x="6" y="5" width="2.6" height="10" rx="0.5" />
    <rect x="11.4" y="5" width="2.6" height="10" rx="0.5" />
  </g>
)

interface DeskProps {
  record: CrateRecord
  /** The record has slid out of its sleeve and the notes have settled. */
  out: boolean
  /** The sleeve on the desk is drawn (hidden while the flying copy is on its way). */
  sleeveShown: boolean
  sleeveRef: Ref<HTMLDivElement>
  onPutBack: () => void
}

/** The record taken out of the crate: sleeve, vinyl, liner notes, and an opt-in player. */
export function Desk({ record, out, sleeveShown, sleeveRef, onPutBack }: DeskProps) {
  const reduced = usePrefersReducedMotion()
  const playerId = useId()
  const playerRef = useRef<HTMLDivElement>(null)
  const [player, setPlayer] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const canPlay = Boolean(record.spotify || (import.meta.env.DEV && record.sample))

  useEffect(() => {
    if (player) {
      setMounted(true)
      const timer = window.setTimeout(
        () =>
          playerRef.current?.scrollIntoView({
            block: 'nearest',
            behavior: reduced ? 'auto' : 'smooth',
          }),
        reduced ? 0 : DRAWER_MS,
      )
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => setMounted(false), reduced ? 0 : DRAWER_MS)
    return () => window.clearTimeout(timer)
  }, [player, reduced])

  // Samples have a stand-in player that "plays" while open.
  const turning = out && (record.sample ? player : playing)
  const kindLine = [record.kind, record.year].filter(Boolean).join(' · ')

  return (
    <div
      className="desk__inner"
      data-turning={turning ? '' : undefined}
      style={record.tint ? ({ '--player-tint': record.tint } as CSSProperties) : undefined}
    >
      <div className="desk__object" aria-hidden="true">
        <div className="desk__vinyl">
          <div className="desk__disc">
            <Vinyl cover={record.cover} art={record.art} />
            <span className="vinyl__sheen" />
          </div>
        </div>
        <div className="desk__sleeve" ref={sleeveRef} data-hidden={sleeveShown ? undefined : ''}>
          <CoverArt cover={record.cover} art={record.art} />
        </div>
      </div>

      <div className="desk__notes">
        {kindLine && <p className="desk__kind">{kindLine}</p>}
        <h4 className="desk__title">{record.title || 'Loading…'}</h4>
        {record.artist && <p className="desk__artist">{record.artist}</p>}
        {record.note && <p className="desk__note">{record.note}</p>}
        {(record.startWith || record.length) && (
          <dl className="desk__facts">
            {record.startWith && (
              <>
                <dt>Start with</dt>
                <dd>
                  <span className="desk__num">{record.startWith.number}</span>
                  {record.startWith.title}
                </dd>
              </>
            )}
            {record.length && (
              <>
                <dt>Length</dt>
                <dd>{record.length}</dd>
              </>
            )}
          </dl>
        )}
        <div className="desk__actions">
          {canPlay && (
            <button
              type="button"
              className="desk__play"
              aria-expanded={player}
              aria-controls={playerId}
              onClick={() => setPlayer((on) => !on)}
            >
              <span className="desk__play-disc" aria-hidden="true">
                <svg viewBox="0 0 20 20" focusable="false">
                  {player ? PAUSE_ICON : PLAY_ICON}
                </svg>
              </span>
              <span>{player ? 'Close player' : 'Play here'}</span>
            </button>
          )}
          {record.spotify && (
            <a className="text-link" href={record.spotify.url} target="_blank" rel="noreferrer">
              Open in Spotify
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          )}
          <button type="button" className="text-button text-link" onClick={onPutBack}>
            Put it back
          </button>
        </div>
      </div>

      <div className="desk__player" id={playerId} ref={playerRef} data-open={player ? '' : undefined}>
        <div>
          {mounted &&
            (record.spotify ? (
              <SpotifyPlayer
                item={record.spotify}
                title={`Spotify player: ${record.title || record.kind}`}
                onPlayingChange={setPlaying}
              />
            ) : import.meta.env.DEV ? (
              <StandInPlayer record={record} />
            ) : null)}
        </div>
      </div>
    </div>
  )
}

/** Development samples: a drawing of the player, so nothing is ever loaded for a record that isn't real. */
function StandInPlayer({ record }: { record: CrateRecord }) {
  return (
    <div className="desk__stand-in">
      <div className="desk__stand-in-art">
        <CoverArt cover={record.cover} art={record.art} />
      </div>
      <div>
        <p className="desk__stand-in-title">{record.title}</p>
        <p className="desk__stand-in-artist">{record.artist}</p>
        <div className="desk__stand-in-bar">
          <i />
        </div>
      </div>
    </div>
  )
}
