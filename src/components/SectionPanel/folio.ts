import { content } from '../../content/content'
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

/** "03" */
export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "the books on the shelf" → "The books on the shelf" */
export function objectLabel(id: SectionId): string {
  const name = content.sections[id].objectName.trim()
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : ''
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

export function inkTransform(offsetLeft: number, offsetWidth: number): string {
  return `translateX(${offsetLeft}px) scaleX(${offsetWidth / INK_BASE_WIDTH})`
}

/** Reads a duration custom property such as "240ms" or "0.24s" from an element. */
export function readDuration(value: string, fallback: number): number {
  const v = value.trim()
  if (!v) return fallback
  const n = parseFloat(v)
  if (Number.isNaN(n)) return fallback
  return v.endsWith('ms') ? n : v.endsWith('s') ? n * 1000 : n
}
