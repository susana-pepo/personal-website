import { describe, expect, it, vi } from 'vitest'
import { corsHeaders, createNowPlaying, type NowPlayingEnv } from '../../server/nowPlaying'

const ENV: NowPlayingEnv = {
  SPOTIFY_CLIENT_ID: 'client-id',
  SPOTIFY_CLIENT_SECRET: 'client-secret',
  SPOTIFY_REFRESH_TOKEN: 'refresh-token',
}

const TRACK = {
  type: 'track',
  name: 'Test Song',
  artists: [{ name: 'First Artist' }, { name: 'Second Artist' }],
  album: {
    name: 'Test Album',
    images: [{ url: 'https://i.scdn.co/image/large' }, { url: 'https://i.scdn.co/image/medium' }, { url: 'https://i.scdn.co/image/small' }],
  },
  external_urls: { spotify: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' },
}

type Route = (url: string, init?: RequestInit) => Response

/** A fake Spotify: token endpoint plus whatever the test says for the player endpoints. */
function fakeSpotify(routes: { current?: Route; recent?: Route; token?: Route }) {
  const calls: string[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push(url)
    if (url.startsWith('https://accounts.spotify.com/api/token')) {
      return routes.token?.(url, init) ?? Response.json({ access_token: 'access-token', expires_in: 3600 })
    }
    if (url.includes('/currently-playing')) return routes.current?.(url, init) ?? new Response(null, { status: 204 })
    if (url.includes('/recently-played')) return routes.recent?.(url, init) ?? Response.json({ items: [] })
    throw new Error(`unexpected request ${url}`)
  })
  return { fetch: fetchMock as unknown as typeof fetch, calls, mock: fetchMock }
}

