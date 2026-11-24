import { useMemo, type CSSProperties } from 'react'
import { specFor } from '../../../content/bookGeometry'
import type { Book, BookColour, BookKind, ExperienceEntry } from '../../../content/types'
import { BookSpine } from '../books/BookSpine'
import { ShelfBoard } from '../books/ShelfBoard'
import { ShelfDefs } from '../books/ShelfDefs'
// The shared book drawing's styles (.bs-board, .bs-shade, .bs-t-*) still live in the Bookshelf's sheet.
import '../bookshelf/bookshelf.css'
import './desk-pile.css'

/* Bindings and room colours, taken in turn. Sizes in millimetres, as for real books. */
const BINDINGS: { kind: BookKind; colour: BookColour; heightMm: number; thicknessMm: number; dx: number }[] = [
  { kind: 'cloth', colour: 'teal', heightMm: 214, thicknessMm: 40, dx: 10 },
  { kind: 'jacket', colour: 'slate', heightMm: 234, thicknessMm: 36, dx: 2 },
  { kind: 'cloth', colour: 'terracotta', heightMm: 222, thicknessMm: 42, dx: 14 },
  { kind: 'leather', colour: 'walnut', heightMm: 245, thicknessMm: 48, dx: 0 },
]

/** Desk books carry a title and no author, so they are drawn longer than shelf books to give it room. */
const LENGTHEN = 1.3

interface DeskPileProps {
  entries: ExperienceEntry[]
  label: string
  chosen: string | null
  peek: string | null
  controls: (entry: ExperienceEntry) => string
  onChoose: (entry: ExperienceEntry) => void
}

/** One drawn book per thread of experience, lying in a pile on the desk. */
export function DeskPile({ entries, label, chosen, peek, controls, onChoose }: DeskPileProps) {
  const books = useMemo(
    () =>
      entries.map((entry, i) => {
        const binding = BINDINGS[i % BINDINGS.length]!
        const book: Book = { title: entry.title, author: '', shelf: 'loved', ...binding }
        const spec = specFor(book)
        return { entry, book, spec, length: Math.round(spec.height * LENGTHEN), dx: binding.dx }
      }),
    [entries],
  )

  return (
    <div className="xp-desk">
      <ShelfDefs />
      <ol className="xp-pile" role="list" aria-label={label}>
        {books.map(({ entry, book, spec, length, dx }, i) => (
          <li
            key={entry.id}
            className="xp-pile__item"
            style={{ '--w': length, '--h': spec.thick, '--dx': dx, '--b': books.length - 1 - i } as CSSProperties}
          >
            <button
              type="button"
              className="xp-book"
              aria-label={entry.title}
              aria-pressed={chosen === entry.id}
              aria-controls={controls(entry)}
              data-peek={peek === entry.id && chosen !== entry.id ? '' : undefined}
              onClick={() => onChoose(entry)}
            >
              <span className="xp-book__rot">
                <BookSpine book={book} spec={spec} h={length} />
              </span>
            </button>
          </li>
        ))}
      </ol>
      <ShelfBoard className="bs-board xp-desk__board" />
    </div>
  )
}
