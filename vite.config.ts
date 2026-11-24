/// <reference types="vitest/config" />
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createNowPlaying } from './server/nowPlaying'

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

export default defineConfig(({ mode }) => ({
  plugins: [react(), nowPlayingDevRoute(mode)],
  define: {
    __CV_PATH__: JSON.stringify(hasCv ? `/${CV_PUBLIC_PATH}` : ''),
  },
  test: {
    environment: 'node',
  },
}))
