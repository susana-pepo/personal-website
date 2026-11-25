/// <reference types="vitest/config" />
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createNowPlaying } from './server/nowPlaying'
import { MAX_NOTE, readNotes, saveNote } from './server/bookNotes'

/**
 * Development only: the book notes page (/?notes) saves through POST /__dev/book-notes,
 * which writes src/content/bookNotes.json. Requests from any other site are refused, so a
 * page open in another tab can't write to the file.
 */
function bookNotesDevRoute(): Plugin {
  return {
    name: 'book-notes-dev-route',
    apply: 'serve',
    configureServer(server) {
      const file = fileURLToPath(new URL('./src/content/bookNotes.json', import.meta.url))
      server.middlewares.use('/__dev/book-notes', (req, res) => {
        const reply = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        const origin = req.headers.origin
        const sameSite = !origin || URL.canParse(origin) && new URL(origin).host === req.headers.host
        if (!sameSite) return reply(403, { error: 'Not allowed from another site.' })
        if (req.method === 'GET') return reply(200, { notes: readNotes(file) })
        if (req.method !== 'POST') return reply(405, { error: 'Use POST.' })
        let raw = ''
        req.on('data', (chunk: Buffer) => {
          raw += chunk.toString('utf8')
          if (raw.length > MAX_NOTE * 4) req.destroy()
        })
        req.on('end', () => {
          try {
            const { title, note } = JSON.parse(raw) as { title?: unknown; note?: unknown }
            if (typeof title !== 'string' || typeof note !== 'string') return reply(400, { error: 'A title and a note are needed.' })
            reply(200, { notes: saveNote(file, title, note) })
          } catch (error) {
            reply(400, { error: error instanceof Error ? error.message : 'The note could not be saved.' })
          }
        })
      })
    },
  }
}

/**
 * The CV download button only appears when a real file exists at
 * public/cv/susana-perez-posada-cv.pdf. Drop the PDF in and rebuild.
 */
const CV_PUBLIC_PATH = 'cv/susana-perez-posada-cv.pdf'
const hasCv = existsSync(fileURLToPath(new URL(`./public/${CV_PUBLIC_PATH}`, import.meta.url)))

/**
 * Development only: serves GET /api/now-playing from server/nowPlaying.ts, so
 * "What I'm listening to" works locally without deploying anything.
 *
 * The Spotify secrets are read with loadEnv(mode, root, '') on each request,
 * straight from .env.local on this machine. They have no VITE_ prefix, so Vite
 * never exposes them to the browser bundle. Without them the route answers 503.
 */
function nowPlayingDevRoute(mode: string): Plugin {
  return {
    name: 'now-playing-dev-route',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root
      const handle = createNowPlaying({ env: () => loadEnv(mode, root, '') })
      server.middlewares.use('/api/now-playing', (req, res, next) => {
        const origin = `http://${req.headers.host ?? 'localhost'}`
        const headers = new Headers()
        if (typeof req.headers.origin === 'string') headers.set('Origin', req.headers.origin)
        handle(new Request(new URL(req.originalUrl ?? '/api/now-playing', origin), { method: req.method ?? 'GET', headers }))
          .then(async (response) => {
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()))
          })
          .catch(next)
      })
    },
  }
}

/**
 * Where the site is served from. '/' by default, as on https://susanapepo.com; set
 * SITE_BASE (e.g. /personal-website/) only to build for a sub-path. Vite already
 * prefixes the paths it bundles, in CSS and in index.html's tags.
 */
const BASE = process.env.SITE_BASE ?? '/'

/**
 * The room's pictures and clips are referred to by root paths written as plain strings
 * ('/media/scene/…' in scene-layout.json, layout.ts, content.ts and index.html's early
 * preload script), which Vite doesn't rewrite. When the site lives under a sub-path, this
 * prefixes them at build time, so the source keeps one simple form of path.
 */
function subPathMedia(base: string): Plugin {
  const prefix = (code: string) => code.replace(/(['"`])\/(media|cv)\//g, `$1${base}$2/`)
  return {
    name: 'sub-path-media',
    apply: 'build',
    enforce: 'post',
    transform(code, id) {
      if (base === '/' || id.includes('node_modules') || !/\.(ts|tsx|js|jsx|json)$/.test(id.split('?')[0]!)) return null
      const next = prefix(code)
      return next === code ? null : { code: next, map: null }
    },
    // after Vite's own rewrite of the page's tags, so nothing is prefixed twice
    transformIndexHtml: {
      order: 'post',
      handler: (html) => (base === '/' ? html : prefix(html)),
    },
  }
}

export default defineConfig(({ mode }) => ({
  base: BASE,
  plugins: [react(), nowPlayingDevRoute(mode), bookNotesDevRoute(), subPathMedia(BASE)],
  define: {
    __CV_PATH__: JSON.stringify(hasCv ? `${BASE}${CV_PUBLIC_PATH}` : ''),
  },
  test: {
    environment: 'node',
  },
}))
