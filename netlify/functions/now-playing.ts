/**
 * Netlify Functions (v2) wrapper around server/nowPlaying.ts. Not deployed.
 *
 * Served at /api/now-playing on the same domain as the site, so the site can use
 * VITE_NOW_PLAYING_URL=/api/now-playing. Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
 * and SPOTIFY_REFRESH_TOKEN in Netlify's environment variables (never in the repo).
 */
import { createNowPlaying } from '../../server/nowPlaying'

const handle = createNowPlaying({ env: () => process.env })

export default (request: Request) => handle(request)

export const config = { path: '/api/now-playing' }
