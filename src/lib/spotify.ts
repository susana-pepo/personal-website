/** Helpers for public Spotify links: parsing, embed URLs and cover/title lookup. */

export type SpotifyKind = 'album' | 'playlist' | 'track' | 'artist' | 'show' | 'episode'

export interface SpotifyRef {
  kind: SpotifyKind
  id: string
  url: string
}

const KIND_LABEL: Record<SpotifyKind, string> = {
  album: 'Album',
  playlist: 'Playlist',
  track: 'Song',
  artist: 'Artist',
  show: 'Podcast',
  episode: 'Episode',
}

export function parseSpotifyUrl(url: string): SpotifyRef | null {
  const match = /^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(album|playlist|track|artist|show|episode)\/([A-Za-z0-9]{22})/.exec(
    url.trim(),
  )
  if (!match) return null
  const kind = match[1] as SpotifyKind
  const id = match[2]!
  return { kind, id, url: `https://open.spotify.com/${kind}/${id}` }
}

export const kindLabel = (kind: SpotifyKind) => KIND_LABEL[kind]

/** Spotify's own embeddable player for this item. */
export function embedUrl(ref: SpotifyRef): string {
  return `https://open.spotify.com/embed/${ref.kind}/${ref.id}?utm_source=generator`
}

/** Compact player for single items, full height for collections. */
export function embedHeight(ref: SpotifyRef): number {
  return ref.kind === 'track' || ref.kind === 'episode' ? 152 : 352
}

export interface SpotifyMeta {
  title: string
  cover?: string
}

const cache = new Map<string, Promise<SpotifyMeta | null>>()

/** Title and cover from Spotify's public oEmbed endpoint (no account or key needed). */
export function fetchSpotifyMeta(ref: SpotifyRef): Promise<SpotifyMeta | null> {
  const cached = cache.get(ref.url)
  if (cached) return cached
  const request = fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(ref.url)}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((data: unknown) => {
      if (!data || typeof data !== 'object') return null
      const d = data as Record<string, unknown>
      const title = typeof d.title === 'string' ? d.title : ''
      const cover = typeof d.thumbnail_url === 'string' && d.thumbnail_url.startsWith('https://') ? d.thumbnail_url : undefined
      return title ? { title, cover } : null
    })
    .catch(() => null)
  cache.set(ref.url, request)
  return request
}
