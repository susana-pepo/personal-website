import { useEffect, useId } from 'react'
import { content } from '../../content/content'
import { nowPlayingConfigured, useNowPlaying, type NowPlayingTrack } from '../../hooks/useNowPlaying'
import { SpotifyCollection } from './SpotifyCollection'
import { playedAgo } from './music/crate'
import { Turntable } from './music/Turntable'
import './music/music.css'

type DeckState = { status: 'loading' } | { status: 'ready'; track: NowPlayingTrack; sample?: boolean }

/** The deck itself: the room's record player with the track beside it, as one link to Spotify. */
function Deck({ state, headingId }: { state: DeckState; headingId: string }) {
  const { listening } = content.music
  const live = state.status === 'ready' && state.track.isPlaying
  const ago = state.status === 'ready' && !live ? playedAgo(state.track.playedAt) : ''

  return (
    <section
      className="deck"
      aria-labelledby={headingId}
      data-state={state.status === 'loading' ? 'loading' : live ? 'live' : 'recent'}
    >
      <div className="music-head">
        <h3 id={headingId} className="music-head__title">
          {listening.heading}
        </h3>
        {listening.description && <p className="music-head__description">{listening.description}</p>}
      </div>
      {state.status === 'loading' ? (
        <div className="deck__loading" role="status">
          <span className="visually-hidden">Loading</span>
        </div>
      ) : (
        <a
          className="deck__track"
          href={state.track.url}
          target="_blank"
          rel="noreferrer"
          onClick={state.sample ? (event) => event.preventDefault() : undefined}
        >
          <Turntable cover={state.track.imageUrl} playing={live} />
          <span className="deck__text">
            <span className="deck__status">
              {live ? listening.liveLabel : listening.recentLabel}
              {ago ? ` · ${ago}` : ''}
            </span>
            <span className="deck__title">{state.track.title}</span>
            <span className="deck__artist">
              {state.track.artist}
              {state.track.album ? `, ${state.track.album}` : ''}
            </span>
            <span className="deck__open">
              Open in Spotify<span className="visually-hidden"> (new tab)</span>
            </span>
          </span>
        </a>
      )}
    </section>
  )
}

/** "What I'm listening to", from the Spotify feed. Hidden until one is connected. */
function Listening() {
  const state = useNowPlaying()
  const headingId = useId()
  const httpStatus = state.status === 'error' ? state.httpStatus : undefined

  // In development, say in the console why the block is hidden. Visitors see nothing.
  useEffect(() => {
    if (import.meta.env.DEV && httpStatus !== undefined)
      console.info(`[music] Spotify feed unavailable: ${feedReason(httpStatus)}`)
  }, [httpStatus])

  if (!nowPlayingConfigured) return import.meta.env.DEV ? <Deck state={SAMPLE_STATE} headingId={headingId} /> : null
  if (state.status === 'error' || state.status === 'empty' || state.status === 'off') return null
  return <Deck state={state} headingId={headingId} />
}

const feedReason = (status: number) =>
  status === 503
    ? 'no Spotify keys yet (see docs/spotify-now-playing.md).'
    : status === 502
      ? 'Spotify refused the request. Run npm run spotify:auth again.'
      : status
        ? `the feed answered ${status}.`
        : 'the feed could not be reached.'

/** Development only, while no feed is connected: a sample track in the deck. */
const SAMPLE_STATE: DeckState = {
  status: 'ready',
  sample: true,
  track: {
    isPlaying: true,
    title: 'Sample track title',
    artist: 'Placeholder Trio',
    album: 'Sample album',
    url: 'https://open.spotify.com/',
  },
}

export default function MusicSection() {
  const { music } = content
  return (
    <div className="section">
      {music.intro && <p className="lede">{music.intro}</p>}
      <Listening />
      <SpotifyCollection />
      {music.cards.length > 0 && (
        <ul className="music-grid" role="list">
          {music.cards.map((card) => (
            <li key={card.id} className="music-card">
              <p className="music-card__eyebrow">{card.eyebrow}</p>
              <h3 className="music-card__title">{card.title}</h3>
              <p className="music-card__body">{card.body}</p>
              {card.link && (
                <a className="music-card__link text-link" href={card.link.href} target="_blank" rel="noreferrer">
                  {card.link.label}
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {music.closing && <p className="section__closing">{music.closing}</p>}
    </div>
  )
}
