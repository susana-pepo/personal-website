import { useEffect, useRef, useState } from 'react'
import { embedHeight, embedUrl, type SpotifyRef } from '../../../lib/spotify'

/*
 * Spotify's iFrame API (https://developer.spotify.com/documentation/embeds/references/iframe-api)
 * gives the same player as the plain embed, plus playback events, so the record
 * on the desk can turn only while music is actually playing. It is loaded only
 * after a click on "Play here". If it can't load, the plain embed is used and the
 * record turns while the player is open.
 */

interface PlaybackUpdate {
  data: { isPaused: boolean; isBuffering?: boolean; position?: number; duration?: number }
}

interface EmbedController {
  addListener(event: 'ready', callback: () => void): void
  addListener(event: 'playback_update', callback: (event: PlaybackUpdate) => void): void
  destroy(): void
}

interface IFrameAPI {
  createController(
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: EmbedController) => void,
  ): void
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void
  }
}

const API_SRC = 'https://open.spotify.com/embed/iframe-api/v1'
const API_TIMEOUT_MS = 6000
let api: Promise<IFrameAPI> | null = null

function loadIframeApi(): Promise<IFrameAPI> {
  if (api) return api
  api = new Promise<IFrameAPI>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), API_TIMEOUT_MS)
    window.onSpotifyIframeApiReady = (ready) => {
      window.clearTimeout(timer)
      resolve(ready)
    }
    const script = document.createElement('script')
    script.src = API_SRC
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('blocked'))
    }
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    api = null
    throw error
  })
  return api
}

interface SpotifyPlayerProps {
  item: SpotifyRef
  title: string
  /** True while Spotify reports playback (or, without the API, while the player is open). */
  onPlayingChange: (playing: boolean) => void
}

export function SpotifyPlayer({ item, title, onPlayingChange }: SpotifyPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const report = useRef(onPlayingChange)
  report.current = onPlayingChange
  // The title can arrive late (Spotify's lookup); it renames the frame without rebuilding the player.
  const titleRef = useRef(title)
  titleRef.current = title
  const [mode, setMode] = useState<'api' | 'embed'>('api')
  const height = embedHeight(item)

  useEffect(() => {
    if (mode === 'embed') {
      report.current(true)
      return () => report.current(false)
    }
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let controller: EmbedController | null = null

    loadIframeApi()
      .then((ready) => {
        if (cancelled) return
        // The API swaps this element for its iframe, so React never owns it.
        const target = document.createElement('div')
        host.replaceChildren(target)
        ready.createController(target, { uri: `spotify:${item.kind}:${item.id}`, width: '100%', height }, (c) => {
          if (cancelled) {
            c.destroy()
            return
          }
          controller = c
          const frame = host.querySelector('iframe')
          frame?.setAttribute('title', titleRef.current)
          frame?.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture')
          c.addListener('playback_update', (event) => report.current(!event.data.isPaused))
        })
      })
      .catch(() => {
        if (!cancelled) setMode('embed')
      })

    return () => {
      cancelled = true
      controller?.destroy()
      host.replaceChildren()
      report.current(false)
    }
  }, [mode, item.kind, item.id, height])

  useEffect(() => {
    hostRef.current?.querySelector('iframe')?.setAttribute('title', title)
  }, [title])

  if (mode === 'embed') {
    return (
      <iframe
        className="desk__embed"
        title={title}
        src={embedUrl(item)}
        height={height}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      />
    )
  }
  return <div ref={hostRef} className="desk__embed" style={{ minHeight: height }} />
}
