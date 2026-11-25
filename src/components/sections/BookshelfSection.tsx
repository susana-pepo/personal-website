import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { content } from '../../content/content'
import { SAMPLE_BOOKS } from '../../content/sampleBooks'
import type { Book, ShelfId } from '../../content/types'
import { useMediaQuery, usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { ShelfBoard } from './books/ShelfBoard'
import { ShelfDefs } from './books/ShelfDefs'
import { ShelfRow } from './bookshelf/ShelfRow'
import { safeId } from './books/defs'
import { DESKTOP_QUERY, fitScale, remPx, shelfLayout } from './bookshelf/layout'
import './bookshelf/bookshelf.css'

// In development an empty shelf is filled with invented samples (their notes say so); the live site never shows them.
const BOOKS = import.meta.env.DEV && content.bookshelf.books.length === 0 ? SAMPLE_BOOKS : content.bookshelf.books
const BY_SHELF = new Map<ShelfId, Book[]>(content.bookshelf.shelves.map((s) => [s.id, BOOKS.filter((b) => b.shelf === s.id)]))
// A shelf appears once it has a book.
const SHELVES = content.bookshelf.shelves.filter((s) => (BY_SHELF.get(s.id)?.length ?? 0) > 0)
// With both, Reading now and Books for work can share a row (bookshelf.css), their drawers opening
// beneath it: on a desktop window always, elsewhere once the shelves are wide enough (layout.ts).
const PAIRABLE = SHELVES.some((s) => s.id === 'reading') && SHELVES.some((s) => s.id === 'work')

export default function BookshelfSection() {
  const { bookshelf } = content
  const [open, setOpen] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const idBase = `bs-${safeId(useId())}`
  const reducedMotion = usePrefersReducedMotion()

  // Measured before the first paint, so the shelves never jump from one layout to the other.
  const desktop = useMediaQuery(DESKTOP_QUERY)
  const [paired, setPaired] = useState(false)
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!PAIRABLE || !el) return
    const update = () => setPaired(shelfLayout(el.clientWidth, remPx(), desktop).paired)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [desktop])

  const focusBook = useCallback((key: string) => {
    rootRef.current?.querySelector<HTMLElement>(`[data-book-key="${CSS.escape(key)}"]`)?.focus()
  }, [])

  const putBack = useCallback(() => {
    if (open === null) return
    setOpen(null)
    focusBook(open)
  }, [open, focusBook])

  // Escape puts the book back first; only the next Escape closes the panel.
  useEffect(() => {
    if (open === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      event.stopPropagation()
      putBack()
    }
    // Belt and braces: if the dialog still raises `cancel`, keep it open while a book is out.
    const dialog = rootRef.current?.closest('dialog')
    const onCancel = (event: Event) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      putBack()
    }
    document.addEventListener('keydown', onKeyDown, true)
    dialog?.addEventListener('cancel', onCancel, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      dialog?.removeEventListener('cancel', onCancel, true)
    }
  }, [open, putBack])

  // On a desktop window the page fits the panel without scrolling: every book scales by --fit
  // (bookshelf.css) to the height the rest of the page leaves (fitScale). The bays are the only
  // part that scales, and all of a bay is drawn in book units, so its height is linear in --fit.
  // Opening a drawer never resizes the shelves (the page scrolls for it instead).
  const fitRef = useRef(1)
  useLayoutEffect(() => {
    const root = rootRef.current
    const page = root?.closest<HTMLElement>('.panel__page')
    const body = root?.closest<HTMLElement>('.panel__body')
    if (!root) return
    if (!desktop || !paired || !page || !body) {
      fitRef.current = 1
      root.style.removeProperty('--fit')
      return
    }
    const measure = () => {
      const h = (el: Element | null) => el?.getBoundingClientRect().height ?? 0
      const sum = (selector: string) => [...root.querySelectorAll(selector)].reduce((total, el) => total + h(el), 0)
      const bays = Math.max(sum('[data-shelf="reading"] .bs-bay'), sum('[data-shelf="work"] .bs-bay')) + sum('[data-shelf="loved"] .bs-bay')
      if (bays === 0) return
      const above = root.getBoundingClientRect().top - page.getBoundingClientRect().top
      const below = parseFloat(getComputedStyle(page).paddingBottom) || 0
      // Sized only while every drawer beneath the shelves is folded and still: a drawer that is
      // open, or still folding or unfolding, holds the books
      // at the size they have (a box mid-fold can't be measured for what it will take). The
      // observer fires again on the frame they finish folding, and the page is measured then.
      const settling =
        root.querySelector('.bs-drawer[data-open]') !== null ||
        [...root.querySelectorAll('.bs-drawer__inner')].some((el) => h(el) > 0.5)
      if (settling) return
      const fixed = above + h(root) + below - bays
      const k = fitScale(body.clientHeight, fixed, bays / fitRef.current)
      if (k === fitRef.current) return
      fitRef.current = k
      root.style.setProperty('--fit', String(k))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    observer.observe(root)
    return () => observer.disconnect()
  }, [desktop, paired])

  const toggle = useCallback((key: string) => setOpen((current) => (current === key ? null : key)), [])

  return (
    <div className="section bookshelf" ref={rootRef}>
      <ShelfDefs />
      {bookshelf.intro && <p className="lede">{bookshelf.intro}</p>}

      {BOOKS.length === 0 && <p className="bs-empty">{bookshelf.emptyNote}</p>}

      <div className="bs-shelves" data-paired={PAIRABLE && paired ? '' : undefined}>
        {/* On a desktop window Reading now and Books for work stand on one board, as long as the
            one under Books I love (bookshelf.css); each keeps its own heading. */}
        {PAIRABLE && paired && desktop && <ShelfBoard className="bs-board bs-board--shared" />}
        {SHELVES.map((shelf) => (
          <ShelfRow
            key={shelf.id}
            shelf={shelf}
            books={BY_SHELF.get(shelf.id) ?? []}
            openKey={open}
            onToggle={toggle}
            onPutBack={putBack}
            idBase={idBase}
            reducedMotion={reducedMotion}
            sharedBoard={PAIRABLE && paired && desktop && shelf.id !== 'loved'}
          />
        ))}
      </div>
    </div>
  )
}
