/**
 * How the shelves lay themselves out, from the width they are given. Pure, so it can be tested.
 *
 * On a phone or tablet the shelves follow their own width: below PAIR_REM each shelf takes the
 * full column, and at NARROW_REM or less a long shelf's pile lies on a board of its own. On a
 * desktop window the panel floats beside the room (SectionPanel's panelGeometry) and its column
 * can be as narrow as a phone's at 1280px, so there the layout keys off the window instead:
 * Reading now and Books for work always share a row, and nothing takes the phone layout.
 */

/** The desktop panel: the same breakpoint as SectionPanel's (its phone/tablet rules stop at 1024px). */
export const DESKTOP_QUERY = '(min-width: 1025px)'

/** At or above this width (rem) Reading now and Books for work share a row. */
export const PAIR_REM = 34

/** At or below this width (rem, inclusive, as bookshelf.css's max-width queries are) a pile lies on a board of its own. */
export const NARROW_REM = 30

export interface ShelfLayout {
  /** Reading now and Books for work side by side (bookshelf.css's `[data-paired]`). */
  paired: boolean
  /** The phone layout: a long shelf splits onto two boards. */
  narrow: boolean
}

/**
 * @param width the shelves' width in px (0 before it has been measured)
 * @param rem the root font size in px, so the thresholds follow the reader's text size as the CSS does
 * @param desktop whether DESKTOP_QUERY matches
 */
export function shelfLayout(width: number, rem: number, desktop: boolean): ShelfLayout {
  if (desktop) return { paired: true, narrow: false }
  return {
    paired: width >= PAIR_REM * rem,
    narrow: width > 0 && width <= NARROW_REM * rem,
  }
}

export const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
