import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { clamp, layoutShelf, type PlacedBook } from '../../../content/bookGeometry'
import type { Book, Shelf } from '../../../content/types'
import { BookCover } from '../books/BookCover'
import { BookDetail } from './BookDetail'
import { BookSpine } from '../books/BookSpine'
import { ShelfObjectArt } from './ShelfObjects'
import { ShelfBoard } from '../books/ShelfBoard'

/** Stable identity for a book, used for the open state and to return focus. */
export const bookKey = (book: Book) => `${book.shelf}:${book.title}|${book.author}`

/** Matches the drawer's closing transition, so the detail stays put while it folds away. */
const CLOSE_MS = 320
/** Matches the drawer's opening transition. */
const OPEN_MS = 440

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
}

export function ShelfRow({ shelf, books, openKey, onToggle, onPutBack, idBase, reducedMotion }: ShelfRowProps) {
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
  const featured = shelf.id === 'reading' ? (placed[0] ?? null) : null

  // Keep the last book in the drawer while it closes.
  const [shown, setShown] = useState<PlacedBook | null>(null)
  if (openPlaced && openPlaced !== shown) setShown(openPlaced)
  useEffect(() => {
    if (openPlaced) return
    const timer = window.setTimeout(() => setShown(null), CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [openPlaced])

  // Once the drawer has opened, bring the whole detail into view if it is below the fold.
  const drawerRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (!openPlaced) {
      wasOpen.current = false
      return
    }
    // (with reduced motion the drawer opens at once, so there's nothing to wait for)
    const delay = wasOpen.current || reducedMotion ? 0 : OPEN_MS
    wasOpen.current = true
    const timer = window.setTimeout(
      () => drawerRef.current?.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' }),
      delay,
    )
    return () => window.clearTimeout(timer)
  }, [openPlaced, reducedMotion])

  // Arrow keys walk along the shelf; Home and End jump to its ends.
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const current = (event.target as HTMLElement).closest<HTMLElement>('.bs-book')
    if (!current) return
    const all = [...event.currentTarget.querySelectorAll<HTMLElement>('.bs-book')]
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
        onPointerEnter={() => setPeekKey(key)}
        onPointerLeave={() => setPeekKey((k) => (k === key ? null : k))}
        onFocus={() => setPeekKey(key)}
        onBlur={() => setPeekKey((k) => (k === key ? null : k))}
      >
        {children}
      </button>
    )
  }
  const slip = (p: PlacedBook) => <span className="bs-slip" style={vars({ '--x': p.spec.slipX.toFixed(2) })} />

  return (
    <section className="bs-shelf" data-shelf={shelf.id} aria-labelledby={headingId}>
      <h3 id={headingId} className="bs-shelf__title">
        {shelf.title}
      </h3>

      <div className={featured ? 'bs-feature' : 'bs-plain'}>
        <div className="bs-bay">
          <div className="bs-lamp" aria-hidden="true" />
          <ul className="bs-row" role="list" onKeyDown={onKeyDown}>
            {slots.map((s) => {
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
            })}
          </ul>
          <ShelfBoard />
        </div>
        {!featured && (
          <p className="bs-caption" aria-hidden="true">
            {peek && (
              <>
                <span className="bs-caption__title">{peek.book.title}</span> · {peek.book.author}
              </>
            )}
          </p>
        )}
        {featured && (
          <div className="bs-feature__text">
            <p className="bs-feature__title">{featured.book.title}</p>
            <p className="bs-feature__author">{featured.book.author}</p>
            {featured.book.note && <p className="bs-feature__note">{featured.book.note}</p>}
          </div>
        )}
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
