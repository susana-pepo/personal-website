/**
 * Pure layout and input helpers for the record crate. Kept free of React and
 * the DOM so they can be tested on their own.
 */

/** Space left between sleeves when the crate is wide enough to show every face in full. */
export const CRATE_GAP = 12
/** The narrowest strip a sleeve is squeezed to while another one is opened out. */
export const CRATE_MIN_STRIP = 8

/**
 * Left offset of every sleeve in the crate, in px.
 *
 * If all faces fit, they stand side by side. Otherwise they overlap evenly,
 * and the sleeve in focus (if any) opens to its full face by squeezing the
 * others, like flipping through a cubby of records.
 */
export function crateOffsets(count: number, sleeve: number, width: number, focus: number | null): number[] {
  if (count <= 0) return []
  if (count === 1) return [0]
  const room = Math.max(0, width - sleeve)
  const full = sleeve + CRATE_GAP
  const natural = room / (count - 1)
  if (natural >= full) return Array.from({ length: count }, (_, i) => i * full)

  const opening = focus != null && focus >= 0 && focus < count - 1
  if (!opening) return Array.from({ length: count }, (_, i) => i * natural)

  const reveal = Math.max(natural, Math.min(full, room - (count - 2) * CRATE_MIN_STRIP))
  const rest = count > 2 ? (room - reveal) / (count - 2) : 0
  const xs: number[] = []
  let x = 0
  for (let i = 0; i < count; i++) {
    xs.push(x)
    x += i === focus ? reveal : rest
  }
  return xs
}

/** A crate is this many sleeves tall on a desktop window (music.css): the sleeve, and the headroom its record peeks into. */
export const CRATE_HEIGHT_RATIO = 1.12

/**
 * The sleeve size (px) at which the Music page fits the desktop panel without scrolling:
 * `available` is the panel body's height, `fixed` is everything on the page but the crates
 * (and any desk that is out), `crates` how many there are. music.css caps the result at the
 * sleeves' full size and keeps a floor, so a short window still gets legible covers.
 */
export function fitSleeve(available: number, fixed: number, crates: number): number {
  if (crates <= 0 || available <= 0) return 0
  return Math.max(0, Math.floor((available - fixed) / (crates * CRATE_HEIGHT_RATIO)))
}

/** The sleeve under a point: the front-most one whose left edge is at or before it. */
export function sleeveAt(offsets: readonly number[], x: number): number {
  let hit = 0
  offsets.forEach((left, i) => {
    if (left <= x) hit = i
  })
  return hit
}

/** Roving focus: where an arrow, Home or End key moves to, or null for any other key. */
export function nextSleeve(key: string, current: number, count: number): number | null {
  if (count <= 0) return null
  const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
  if (key in step) return Math.min(count - 1, Math.max(0, current + step[key]!))
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

/** "2 hours ago", "yesterday", from an ISO date. Empty when the date is missing or unreadable. */
export function playedAgo(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return ''
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ''
  const seconds = Math.round((then - now) / 1000)
  if (seconds > 60) return ''
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 60) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86_400 * 30) return rtf.format(Math.round(seconds / 86_400), 'day')
  return ''
}
