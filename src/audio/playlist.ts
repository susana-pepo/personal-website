/**
 * The room radio: lo-fi that plays on the site itself, and the rain outside.
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

/** Rain on a skylight, about 21 seconds, looped with a crossfade. */
export const RAIN_SRC = '/media/audio/rain.m4a'
