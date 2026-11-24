/**
 * The focus player's stations, and the rain outside.
 *
 * Every file here is CC0 (public domain): free to stream, no credit required.
 * Sources and licences are listed in public/media/audio/CREDITS.md. Add a track
 * only if its own page says CC0 (or another licence that allows streaming on a
 * website), and note it there.
 */

export interface RadioTrack {
  title: string
  artist: string
  /** Under public/, 96 kbps AAC. */
  src: string
  /** Seconds, so the clock can show a length before anything has loaded. */
  duration: number
}

const ARTIST = 'HoliznaCC0'

export const PLAYLIST: readonly RadioTrack[] = [
  { title: 'Snow Drift', artist: ARTIST, src: '/media/audio/radio/snow-drift.m4a', duration: 174 },
  { title: 'Fire Place', artist: ARTIST, src: '/media/audio/radio/fire-place.m4a', duration: 170 },
  { title: 'Winter Blues', artist: ARTIST, src: '/media/audio/radio/winter-blues.m4a', duration: 223 },
  { title: 'First Snow', artist: ARTIST, src: '/media/audio/radio/first-snow.m4a', duration: 174 },
  { title: '2 Hour Delay', artist: ARTIST, src: '/media/audio/radio/two-hour-delay.m4a', duration: 132 },
]

/**
 * Classical: Bach's Goldberg Variations (Kimiko Ishizaka, the Open Goldberg Variations)
 * between Chopin nocturnes (Musopen), all on piano, the calmer pieces only.
 */
const BACH = 'Kimiko Ishizaka'
const CHOPIN = 'Musopen'

export const CLASSICAL: readonly RadioTrack[] = [
  { title: 'Bach: Goldberg Variations, Aria', artist: BACH, src: '/media/audio/classical/goldberg-aria.m4a', duration: 300 },
  { title: 'Chopin: Nocturne Op. 9 No. 2', artist: CHOPIN, src: '/media/audio/classical/nocturne-op9-2.m4a', duration: 277 },
  { title: 'Bach: Goldberg Variations, Var. 13', artist: BACH, src: '/media/audio/classical/goldberg-var13.m4a', duration: 254 },
  { title: 'Chopin: Nocturne Op. 32 No. 1', artist: CHOPIN, src: '/media/audio/classical/nocturne-op32-1.m4a', duration: 301 },
  { title: 'Bach: Goldberg Variations, Var. 21', artist: BACH, src: '/media/audio/classical/goldberg-var21.m4a', duration: 235 },
  { title: 'Chopin: Nocturne Op. 55 No. 2', artist: CHOPIN, src: '/media/audio/classical/nocturne-op55-2.m4a', duration: 310 },
  { title: 'Chopin: Nocturne Op. 72 No. 1', artist: CHOPIN, src: '/media/audio/classical/nocturne-op72-1.m4a', duration: 273 },
  { title: 'Chopin: Nocturne Op. 62 No. 2', artist: CHOPIN, src: '/media/audio/classical/nocturne-op62-2.m4a', duration: 340 },
  {
    title: 'Bach: Goldberg Variations, Aria da capo',
    artist: BACH,
    src: '/media/audio/classical/goldberg-aria-da-capo.m4a',
    duration: 170,
  },
]

export type StationId = 'lofi' | 'binaural' | 'classical'

export interface Station {
  id: StationId
  name: string
  /** One line beneath the name in the sound sheet. */
  blurb: string
  /** Files to play in turn; empty for binaural, which is made in the browser (binaural.ts). */
  tracks: readonly RadioTrack[]
  /** A playlist to carry on with in Spotify. */
  spotify: { name: string; url: string }
}

export const STATIONS: readonly Station[] = [
  {
    id: 'lofi',
    name: 'Lo-fi beats',
    blurb: 'Soft beats and warm keys',
    tracks: PLAYLIST,
    spotify: { name: 'lofi beats', url: 'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn' },
  },
  {
    id: 'binaural',
    name: 'Binaural focus',
    blurb: 'A slow, steady hum · use headphones',
    tracks: [],
    spotify: { name: 'Deep Focus', url: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ' },
  },
  {
    id: 'classical',
    name: 'Classical',
    blurb: 'Bach and Chopin on piano',
    tracks: CLASSICAL,
    spotify: { name: 'Calming Classical', url: 'https://open.spotify.com/playlist/37i9dQZF1DWVFeEut75IAL' },
  },
]

export const isStationId = (value: unknown): value is StationId => STATIONS.some((s) => s.id === value)

export const stationById = (id: StationId): Station => STATIONS.find((s) => s.id === id) ?? STATIONS[0]!

/** Rain on a skylight, about 21 seconds, looped with a crossfade. */
export const RAIN_SRC = '/media/audio/rain.m4a'
