import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { content } from '../../content/content'
import { SAMPLE_BOOKS } from '../../content/sampleBooks'
import type { Book, ShelfId } from '../../content/types'
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { ShelfDefs } from './books/ShelfDefs'
import { ShelfRow } from './bookshelf/ShelfRow'
import { safeId } from './books/defs'
import './bookshelf/bookshelf.css'

// In development an empty shelf is filled with invented samples (their notes say so); the live site never shows them.
const BOOKS = import.meta.env.DEV && content.bookshelf.books.length === 0 ? SAMPLE_BOOKS : content.bookshelf.books
const BY_SHELF = new Map<ShelfId, Book[]>(content.bookshelf.shelves.map((s) => [s.id, BOOKS.filter((b) => b.shelf === s.id)]))
// A shelf appears once it has a book.
const SHELVES = content.bookshelf.shelves.filter((s) => (BY_SHELF.get(s.id)?.length ?? 0) > 0)
// With both, Reading now and Books for work can share a row (bookshelf.css), their drawers opening beneath it.
const PAIRED = SHELVES.some((s) => s.id === 'reading') && SHELVES.some((s) => s.id === 'work')

export default function BookshelfSection() {
  const { bookshelf } = content
  const [open, setOpen] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const idBase = `bs-${safeId(useId())}`
  const reducedMotion = usePrefersReducedMotion()

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

  const toggle = useCallback((key: string) => setOpen((current) => (current === key ? null : key)), [])

  return (
    <div className="section bookshelf" ref={rootRef}>
      <ShelfDefs />
      {bookshelf.intro && <p className="lede">{bookshelf.intro}</p>}

      {BOOKS.length === 0 && <p className="bs-empty">{bookshelf.emptyNote}</p>}

      <div className="bs-shelves" data-paired={PAIRED ? '' : undefined}>
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
          />
        ))}
      </div>
    </div>
  )
}
