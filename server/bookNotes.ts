import { readFileSync, writeFileSync } from 'node:fs'

/**
 * Development only: the store behind the book notes page (src/dev/bookNotes, opened at
 * /?notes). The notes live in src/content/bookNotes.json, keyed by book title, and the
 * bookshelf reads them from there. Writing the file lets Vite reload the shelf at once.
 */

export const MAX_TITLE = 200
export const MAX_NOTE = 600

export type BookNotes = Record<string, string>

export function readNotes(file: string): BookNotes {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === 'string'))
  } catch {
    return {}
  }
}

/** Sets one book's note, or removes it when the note is empty. Returns every note after the change. */
export function saveNote(file: string, title: string, note: string): BookNotes {
  const t = title.trim()
  const n = note.trim()
  if (!t || t.length > MAX_TITLE) throw new Error('A book title is needed (at most 200 characters).')
  if (n.length > MAX_NOTE) throw new Error('Keep the note under 600 characters.')
  const notes = readNotes(file)
  if (n) notes[t] = n
  else delete notes[t]
  writeFileSync(file, `${JSON.stringify(notes, null, 2)}\n`)
  return notes
}
