import type { Book } from './types'
import saved from './bookNotes.json'

/**
 * Book notes written on the notes page (open /?notes while `npm run dev` runs) are saved in
 * bookNotes.json, keyed by title. They win over a note typed straight into content.ts.
 */
export function withNotes(books: Book[], notes: Record<string, string> = saved): Book[] {
  return books.map((book) => {
    const note = notes[book.title]?.trim()
    return note ? { ...book, note } : book
  })
}