describe('now-playing handler', () => {
  it('returns the track that is playing right now', async () => {
    const spotify = fakeSpotify({ current: () => Response.json({ is_playing: true, currently_playing_type: 'track', item: TRACK }) })
    const response = await createNowPlaying({ env: ENV, fetch: spotify.fetch })(new Request('http://localhost/api/now-playing'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      isPlaying: true,
      title: 'Test Song',
      artist: 'First Artist, Second Artist',
      album: 'Test Album',
      imageUrl: 'https://i.scdn.co/image/medium',
      url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
    })
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=30')
    expect(spotify.calls.some((u) => u.includes('recently-played'))).toBe(false)

    // The refresh exchange uses Basic auth from the client id and secret.
    const tokenInit = spotify.mock.mock.calls[0]![1] as RequestInit
    expect((tokenInit.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa('client-id:client-secret')}`)
    expect(String(tokenInit.body)).toContain('grant_type=refresh_token')
  })

  it('falls back to the last played track when nothing is playing', async () => {
    const spotify = fakeSpotify({
      current: () => new Response(null, { status: 204 }),
      recent: () => Response.json({ items: [{ track: TRACK, played_at: '2026-11-23T08:00:00.000Z' }] }),
    })
    const response = await createNowPlaying({ env: ENV, fetch: spotify.fetch })()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ isPlaying: false, title: 'Test Song', playedAt: '2026-11-23T08:00:00.000Z' })
  })

  it('treats a podcast episode as not a track and uses the last played song instead', async () => {
    const spotify = fakeSpotify({
      current: () => Response.json({ is_playing: true, currently_playing_type: 'episode', item: null }),
      recent: () => Response.json({ items: [{ track: TRACK, played_at: '2026-11-23T08:00:00.000Z' }] }),
    })
    const body = await (await createNowPlaying({ env: ENV, fetch: spotify.fetch })()).json()
    expect(body.isPlaying).toBe(false)
  })

  it('answers 204 when there is nothing to show', async () => {
    const spotify = fakeSpotify({})
    const response = await createNowPlaying({ env: ENV, fetch: spotify.fetch })()
    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
  })

  it('answers 502 without details when Spotify refuses', async () => {
    const spotify = fakeSpotify({ current: () => new Response('rate limited', { status: 429 }) })
    const response = await createNowPlaying({ env: ENV, fetch: spotify.fetch })()
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'spotify_error', step: 'current', status: 429 })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('answers 502 when the refresh token is rejected, and never echoes secrets', async () => {
    const spotify = fakeSpotify({ token: () => Response.json({ error: 'invalid_grant' }, { status: 400 }) })
    const response = await createNowPlaying({ env: ENV, fetch: spotify.fetch })()
    const text = await response.text()
    expect(response.status).toBe(502)
    expect(text).toContain('"step":"token"')
    for (const secret of Object.values(ENV)) expect(text).not.toContain(secret)
  })

  it('answers 502 when Spotify cannot be reached at all', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    const response = await createNowPlaying({ env: ENV, fetch: failing })()
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ step: 'network' })
  })

  it('answers 503 naming (not showing) the missing secrets, without calling Spotify', async () => {
    const spotify = fakeSpotify({})
    const response = await createNowPlaying({ env: { SPOTIFY_CLIENT_ID: 'client-id' }, fetch: spotify.fetch })()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'not_configured', missing: ['SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REFRESH_TOKEN'] })
    expect(spotify.mock).not.toHaveBeenCalled()
  })

  it('reuses the access token until shortly before it expires', async () => {
    let clock = 0
    const spotify = fakeSpotify({})
    const handle = createNowPlaying({ env: ENV, fetch: spotify.fetch, now: () => clock })
    await handle()
    await handle()
    expect(spotify.calls.filter((u) => u.includes('/api/token'))).toHaveLength(1)
    clock = 3600_000
    await handle()
    expect(spotify.calls.filter((u) => u.includes('/api/token'))).toHaveLength(2)
  })

  it('drops tracks without a Spotify link or an https cover', async () => {
    const spotify = fakeSpotify({
      current: () =>
        Response.json({
          is_playing: true,
          item: { ...TRACK, album: { name: 'A', images: [{ url: 'http://insecure/cover' }] } },
        }),
    })
    const body = await (await createNowPlaying({ env: ENV, fetch: spotify.fetch })()).json()
    expect(body.imageUrl).toBeUndefined()

    const local = fakeSpotify({ current: () => Response.json({ is_playing: true, item: { ...TRACK, external_urls: { spotify: 'https://evil.example/x' } } }) })
    expect((await createNowPlaying({ env: ENV, fetch: local.fetch })()).status).toBe(204)
  })

  it('handles preflight and rejects other methods', async () => {
    const handle = createNowPlaying({ env: ENV, fetch: fakeSpotify({}).fetch })
    expect((await handle(new Request('http://localhost/api/now-playing', { method: 'OPTIONS' }))).status).toBe(204)
    expect((await handle(new Request('http://localhost/api/now-playing', { method: 'POST' }))).status).toBe(405)
  })
})

describe('corsHeaders', () => {
  const from = (origin: string) => new Request('https://feed.example/api/now-playing', { headers: { Origin: origin } })

  it('adds nothing when no origin is configured (same-origin use)', () => {
    expect(corsHeaders(from('https://anywhere.example'), undefined)).toEqual({})
    expect(corsHeaders(from('https://anywhere.example'), ' ')).toEqual({})
  })

  it('allows only the configured origins', () => {
    const allow = 'https://susana.example/, https://preview.susana.example'
    expect(corsHeaders(from('https://susana.example'), allow)).toEqual({ Vary: 'Origin', 'Access-Control-Allow-Origin': 'https://susana.example' })
    expect(corsHeaders(from('https://preview.susana.example'), allow)['Access-Control-Allow-Origin']).toBe('https://preview.susana.example')
    expect(corsHeaders(from('https://other.example'), allow)).toEqual({ Vary: 'Origin' })
  })

  it('supports a wildcard when explicitly asked for', () => {
    expect(corsHeaders(from('https://other.example'), '*')).toEqual({ 'Access-Control-Allow-Origin': '*' })
  })
})
