import { SECTION_IDS, type SectionId } from '../../content/types'

/**
 * Small, pure pieces of the folio panel, kept apart from the component so they
 * can be tested without a DOM.
 */

/** +1 when turning forward through the sections, -1 when turning back. */
export function turnDirection(from: SectionId | null, to: SectionId): 1 | -1 {
  if (!from) return 1
  return SECTION_IDS.indexOf(to) < SECTION_IDS.indexOf(from) ? -1 : 1
}

/** Arrow keys move between the tabs, wrapping at the ends; Home and End jump. */
export function tabIndexForKey(current: number, key: string, count: number): number | null {
  if (count <= 0 || current < 0) return null
  switch (key) {
    case 'ArrowRight':
      return (current + 1) % count
    case 'ArrowLeft':
      return (current - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/**
 * Reading progress for the hairline under the bar. It only shows on a page
 * that really scrolls, and only once reading has started.
 */
export function readingProgress(scrollTop: number, scrollHeight: number, clientHeight: number) {
  const max = scrollHeight - clientHeight
  const fraction = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0
  return { fraction, visible: max > 40 && scrollTop > 4 }
}

/** The ink mark is 100px wide at rest and is scaled to the tab it sits under. */
export const INK_BASE_WIDTH = 100

/** Reads a duration custom property such as "240ms" or "0.24s" from an element. */
export function readDuration(value: string, fallback: number): number {
  const v = value.trim()
  if (!v) return fallback
  const n = parseFloat(v)
  if (Number.isNaN(n)) return fallback
  return v.endsWith('ms') ? n : v.endsWith('s') ? n * 1000 : n
}

/** The tab row's gaps: its usual one, and the closer one a narrow sheet uses (SectionPanel.css). */
export const TAB_GAP_PX = 24
export const TAB_GAP_SNUG_PX = 14

/**
 * How the six tabs sit in a sheet `viewport` px wide for their words (each tab's own width, which
 * the gap doesn't change): spaced as usual, closer together, or, when even that is too wide,
 * scrolling sideways with a fade at the end so a cut word never shows hard against the close button.
 */
export function tabRowFit(widths: readonly number[], viewport: number): 'roomy' | 'snug' | 'scroll' {
  const words = widths.reduce((sum, w) => sum + w, 0)
  const gaps = Math.max(0, widths.length - 1)
  // (1px of leeway for sub-pixel widths)
  if (words + gaps * TAB_GAP_PX <= viewport + 1) return 'roomy'
  if (words + gaps * TAB_GAP_SNUG_PX <= viewport + 1) return 'snug'
  return 'scroll'
}

/**
 * Where the sideways-scrolling tab row should rest so the current tab shows whole. It starts at a
 * tab's own edge, never halfway through a word: the tab before the current one when it fits (so
 * you can see where you came from), otherwise the furthest edge that still shows it. `endFade` is
 * the width the row fades out over at its right, which doesn't count as showing.
 */
export function tabRowScroll(
  tabs: readonly { left: number; width: number }[],
  current: number,
  viewport: number,
  maxScroll: number,
  endFade = 0,
): number {
  const tab = tabs[current]
  if (!tab) return 0
  const right = tab.left + tab.width
  // (2px of leeway: sub-pixel rounding shouldn't decide between two tabs)
  const ok = (k: number, fade: number) => {
    const start = tabs[k]?.left
    return start !== undefined && start <= maxScroll && right <= start + viewport - fade + 2
  }
  if (ok(current - 1, endFade)) return tabs[current - 1]!.left
  // At the end of the row the fade can't be cleared: a tab partly in it still beats one cut in two.
  for (const fade of [endFade, 0]) {
    for (let k = current; k >= 0; k--) if (ok(k, fade)) return tabs[k]!.left
  }
  return Math.min(Math.max(tab.left, 0), maxScroll)
}

/**
 * Where the desk lamp's bulb falls on the sheet, as percentages of the sheet's box, for the
 * glass's light (--lamp-x and --lamp-y in SectionPanel.css). Kept a little inside the edges, so
 * the brightest stretch of the rim never lands on a rounded corner; null when either box is
 * missing (the lamp hidden or not drawn yet), and the CSS falls back to its own guess.
 */
export function lampOnSheet(
  bulb: { x: number; y: number },
  sheet: { left: number; top: number; width: number; height: number },
): { x: number; y: number } | null {
  if (!(sheet.width > 0 && sheet.height > 0) || !Number.isFinite(bulb.x) || !Number.isFinite(bulb.y)) return null
  const at = (v: number) => Math.round(Math.min(88, Math.max(12, v * 100)) * 10) / 10
  return { x: at((bulb.x - sheet.left) / sheet.width), y: at((bulb.y - sheet.top) / sheet.height) }
}
