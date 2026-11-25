import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { clamp, layoutShelf, shelfRows, type PlacedBook, type Slot } from '../../../content/bookGeometry'
import type { Book, Shelf } from '../../../content/types'
import { transitionMs } from '../../../lib/motion'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { BookCover } from '../books/BookCover'
import { BookDetail } from './BookDetail'
import { BookSpine } from '../books/BookSpine'
import { ShelfObjectArt } from './ShelfObjects'
import { ShelfBoard } from '../books/ShelfBoard'
import { DESKTOP_QUERY, remPx, shelfLayout } from './layout'

/** Stable identity for a book, used for the open state and to return focus. */
export const bookKey = (book: Book) => `${book.shelf}:${book.title}|${book.author}`

/* The drawer's own timings in bookshelf.css (closing 300ms, opening --dur-panel), read from
   it as it moves; these are only for when there is no style to read. */
const CLOSE_FALLBACK_MS = 300
const OPEN_FALLBACK_MS = 460
/** A frame to spare after the drawer stops. */
const SPARE_MS = 20


const vars = (v: Record<string, string | number>) => v as CSSProperties
const units = (n: number) => `calc(${n} * var(--u))`

interface ShelfRowProps {
  shelf: Shelf
  books: Book[]
  openKey: string | null
  onToggle: (key: string) => void
  onPutBack: () => void
  idBase: string
  reducedMotion: boolean
  /** The shelf stands on a board it shares with its neighbour (BookshelfSection): it draws none of its own. */
  sharedBoard?: boolean
}

