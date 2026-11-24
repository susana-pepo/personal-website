import { useEffect, useMemo, useRef, useState } from 'react'
import { content } from '../../content/content'
import { compose, PROMPTS, voiceCheck, type Answers } from './voice'
import './BookNotes.css'

/**
 * Development only, at /?notes: a few quick questions per book, and your answers become
 * the book's note on the shelf, word for word. Saving writes src/content/bookNotes.json
 * through the dev server (vite.config.ts), so the shelf in another tab updates at once.
 */

const DRAFTS_KEY = 'book-notes-drafts'

interface Draft {
  answers: Answers
  /** Set once you edit the note itself; then your answers no longer rewrite it. */
  note?: string
}

function loadDrafts(): Record<string, Draft> {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, Draft>) : {}
  } catch {
    return {}
  }
}

function storeDrafts(drafts: Record<string, Draft>) {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
  } catch {
    /* a private window: drafts just don't survive a reload */
  }
}

const books = content.bookshelf.books
const shelves = content.bookshelf.shelves

export function BookNotes() {
  const [saved, setSaved] = useState<Record<string, string>>(() =>
    Object.fromEntries(books.filter((b) => b.note).map((b) => [b.title, b.note!])),
  )
  const [current, setCurrent] = useState<string>(() => (books.find((b) => !b.note) ?? books[0])?.title ?? '')
  const [drafts, setDrafts] = useState<Record<string, Draft>>(loadDrafts)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const firstField = useRef<HTMLInputElement>(null)

  const book = books.find((b) => b.title === current)
  const prompts = book ? PROMPTS[book.shelf] : []
  const draft: Draft = drafts[current] ?? { answers: {} }
  const fromAnswers = compose(prompts, draft.answers)
  const note = draft.note ?? (fromAnswers || saved[current] || '')
  const flags = useMemo(() => voiceCheck(note), [note])
  const unchanged = note.trim() === (saved[current] ?? '')

  useEffect(() => storeDrafts(drafts), [drafts])
  useEffect(() => {
    setStatus(null)
    firstField.current?.focus()
  }, [current])

  const update = (next: Partial<Draft>) =>
    setDrafts((all) => ({ ...all, [current]: { ...(all[current] ?? { answers: {} }), ...next } }))

  const nextBook = (from: string, notes: Record<string, string>) => {
    const at = books.findIndex((b) => b.title === from)
    const rest = [...books.slice(at + 1), ...books.slice(0, at)]
    return (rest.find((b) => !notes[b.title]) ?? rest[0])?.title ?? from
  }

  async function save(text: string) {
    if (!book) return
    setBusy(true)
    setStatus(null)
    try {
      const response = await fetch('/__dev/book-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: book.title, note: text }),
      })
      const body = (await response.json()) as { notes?: Record<string, string>; error?: string }
      if (!response.ok || !body.notes) throw new Error(body.error ?? 'The note could not be saved.')
      setSaved(body.notes)
      setDrafts((all) => {
        const rest = { ...all }
        delete rest[book.title]
        return rest
      })
      setStatus({ kind: 'ok', text: text.trim() ? `Saved. It’s on the shelf under ${book.title}.` : 'Note removed.' })
      if (text.trim()) setCurrent(nextBook(book.title, body.notes))
    } catch (error) {
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : 'The note could not be saved.' })
    } finally {
      setBusy(false)
    }
  }

  const done = books.filter((b) => saved[b.title]).length

  return (
    <div className="bn">
      <header className="bn-head">
        <h1 className="bn-title">Book notes</h1>
        <p className="bn-lede">
          A few quick questions for each book. Your answers become its note on the shelf, word for word. Skip any you
          like.
        </p>
        <p className="bn-meta">
          {done} of {books.length} have a note · only on your computer, not on the live site ·{' '}
          <a href="/#bookshelf" target="_blank" rel="noreferrer">
            See the shelf
          </a>
        </p>
      </header>

      <div className="bn-body">
        <nav className="bn-list" aria-label="Books">
          {shelves.map((shelf) => {
            const own = books.filter((b) => b.shelf === shelf.id)
            if (!own.length) return null
            return (
              <section key={shelf.id}>
                <h2 className="bn-shelf">{shelf.title}</h2>
                <ul>
                  {own.map((b) => (
                    <li key={b.title}>
                      <button
                        type="button"
                        className="bn-book"
                        aria-current={b.title === current ? 'true' : undefined}
                        onClick={() => setCurrent(b.title)}
                      >
                        <span className="bn-book__title">{b.title}</span>
                        {saved[b.title] && <span className="bn-book__done">has a note</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </nav>

        {book && (
          <form
            className="bn-card"
            onSubmit={(event) => {
              event.preventDefault()
              void save(note)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void save(note)
              }
            }}
          >
            <div className="bn-book-head">
              {book.cover && <img className="bn-cover" src={book.cover} alt="" width={72} />}
              <div>
                <h2 className="bn-book-title">{book.title}</h2>
                <p className="bn-author">{book.author}</p>
              </div>
            </div>

            {prompts.map((p, i) => (
              <label key={p.key} className="bn-q">
                <span className="bn-q__ask">{p.question}</span>
                <span className="bn-q__row">
                  {p.lead && <span className="bn-q__lead">{p.lead.trim()}</span>}
                  <input
                    ref={i === 0 ? firstField : undefined}
                    className="bn-input"
                    value={draft.answers[p.key] ?? ''}
                    placeholder={p.example}
                    onChange={(event) =>
                      update({ answers: { ...draft.answers, [p.key]: event.target.value } })
                    }
                  />
                </span>
              </label>
            ))}

            <label className="bn-q bn-q--note">
              <span className="bn-q__ask">The note</span>
              <textarea
                className="bn-input bn-note"
                rows={3}
                value={note}
                placeholder="Your answers appear here. Change anything."
                onChange={(event) => update({ note: event.target.value })}
              />
            </label>
            {draft.note !== undefined && fromAnswers && (
              <button type="button" className="bn-link" onClick={() => update({ note: undefined })}>
                Put my answers back together
              </button>
            )}

            <div className="bn-check" aria-live="polite">
              {note.trim() === '' ? null : flags.length === 0 ? (
                <p className="bn-check__ok">Reads like you.</p>
              ) : (
                <ul>
                  {flags.map((f) => (
                    <li key={f.found + f.hint}>
                      <q>{f.found}</q> {f.hint}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {note.trim() && (
              <figure className="bn-preview">
                <figcaption>On the shelf</figcaption>
                <p className="bn-preview__title">{book.title}</p>
                <p className="bn-preview__author">{book.author}</p>
                <p className="bn-preview__note">{note.trim()}</p>
              </figure>
            )}

            <div className="bn-actions">
              <button type="submit" className="bn-save" disabled={busy || !note.trim() || unchanged}>
                Save note
              </button>
              <button type="button" className="bn-link" onClick={() => setCurrent(nextBook(book.title, saved))}>
                Skip for now
              </button>
              {saved[book.title] && (
                <button type="button" className="bn-link bn-link--quiet" disabled={busy} onClick={() => void save('')}>
                  Remove note
                </button>
              )}
              <span className="bn-hint">⌘ Return saves</span>
            </div>
            {status && (
              <p className={`bn-status bn-status--${status.kind}`} role="status">
                {status.text}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

