/**
 * "What I'm listening to": a portable handler that asks Spotify what is playing
 * (or what played last) and returns only public track details.
 *
 * It uses nothing but the standard fetch / Request / Response APIs, so the same
 * code runs as the dev route in vite.config.ts, a Netlify function
 * (netlify/functions/now-playing.ts), a Vercel function (api/now-playing.ts) or
 * a Cloudflare Worker. Secrets come from the environment and never leave it.
 *
 * Response shapes (what src/hooks/useNowPlaying.ts reads):
 *   200 { isPlaying, title, artist, album?, imageUrl?, url, playedAt? }
 *   204 nothing playing and nothing played recently
 *   503 { error: 'not_configured', missing: [...names] }  secrets not set
 *   502 { error: 'spotify_error', status }                 Spotify refused or failed
 */

export interface NowPlayingEnv {
  SPOTIFY_CLIENT_ID?: string
  SPOTIFY_CLIENT_SECRET?: string
  SPOTIFY_REFRESH_TOKEN?: string
  /**
   * Origins allowed to read the feed from another domain, comma separated,
   * e.g. "https://susana.example". Leave empty when the site and the feed share
   * a domain (the usual case, and the dev route).
   */
  NOW_PLAYING_ALLOW_ORIGIN?: string
}

export interface NowPlayingTrack {
  isPlaying: boolean
  title: string
  artist: string
  album?: string
  imageUrl?: string
  url: string
  playedAt?: string
}

interface Options {
  /** Read on every request, so a refreshed .env.local is picked up without a restart. */
  env: NowPlayingEnv | (() => NowPlayingEnv)
  fetch?: typeof fetch
  now?: () => number
}

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const CURRENT_URL = 'https://api.spotify.com/v1/me/player/currently-playing'
const RECENT_URL = 'https://api.spotify.com/v1/me/player/recently-played?limit=1'
/** How long to wait for each Spotify request before answering with a 502 instead. */
const TIMEOUT_MS = 5000
const REQUIRED = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REFRESH_TOKEN'] as const

class SpotifyError extends Error {
  constructor(
    readonly step: 'token' | 'current' | 'recent',
    readonly status: number,
  ) {
    super(`Spotify ${step} request failed (${status})`)
  }
}

/* ── Turning Spotify's objects into the public shape ── */

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

export function toTrack(item: unknown, isPlaying: boolean, playedAt?: string): NowPlayingTrack | null {
  if (!isObject(item) || (item.type !== undefined && item.type !== 'track')) return null
  const title = text(item.name)
  const artists = Array.isArray(item.artists) ? item.artists.map((a) => (isObject(a) ? text(a.name) : undefined)).filter(Boolean) : []
  const urls = isObject(item.external_urls) ? item.external_urls : {}
  const url = text(urls.spotify)
  if (!title || artists.length === 0 || !url || !url.startsWith('https://open.spotify.com/')) return null

  const album = isObject(item.album) ? item.album : {}
  const images = Array.isArray(album.images) ? album.images.filter(isObject) : []
  // Spotify lists covers largest first; the ~300px one suits the deck and the footer.
  const image = text((images[1] ?? images[0])?.url)
  return {
    isPlaying,
    title,
    artist: artists.join(', '),
    album: text(album.name),
    imageUrl: image?.startsWith('https://') ? image : undefined,
    url,
    ...(playedAt ? { playedAt } : {}),
  }
}

/* ── The handler ── */

export function createNowPlaying({ env, fetch: fetchImpl = fetch, now = Date.now }: Options) {
  let cached: { token: string; expires: number; key: string } | null = null

  const accessToken = async (e: Required<Pick<NowPlayingEnv, (typeof REQUIRED)[number]>>) => {
    const key = `${e.SPOTIFY_CLIENT_ID}:${e.SPOTIFY_REFRESH_TOKEN}`
    if (cached && cached.key === key && cached.expires > now()) return cached.token
    const response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Basic ${btoa(`${e.SPOTIFY_CLIENT_ID}:${e.SPOTIFY_CLIENT_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: e.SPOTIFY_REFRESH_TOKEN }).toString(),
    })
    if (!response.ok) throw new SpotifyError('token', response.status)
    const data: unknown = await response.json()
    const token = isObject(data) ? text(data.access_token) : undefined
    if (!token) throw new SpotifyError('token', response.status)
    const lifetime = isObject(data) && typeof data.expires_in === 'number' ? data.expires_in : 3600
    // Refresh a minute early so a token never expires mid-request.
    cached = { token, key, expires: now() + Math.max(0, lifetime - 60) * 1000 }
    return token
  }

  const lookup = async (e: Required<Pick<NowPlayingEnv, (typeof REQUIRED)[number]>>): Promise<NowPlayingTrack | null> => {
    const headers = { Authorization: `Bearer ${await accessToken(e)}` }

    const current = await fetchImpl(CURRENT_URL, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (current.status === 200) {
      const data: unknown = await current.json()
      if (isObject(data)) {
        const track = toTrack(data.item, data.is_playing === true)
        if (track) return track
      }
    } else if (current.status !== 204) {
      if (current.status === 401) cached = null
      throw new SpotifyError('current', current.status)
    }

    const recent = await fetchImpl(RECENT_URL, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!recent.ok) {
      if (recent.status === 401) cached = null
      throw new SpotifyError('recent', recent.status)
    }
    const data: unknown = await recent.json()
    const last = isObject(data) && Array.isArray(data.items) && isObject(data.items[0]) ? data.items[0] : null
    return last ? toTrack(last.track, false, text(last.played_at)) : null
  }

  return async function handleNowPlaying(request?: Request): Promise<Response> {
    const e = typeof env === 'function' ? env() : env
    const cors = corsHeaders(request, e.NOW_PLAYING_ALLOW_ORIGIN)

    if (request?.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS' } })
    }
    if (request && request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'method_not_allowed' }, 405, { ...cors, Allow: 'GET, OPTIONS' })
    }

    const missing = REQUIRED.filter((name) => !e[name]?.trim())
    if (missing.length > 0) return json({ error: 'not_configured', missing }, 503, { ...cors, 'Cache-Control': 'no-store' })

    try {
      const track = await lookup({
        SPOTIFY_CLIENT_ID: e.SPOTIFY_CLIENT_ID!.trim(),
        SPOTIFY_CLIENT_SECRET: e.SPOTIFY_CLIENT_SECRET!.trim(),
        SPOTIFY_REFRESH_TOKEN: e.SPOTIFY_REFRESH_TOKEN!.trim(),
      })
      const cache = { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' }
      if (!track) return new Response(null, { status: 204, headers: { ...cors, ...cache } })
      return json(track, 200, { ...cors, ...cache })
    } catch (error) {
      const status = error instanceof SpotifyError ? error.status : 0
      const step = error instanceof SpotifyError ? error.step : 'network'
      return json({ error: 'spotify_error', step, status }, 502, { ...cors, 'Cache-Control': 'no-store' })
    }
  }
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } })
}

/** Cross-origin access only for the origins listed in NOW_PLAYING_ALLOW_ORIGIN. */
export function corsHeaders(request: Request | undefined, allow: string | undefined): Record<string, string> {
  const origins = (allow ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean)
  if (origins.length === 0) return {}
  if (origins.includes('*')) return { 'Access-Control-Allow-Origin': '*' }
  const origin = request?.headers.get('Origin')?.replace(/\/$/, '')
  const headers: Record<string, string> = { Vary: 'Origin' }
  if (origin && origins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}
