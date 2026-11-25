import { useEffect, useState, type CSSProperties } from 'react'
import { detailSize, type PlacedBook } from '../../../content/bookGeometry'
import { BookCover } from '../books/BookCover'
import { BookSpine } from '../books/BookSpine'

interface BookDetailProps {
  placed: PlacedBook
  onPutBack: () => void
}

/**
 * The chosen book, turned from spine-on to cover-on, with its note. A CSS 3D
 * copy of the book: cover, back, spine, page block and top.
 */
export function BookDetail({ placed, onPutBack }: BookDetailProps) {
  const { book, spec } = placed
  const { cw, ch, t } = detailSize(spec)
  // Start spine-on, then turn on the next frames so the transition runs.
  const [turned, setTurned] = useState(false)
  useEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setTurned(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [])

  const size = { '--cw': `${cw}px`, '--ch': `${ch}px` } as CSSProperties
  return (
    <div className="bs-detail" role="group" aria-label={book.title}>
      <div className="bs-stage" aria-hidden="true" style={size}>
        <div
          className={turned ? 'bs-b3d' : 'bs-b3d bs-b3d--spine-on'}
          style={{ ...size, '--t': `${t}px`, '--bc': spec.col.c } as CSSProperties}
        >
          <div className="bs-f bs-f--front">
            <BookCover book={book} spec={spec} />
          </div>
          <div className="bs-f bs-f--back" />
          <div className="bs-f bs-f--spine">
            <BookSpine book={book} spec={spec} />
          </div>
          <div className="bs-f bs-f--pages" />
          <div className="bs-f bs-f--top" />
        </div>
        <div className="bs-stage__shadow" />
      </div>

      <div className="bs-detail__text">
        <div className="bs-detail__head">
          <div>
            <h4 className="bs-detail__title">{book.title}</h4>
            <p className="bs-detail__author">{book.author}</p>
          </div>
          {/* Collapses the drawer: the book goes back on the shelf. The same chevron in a ring as
              Experience's pages and Music's desk. */}
          <button type="button" className="bs-put-back" aria-label="Put it back" onClick={onPutBack}>
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
              <path d="M2.5 7.75 6 4.25l3.5 3.5" />
            </svg>
          </button>
        </div>
        {book.note && <p className="bs-detail__note">{book.note}</p>}
        {book.href && (
          <p className="bs-detail__actions">
            <a className="text-link" href={book.href} target="_blank" rel="noreferrer">
              More about this book<span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </p>
        )}
      </div>
    </div>
  )
}
