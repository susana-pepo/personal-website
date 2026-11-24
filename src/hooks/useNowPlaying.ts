import { useSyncExternalStore } from 'react'

/**
 * "What I'm listening to", from Spotify.
 *
 * Spotify's API needs a private refresh token, so the browser never talks to
 * Spotify directly. Instead, set VITE_NOW_PLAYING_URL to the small endpoint in
 * server/nowPlaying.ts (see docs/spotify-now-playing.md). Locally that is the
 * dev route `/api/now-playing`; a full https:// URL works too. It returns:
 *
 *   { "isPlaying": true, "title": "…", "artist": "…", "album": "…",
 *     "imageUrl": "https://i.scdn.co/…", "url": "https://open.spotify.com/track/…",
 *     "playedAt": "2026-11-23T08:00:00Z" }
 *
 * Until it is set, nothing is fetched and nothing is shown. No placeholder tracks.
 */
export interface NowPlayingTrack {
  isPlaying: boolean
  title: string
  artist: string
  album?: string
  imageUrl?: string
  url: string
  playedAt?: string
}

export type NowPlayingState =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'ready'; track: NowPlayingTrack }
  | { status: 'empty' }
  /** httpStatus: 503 means the server has no Spotify secrets yet; 0 means the request itself failed. */
  | { status: 'error'; httpStatus?: number }

const ENDPOINT = import.meta.env.VITE_NOW_PLAYING_URL?.trim() || ''
const REFRESH_MS = 60_000

function parseTrack(data: unknown): NowPlayingTrack | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const title = str(d.title)
  const artist = str(d.artist)
  const url = str(d.url)
  if (!title || !artist || !url || !/^https:\/\/open\.spotify\.com\//.test(url)) return null
  const imageUrl = str(d.imageUrl)
  return {
    isPlaying: d.isPlaying === true,
    title,
    artist,
    url,
    album: str(d.album),
    imageUrl: imageUrl && /^https:\/\//.test(imageUrl) ? imageUrl : undefined,
    playedAt: str(d.playedAt),
  }
}

export const nowPlayingConfigured = Boolean(ENDPOINT)

/*
 * One shared feed for the whole page: the footer's player and the Music panel
 * read the same state, so there is a single request every minute (and on
 * coming back to the tab), made only while something on the page is listening.
 */
let state: NowPlayingState = ENDPOINT ? { status: 'loading' } : { status: 'off' }
const listeners = new Set<() => void>()
let stopPolling: (() => void) | null = null

function set(next: NowPlayingState) {
  state = next
  listeners.forEach((listener) => listener())
}

async function load() {
  if (document.visibilityState === 'hidden') return
  try {
    const response = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } })
    if (response.status === 204) return set({ status: 'empty' })
    // A failed refresh keeps the track already shown.
    if (!response.ok) return set(state.status === 'ready' ? state : { status: 'error', httpStatus: response.status })
    const track = parseTrack(await response.json())
    set(track ? { status: 'ready', track } : { status: 'empty' })
  } catch {
    set(state.status === 'ready' ? state : { status: 'error', httpStatus: 0 })
  }
}

function startPolling() {
  void load()
  const timer = window.setInterval(load, REFRESH_MS)
  const onVisible = () => document.visibilityState === 'visible' && void load()
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (ENDPOINT && !stopPolling) stopPolling = startPolling()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && stopPolling) {
      stopPolling()
      stopPolling = null
    }
  }
}

export function useNowPlaying(): NowPlayingState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  )
}
