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
        <h4 className="bs-detail__title">{book.title}</h4>
        <p className="bs-detail__author">{book.author}</p>
        {book.note && <p className="bs-detail__note">{book.note}</p>}
        <p className="bs-detail__actions">
          {book.href && (
            <a className="text-link" href={book.href} target="_blank" rel="noreferrer">
              More about this book<span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          )}
          <button type="button" className="text-link text-button bs-put-back" onClick={onPutBack}>
            Put it back
          </button>
        </p>
      </div>
    </div>
  )
}
