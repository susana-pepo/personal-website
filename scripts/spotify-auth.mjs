#!/usr/bin/env node
/**
 * One-time Spotify sign-in for "What I'm listening to".
 *
 *   npm run spotify:auth
 *
 * 1. Reads SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET from .env.local (you paste them there).
 * 2. Prints a Spotify authorize URL and waits on http://127.0.0.1:8888/callback.
 * 3. After you approve in your browser, exchanges the code and writes
 *    SPOTIFY_REFRESH_TOKEN into .env.local (and VITE_NOW_PLAYING_URL=/api/now-playing
 *    if it isn't set yet).
 *
 * It never prints the client secret or the token.
 */
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const ENV_FILE = fileURLToPath(new URL('../.env.local', import.meta.url))
const HOST = '127.0.0.1'
const PORT = 8888
const REDIRECT_URI = `http://${HOST}:${PORT}/callback`
const SCOPES = 'user-read-currently-playing user-read-recently-played'
const TIMEOUT_MS = 5 * 60_000

const fail = (message) => {
  console.error(`\n${message}\n`)
  process.exit(1)
}

/* ── .env.local, read and updated line by line so nothing else in it changes ── */

function readEnvFile() {
  if (!existsSync(ENV_FILE)) return ''
  return readFileSync(ENV_FILE, 'utf8')
}

function parseEnv(text) {
  const values = {}
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!match) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    values[match[1]] = value.trim()
  }
  return values
}

function setEnvValue(text, name, value) {
  const line = `${name}=${value}`
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=.*$`, 'm')
  if (pattern.test(text)) return text.replace(pattern, line)
  return `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`
}

/* ── Checks before anything is opened ── */

const env = parseEnv(readEnvFile())
const clientId = env.SPOTIFY_CLIENT_ID
const clientSecret = env.SPOTIFY_CLIENT_SECRET
const missing = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'].filter((name) => !env[name])
if (missing.length > 0) {
  fail(
    [
      `Missing in .env.local: ${missing.join(', ')}`,
      '',
      'Add these two lines to .env.local in the project root (create the file if needed),',
      'with the values from your app at https://developer.spotify.com/dashboard:',
      '',
      '  SPOTIFY_CLIENT_ID=…',
      '  SPOTIFY_CLIENT_SECRET=…',
      '',
      `In that app's settings, the redirect URI must be exactly ${REDIRECT_URI}`,
      'Then run npm run spotify:auth again. See docs/spotify-now-playing.md.',
    ].join('\n'),
  )
}

/* ── The one-shot callback server ── */

const state = randomBytes(16).toString('hex')
const authorizeUrl =
  'https://accounts.spotify.com/authorize?' +
  new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: REDIRECT_URI, scope: SCOPES, state }).toString()

const page = (title, body) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
  `<body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#2a2421;background:#f1eee8">` +
  `<h1 style="font-size:1.4rem;font-weight:600">${title}</h1><p>${body}</p></body>`

async function exchange(code) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }).toString(),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || typeof data.refresh_token !== 'string') {
    // Only Spotify's error code and description: they never contain secrets.
    const reason = [data.error, data.error_description].filter(Boolean).join(': ') || `HTTP ${response.status}`
    throw new Error(`Spotify did not return a refresh token (${reason}).`)
  }
  return data.refresh_token
}

let finished = false
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', REDIRECT_URI)
  if (url.pathname !== '/callback') {
    res.writeHead(404).end()
    return
  }
  if (finished) {
    res.writeHead(410, { 'Content-Type': 'text/html; charset=utf-8' }).end(page('Already done', 'You can close this tab.'))
    return
  }
  const send = (status, title, body) => res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' }).end(page(title, body))

  if (url.searchParams.get('state') !== state) {
    send(400, 'That link is out of date', 'The sign-in did not match this run of the helper. Start again with npm run spotify:auth.')
    return
  }
  const denied = url.searchParams.get('error')
  if (denied) {
    finished = true
    send(400, 'Not connected', 'Spotify reported that access was not granted. You can close this tab.')
    done(`Spotify reported: ${denied}. Nothing was saved.`, 1)
    return
  }
  const code = url.searchParams.get('code')
  if (!code) {
    send(400, 'Something is missing', 'Spotify did not send a code. Start again with npm run spotify:auth.')
    return
  }

  finished = true
  try {
    const refreshToken = await exchange(code)
    let text = readEnvFile()
    text = setEnvValue(text, 'SPOTIFY_REFRESH_TOKEN', refreshToken)
    const addedFeedUrl = !parseEnv(text).VITE_NOW_PLAYING_URL
    if (addedFeedUrl) text = setEnvValue(text, 'VITE_NOW_PLAYING_URL', '/api/now-playing')
    writeFileSync(ENV_FILE, text, { mode: 0o600 })
    try {
      chmodSync(ENV_FILE, 0o600)
    } catch {
      /* not supported on this file system */
    }
    send(200, 'Connected', 'Your Spotify is connected to the site. You can close this tab and go back to the terminal.')
    done(
      [
        'Connected. SPOTIFY_REFRESH_TOKEN was saved to .env.local (it is not shown here).',
        addedFeedUrl ? 'VITE_NOW_PLAYING_URL=/api/now-playing was added too.' : 'VITE_NOW_PLAYING_URL was already set; left as it is.',
        'If npm run dev is running it restarts on its own; otherwise start it, then open http://localhost:5173/#music',
      ].join('\n'),
      0,
    )
  } catch (error) {
    send(500, 'Not connected', 'The exchange with Spotify failed. The terminal says why.')
    done(error instanceof Error ? error.message : 'The exchange with Spotify failed.', 1)
  }
})

const timer = setTimeout(() => done('No answer from the browser after 5 minutes. Nothing was saved. Run npm run spotify:auth to try again.', 1), TIMEOUT_MS)

function done(message, code) {
  clearTimeout(timer)
  console.log(`\n${message}\n`)
  server.close(() => process.exit(code))
  // Don't wait on a browser keeping the connection open.
  setTimeout(() => process.exit(code), 500).unref()
}

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') fail(`Port ${PORT} is in use. Close whatever is using it and try again.`)
  fail(`Could not start the callback server: ${error.message}`)
})

server.listen(PORT, HOST, () => {
  console.log(
    [
      '',
      'Open this link in your browser, sign in to Spotify if asked, and approve:',
      '',
      `  ${authorizeUrl}`,
      '',
      `Waiting for Spotify on ${REDIRECT_URI} … (Ctrl+C to cancel)`,
    ].join('\n'),
  )
})
