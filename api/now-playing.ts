/**
 * Vercel Function wrapper around server/nowPlaying.ts (Web-standard handlers). Not deployed.
 *
 * Files in /api are served at /api/<name>, so the site can use
 * VITE_NOW_PLAYING_URL=/api/now-playing. Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
 * and SPOTIFY_REFRESH_TOKEN in the project's environment variables (never in the repo).
 */
import { createNowPlaying } from '../server/nowPlaying'

const handle = createNowPlaying({ env: () => process.env })

export function GET(request: Request) {
  return handle(request)
}

export function OPTIONS(request: Request) {
  return handle(request)
}
