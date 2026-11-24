/**
 * Pure pieces of Work's desktop (the laptop screen with project files), kept
 * apart from the components so they can be tested without a DOM.
 */

/** A box in one shared coordinate space (e.g. client coordinates). */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** How many files share the first row, from each file's top edge (in px). */
export function columnsFrom(tops: readonly number[]): number {
  if (tops.length === 0) return 1
  const first = tops[0]!
  return Math.max(1, tops.filter((top) => Math.abs(top - first) < 2).length)
}

/**
 * Arrow keys move between files as they sit on the screen: left and right by
 * one, up and down by a row. Home and End jump to the first and last file.
 * Moves stop at the edges. Any other key returns null.
 */
export function fileIndexForKey(current: number, key: string, count: number, columns: number): number | null {
  if (count <= 0 || current < 0) return null
  const last = count - 1
  const cols = Math.max(1, columns)
  switch (key) {
    case 'ArrowRight':
      return Math.min(last, current + 1)
    case 'ArrowLeft':
      return Math.max(0, current - 1)
    case 'ArrowDown':
      return current + cols <= last ? current + cols : current
    case 'ArrowUp':
      return current - cols >= 0 ? current - cols : current
    case 'Home':
      return 0
    case 'End':
      return last
    default:
      return null
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000

function transform(tx: number, ty: number, sx: number, sy: number) {
  return `translate(${round(tx)}px, ${round(ty)}px) scale(${round(sx)}, ${round(sy)})`
}

/**
 * A short, simplified echo of the room's genie: the window pours out of its
 * file. Width leads height, so it reads as poured rather than zoomed. Transform
 * and opacity only; the window's transform-origin must be its top-left corner.
 * Played backwards, the same keyframes put the window back into the file.
 */
export function genieKeyframes(file: Box, win: Box): Keyframe[] {
  const sx = win.w > 0 ? file.w / win.w : 1
  const sy = win.h > 0 ? file.h / win.h : 1
  const tx = file.x - win.x
  const ty = file.y - win.y
  // Midway: already full width, still part of its height, halfway down from the file.
  const lead = 0.45
  return [
    { offset: 0, opacity: 0, transform: transform(tx, ty, sx, sy) },
    { offset: 0.14, opacity: 1 },
    { offset: 0.55, transform: transform(0, ty * (1 - lead), 1, sy + (1 - sy) * lead) },
    { offset: 1, opacity: 1, transform: transform(0, 0, 1, 1) },
  ]
}

/** Reduced motion: the window simply cross-fades in place. */
export const FADE_KEYFRAMES: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }]

/** How many files the desktop shows at once on a wide screen. */
export const VISIBLE_FILES = 3

/** The first visible file, kept inside 0 … count − visible. */
export function clampStart(start: number, visible: number, count: number): number {
  return Math.min(Math.max(0, start), Math.max(0, count - visible))
}

/** The smallest move of the view that brings file `index` into it. */
export function startToShow(index: number, start: number, visible: number, count: number): number {
  if (index < start) return clampStart(index, visible, count)
  if (index >= start + visible) return clampStart(index - visible + 1, visible, count)
  return clampStart(start, visible, count)
}

/** After the row slides, the selected file stays among the ones in view. */
export function selectionInView(selected: number, start: number, visible: number): number {
  return Math.min(Math.max(selected, start), start + visible - 1)
}