export function ShelfRow({ shelf, books, openKey, onToggle, onPutBack, idBase, reducedMotion, sharedBoard = false }: ShelfRowProps) {
  const slots = useMemo(() => layoutShelf(books, shelf), [books, shelf])
  const placed = useMemo(
    () => slots.flatMap((s): PlacedBook[] => (s.type === 'stack' ? s.books : s.type === 'object' ? [] : [s])),
    [slots],
  )
  const openPlaced = placed.find((p) => bookKey(p.book) === openKey) ?? null
  const isOpen = openPlaced !== null
  const headingId = `${idBase}-${shelf.id}`
  const drawerId = `${idBase}-${shelf.id}-detail`

  // The book under the pointer or keyboard focus, named beneath the shelf.
  const [peekKey, setPeekKey] = useState<string | null>(null)
  const peek = placed.find((p) => bookKey(p.book) === peekKey) ?? null
  // Reading now's cover stands larger (bookshelf.css's .bs-feature); otherwise it behaves as every shelf.
  const featured = shelf.id === 'reading'

  const drawerRef = useRef<HTMLDivElement>(null)

  // Narrow or not (at or below 30rem, matching bookshelf.css's `shelves` and `bs-detail` containers,
  // which are inclusive; never on a desktop window, whose panel column can be that narrow too),
  // measured before the first paint so the shelf never jumps between layouts.
  const sectionRef = useRef<HTMLElement>(null)
  const desktop = useMediaQuery(DESKTOP_QUERY)
  const [narrow, setNarrow] = useState(false)
  useLayoutEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const update = () => setNarrow(shelfLayout(el.clientWidth, remPx(), desktop).narrow)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [desktop])
  const rows = useMemo(() => shelfRows(slots, narrow), [slots, narrow])

  // Keep the last book in the drawer while it closes.
  const [shown, setShown] = useState<PlacedBook | null>(null)
  if (openPlaced && openPlaced !== shown) setShown(openPlaced)
  useEffect(() => {
    if (openPlaced) return
    const closeMs = transitionMs(drawerRef.current, 'grid-template-rows', CLOSE_FALLBACK_MS) + SPARE_MS
    const timer = window.setTimeout(() => setShown(null), closeMs)
    return () => window.clearTimeout(timer)
  }, [openPlaced])

  // Once the drawer has opened, bring the whole detail into view if it is below the fold.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (!openPlaced) {
      wasOpen.current = false
      return
    }
    // (with reduced motion the drawer opens at once, so there's nothing to wait for)
    const delay =
      wasOpen.current || reducedMotion ? 0 : transitionMs(drawerRef.current, 'grid-template-rows', OPEN_FALLBACK_MS) + SPARE_MS
    wasOpen.current = true
    const timer = window.setTimeout(
      () => drawerRef.current?.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' }),
      delay,
    )
    return () => window.clearTimeout(timer)
  }, [openPlaced, reducedMotion])

  // Arrow keys walk along the shelf (across both boards when it has two); Home and End jump to its ends.
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const current = (event.target as HTMLElement).closest<HTMLElement>('.bs-book')
    if (!current) return
    const shelfEl = event.currentTarget.closest('.bs-shelf') ?? event.currentTarget
    const all = [...shelfEl.querySelectorAll<HTMLElement>('.bs-row .bs-book')]
    const i = all.indexOf(current)
    const moves: Record<string, number> = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }
    const to = moves[event.key]
    if (to === undefined) return
    event.preventDefault()
    all[clamp(to, 0, all.length - 1)]?.focus()
  }

  const bookButton = (p: PlacedBook, variant: '' | 'face' | 'flat', children: ReactNode, style?: CSSProperties) => {
    const key = bookKey(p.book)
    const expanded = key === openKey
    return (
      <button
        key={key}
        type="button"
        className={variant ? `bs-book bs-book--${variant}` : 'bs-book'}
        style={style}
        aria-expanded={expanded}
        aria-controls={drawerId}
        aria-label={`${p.book.title}, ${p.book.author}`}
        data-book-key={key}
        data-reading={shelf.id === 'reading' ? '' : undefined}
        onClick={() => onToggle(key)}
        // A finger "enters" a book on touchstart; naming it then would change the caption before
        // the tap lands. Touch names a book through focus instead, as the keyboard does.
        onPointerEnter={(event) => {
          if (event.pointerType !== 'touch') setPeekKey(key)
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== 'touch') setPeekKey((k) => (k === key ? null : k))
        }}
        onFocus={() => setPeekKey(key)}
        onBlur={() => setPeekKey((k) => (k === key ? null : k))}
      >
        {children}
      </button>
    )
  }
  const slip = (p: PlacedBook) => <span className="bs-slip" style={vars({ '--x': p.spec.slipX.toFixed(2) })} />

  const renderSlot = (s: Slot) => {
    switch (s.type) {
      case 'upright':
        return (
          <li key={bookKey(s.book)} className="bs-slot" style={vars({ '--w': s.w, '--h': s.h, '--shade': s.shade })}>
            {bookButton(s, '', <><BookSpine book={s.book} spec={s.spec} />{slip(s)}</>)}
          </li>
        )
      case 'face':
        return (
          <li key={bookKey(s.book)} className="bs-slot bs-slot--face" style={vars({ '--w': s.w, '--h': s.h, '--shade': s.shade })}>
            {bookButton(
              s,
              'face',
              <>
                <span className="bs-book__tilt">
                  <BookCover book={s.book} spec={s.spec} />
                </span>
              </>,
            )}
          </li>
        )
      case 'lean':
        return (
          <li
            key={bookKey(s.book)}
            className="bs-slot bs-slot--lean"
            style={vars({
              '--w': s.w,
              '--h': s.h,
              '--shade': s.shade,
              '--lean': `${s.lean}deg`,
              marginLeft: units(s.marginLeft),
              marginRight: units(s.marginRight),
            })}
          >
            {bookButton(s, '', <><BookSpine book={s.book} spec={s.spec} />{slip(s)}</>)}
          </li>
        )
      case 'stack':
        return (
          <li key="stack" className="bs-slot bs-slot--stack" style={vars({ '--shade': s.shade, marginLeft: units(26) })}>
            {s.books.map((p) =>
              bookButton(
                p,
                'flat',
                <span className="bs-book__rot">
                  <BookSpine book={p.book} spec={p.spec} />
                </span>,
                vars({ '--w': p.spec.height, '--h': p.spec.thick, '--dx': p.dx, '--rw': p.spec.thick, '--rh': p.spec.height }),
              ),
            )}
          </li>
        )
      case 'object':
        return (
          <li
            key={s.object}
            className={s.object === 'bookend' ? 'bs-slot bs-slot--obj bs-slot--bookend' : 'bs-slot bs-slot--obj'}
            aria-hidden="true"
            style={vars({ '--w': s.w, '--h': s.h })}
          >
            <span className="bs-obj" style={{ width: units(s.w), height: units(s.h) }}>
              <ShelfObjectArt />
            </span>
          </li>
        )
    }
  }

  return (
    <section ref={sectionRef} className="bs-shelf" data-shelf={shelf.id} aria-labelledby={headingId}>
      <h3 id={headingId} className="bs-shelf__title">
        {shelf.title}
      </h3>

      <div className={featured ? 'bs-feature' : 'bs-plain'} data-boards={rows.length > 1 ? rows.length : undefined}>
        {rows.map((row, r) => (
          <div className="bs-bay" key={r}>
            <div className="bs-lamp" aria-hidden="true" />
            <ul className="bs-row" role="list" onKeyDown={onKeyDown}>
              {row.map(renderSlot)}
            </ul>
            {sharedBoard ? <span className="bs-board-space" aria-hidden="true" /> : <ShelfBoard />}
          </div>
        ))}
        <p className="bs-caption" aria-hidden="true">
          {peek && (
            <>
              <span className="bs-caption__title">{peek.book.title}</span> · {peek.book.author}
            </>
          )}
        </p>
      </div>

      <div ref={drawerRef} id={drawerId} className="bs-drawer" data-open={isOpen ? '' : undefined} inert={!isOpen}>
        <div className="bs-drawer__inner" aria-live="polite">
          {shown && (
            <BookDetail key={bookKey(shown.book)} placed={shown} onPutBack={onPutBack} />
          )}
        </div>
      </div>
    </section>
  )
}
