import { CAT_MEDIA, OVERLAYS, ROOM_POSTER_SRC, WOMAN_MEDIA } from './layout'
import { WINDOW_VIEWS, WINDOW_VIEW_MASK, type TimeOfDay } from './windowViews'

/**
 * The page's entrance. Instead of each picture popping in as it happens to arrive, the room
 * is held back (the page shows its own calm background) until its pictures are decoded and
 * the fonts are ready, then revealed once, whole: the room with every object already in it
 * settles into view as one picture, then the header and the player rise in. A slow connection
 * never waits longer than ENTRANCE_MAX_WAIT_MS; anything still on its way fades in when it
 * arrives. Signalled by `data-entered` on the root element (CSS in HeroScene.css).
 */
export const ENTRANCE_MAX_WAIT_MS = 3500

/**
 * How long after the entrance the room counts as settled (its arrival animations have
 * finished): only then do the heavy animations start, so the graphics card never has to draw
 * the arrival and start every video and clip in the same moment. `data-settled` on the root.
 */
export const ENTRANCE_SETTLE_MS = 1300

/** Every picture the first view of the room needs, once each. */
export function entranceImages(time: TimeOfDay): string[] {
  return [
    ...new Set([
      ROOM_POSTER_SRC,
      ...OVERLAYS.map((o) => o.src),
      WOMAN_MEDIA.chair,
      CAT_MEDIA.still,
      WINDOW_VIEWS[time].still,
      WINDOW_VIEW_MASK,
    ]),
  ]
}

/** Resolves once every picture is decoded and the fonts are ready, or after `maxMs`. */
export function sceneReady(srcs: readonly string[], maxMs: number): Promise<void> {
  const decode = (src: string) => {
    const img = new Image()
    img.decoding = 'async'
    img.src = src
    return img.decode().catch(() => {}) // a missing picture never holds the room back
  }
  const fonts = typeof document !== 'undefined' && document.fonts ? document.fonts.ready.then(() => {}) : Promise.resolve()
  return Promise.race([
    Promise.all([...srcs.map(decode), fonts]).then(() => {}),
    new Promise<void>((resolve) => window.setTimeout(resolve, maxMs)),
  ])
}

const whenAttribute = (name: 'entered' | 'settled'): Promise<void> => {
  const root = document.documentElement
  if (root.dataset[name] !== undefined) return Promise.resolve()
  return new Promise((resolve) => {
    const watch = new MutationObserver(() => {
      if (root.dataset[name] === undefined) return
      watch.disconnect()
      resolve()
    })
    watch.observe(root, { attributes: true, attributeFilter: [`data-${name}`] })
  })
}

/** Resolves once the page has made its entrance (the room is being revealed). */
export const whenEntered = () => whenAttribute('entered')

/**
 * Resolves once the entrance has finished and the room is at rest. The heavy animations (the
 * woman's and the cat's clips, the coffee's steam, the window's loop, the room's video) wait
 * for it; until then each shows its still, which is its first frame, so the change can't be seen.
 */
export const whenSettled = () => whenAttribute('settled')
