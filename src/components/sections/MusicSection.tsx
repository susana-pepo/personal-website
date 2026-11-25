import { useEffect, useId, useLayoutEffect, useRef, type RefObject } from 'react'
import { content } from '../../content/content'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { nowPlayingConfigured, useNowPlaying, type NowPlayingTrack } from '../../hooks/useNowPlaying'
import { DESKTOP_QUERY } from './bookshelf/layout'
import { SpotifyCollection } from './SpotifyCollection'
import { fitSleeve, playedAgo } from './music/crate'
import { Turntable } from './music/Turntable'
import './music/music.css'

/** featured: the chosen record on the turntable (no live feed), never presented as live listening. */
type DeckState = { status: 'loading' } | { status: 'ready'; track: NowPlayingTrack; featured?: boolean }

/** The deck itself: the room's record player with the track beside it, as one link to Spotify. */
function Deck({ state, headingId }: { state: DeckState; headingId: string }) {
  const { listening } = content.music
  const featured = state.status === 'ready' && Boolean(state.featured)
  const live = state.status === 'ready' && !featured && state.track.isPlaying
  const ago = state.status === 'ready' && !live && !featured ? playedAgo(state.track.playedAt) : ''

  return (
    <section
      className="deck"
      aria-labelledby={headingId}
      data-state={state.status === 'loading' ? 'loading' : featured ? 'featured' : live ? 'live' : 'recent'}
    >
      {/* The record player says it on its own, so the heading is kept for screen readers only:
          the page opens straight on the deck, and fits its first view. */}
      <h3 id={headingId} className="visually-hidden">
        {listening.heading}
      </h3>
      {listening.description && <p className="music-head__description">{listening.description}</p>}
      {state.status === 'loading' ? (
        <div className="deck__loading" role="status">
          <span className="visually-hidden">Loading</span>
        </div>
      ) : (
        <a className="deck__track" href={state.track.url} target="_blank" rel="noreferrer">
          <Turntable cover={state.track.imageUrl} playing={live || featured} />
          <span className="deck__text">
            <span className="deck__status">
              {featured ? listening.turntableLabel : live ? listening.liveLabel : listening.recentLabel}
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

/**
 * "What I'm listening to": the live Spotify feed when there is one; otherwise (as on
 * the published site, which has no feed) the record chosen in content.ts, labelled
 * "On the turntable". Hidden only if neither exists.
 */
function Listening() {
  const state = useNowPlaying()
  const headingId = useId()
  const httpStatus = state.status === 'error' ? state.httpStatus : undefined

  // In development, say in the console why the feed isn't showing. Visitors see nothing.
  useEffect(() => {
    if (import.meta.env.DEV && httpStatus !== undefined)
      console.info(`[music] Spotify feed unavailable: ${feedReason(httpStatus)}`)
  }, [httpStatus])

  const noFeed = !nowPlayingConfigured || state.status === 'error' || state.status === 'empty' || state.status === 'off'
  if (noFeed) return ON_TURNTABLE ? <Deck state={ON_TURNTABLE} headingId={headingId} /> : null
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

const chosen = content.music.listening.onTurntable
const ON_TURNTABLE: DeckState | null = chosen
  ? {
      status: 'ready',
      featured: true,
      track: { isPlaying: false, title: chosen.title, artist: chosen.artist, imageUrl: chosen.cover, url: chosen.url },
    }
  : null

/**
 * On a desktop window the panel floats beside the room, about as tall as it, and the Music page
 * fits it without scrolling: the sleeves take the height the rest of the page leaves (fitSleeve),
 * up to their full size (music.css). Measured again whenever the panel or the page changes size;
 * a desk that is out is left out of the sum, so taking a record out never resizes the shelves.
 */
function useFitSleeves(rootRef: RefObject<HTMLDivElement | null>) {
  const desktop = useMediaQuery(DESKTOP_QUERY)
  useLayoutEffect(() => {
    const root = rootRef.current
    const page = root?.closest<HTMLElement>('.panel__page')
    const body = root?.closest<HTMLElement>('.panel__body')
    if (!root) return
    if (!desktop || !page || !body) {
      root.style.removeProperty('--fit-s')
      return
    }
    const measure = () => {
      const height = (selector: string) =>
        [...root.querySelectorAll<HTMLElement>(selector)].reduce((sum, el) => sum + el.getBoundingClientRect().height, 0)
      const crates = root.querySelectorAll('.crate').length
      if (crates === 0) return
      const above = root.getBoundingClientRect().top - page.getBoundingClientRect().top
      const below = parseFloat(getComputedStyle(page).paddingBottom) || 0
      const fixed = above + root.getBoundingClientRect().height + below - height('.crate') - height('.desk-wrap')
      root.style.setProperty('--fit-s', `${fitSleeve(body.clientHeight, fixed, crates)}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    observer.observe(root)
    return () => observer.disconnect()
  }, [desktop, rootRef])
}

export default function MusicSection() {
  const { music } = content
  const rootRef = useRef<HTMLDivElement>(null)
  useFitSleeves(rootRef)
  return (
    <div className="section music" ref={rootRef}>
      {music.intro && <p className="lede">{music.intro}</p>}
      <Listening />
      <SpotifyCollection />
      <SpotifyCollection variant="podcasts" />
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
