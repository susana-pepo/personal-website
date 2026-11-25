/**
 * Pure pieces of Work's tablet (the projects as rows on its screen, one
 * project's page, and the move between them), kept apart from the component
 * so they can be tested without a DOM.
 */

/**
 * Arrow keys move between the rows in reading order: down and right go to the
 * next row, up and left to the one before. Moves stop at the ends. Home and
 * End jump to the first and last row. Any other key returns null.
 */
export function rowIndexForKey(current: number, key: string, count: number): number | null {
  if (count <= 0 || current < 0) return null
  const last = count - 1
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return Math.min(last, current + 1)
    case 'ArrowUp':
    case 'ArrowLeft':
      return Math.max(0, current - 1)
    case 'Home':
      return 0
    case 'End':
      return last
    default:
      return null
  }
}

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/**
 * The transform that lays an element whose own box is `home` over the box
 * `over`, for a transform-origin of 0 0. The drawing keeps its proportions, so
 * one scale (from the widths) is enough. A box with no width gives 'none'.
 */
export function placeOver(home: Box, over: Box): string {
  if (home.width <= 0 || over.width <= 0) return 'none'
  const dx = round(over.left - home.left)
  const dy = round(over.top - home.top)
  const s = round(over.width / home.width, 4)
  if (dx === 0 && dy === 0 && s === 1) return 'none'
  return `translate(${dx}px, ${dy}px) scale(${s})`
}

const round = (n: number, places = 2) => {
  const f = 10 ** places
  return Math.round(n * f) / f
}

/** A pause this long (ms) between wheel events starts a new wheel gesture. */
export const WHEEL_GESTURE_GAP = 200

/**
 * Whether a wheel event over the screen should scroll the page around the tablet instead.
 * Chrome can leave the screen's scroll a fraction of a pixel short of its end (when the tablet
 * sits at a fractional position), and then a wheel there stays on the screen and the page never
 * moves. So a downward gesture that starts at the end of the screen's scroll (within a pixel) is
 * passed to the page, for as long as it lasts. A gesture that reaches the end part-way stays on
 * the screen, as browsers keep a scroll on the box it started in. Upward is left to the browser:
 * the top is never a fraction away.
 */
export function wheelGoesToPage(
  view: { scrollTop: number; scrollHeight: number; clientHeight: number },
  deltaY: number,
  freshGesture: boolean,
  passing: boolean,
): boolean {
  if (deltaY <= 0) return false
  if (!freshGesture) return passing
  return view.scrollTop >= view.scrollHeight - view.clientHeight - 1
}

/**
 * The move between the rows and a project's page, in ms. The drawing travels;
 * the other rows leave quickly; the page's words arrive once the drawing has
 * mostly landed. Putting it back, the words leave first and the rows return
 * while the drawing settles into its row.
 */
export const MOVE = {
  travel: 480,
  rowsOut: 140,
  wordsIn: { delay: 140, duration: 260 },
  back: 440,
  wordsOut: 120,
  rowsIn: { delay: 140, duration: 280 },
  /** Reduced motion: a short crossfade and nothing travels. */
  fade: 160,
} as const

/**
 * On a wide screen (the panel floating beside the room) the tablet's screen is as tall as the
 * panel's first view allows: the view's height, less what sits above the tablet, the tablet's
 * own edge and bezel, and a breath under it as wide as the one above it. Never below `least`,
 * so a very short window lets the panel scroll rather than squeeze the rows.
 */
export function fitScreenHeight(
  { view, above, frame, breath }: { view: number; above: number; frame: number; breath: number },
  least = 200,
): number {
  return Math.max(least, Math.floor(view - above - frame - breath))
}
