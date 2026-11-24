import type { Book } from './types'

/**
 * DEVELOPMENT PREVIEW ONLY. Every title, author and note here is an invented
 * placeholder, not one of Susana's books. The surnames are deliberately
 * placeholder words (Muster, Beispiel, Ejemplo, Probe, Platzhalter…) so they
 * cannot be mistaken for real picks. They only fill the shelves so the design
 * can be judged while `bookshelf.books` in content.ts is empty. They never
 * ship: the production build shows the real books or an empty shelf.
 */
export const SAMPLE_BOOKS: Book[] = [
  { title: 'A Room in the Rain', author: 'Mara Beispiel', shelf: 'reading', kind: 'jacket', colour: 'slate', note: 'Sample note: a sentence on why this one is open on the desk right now.' },
  { title: 'Notes on Listening', author: 'Paul Muster', shelf: 'reading', kind: 'paperback', colour: 'ochre', note: 'Sample note: what it changed about how you hear a room.' },
  { title: 'The Long Practice', author: 'Ines Ejemplo', shelf: 'reading', kind: 'cloth', colour: 'teal', note: 'Sample note: one or two sentences in your own words.' },
  { title: 'Small Hours', author: 'Lena Probe', shelf: 'reading', kind: 'paperback', colour: 'card' },

  { title: 'Field Notes on Making', author: 'Theo Platzhalter', shelf: 'work', kind: 'paperback', colour: 'card', note: 'Sample note: what this one changed about how you work.' },
  { title: 'The Patient Product', author: 'Ada Specimen', shelf: 'work', kind: 'jacket', colour: 'teal' },
  { title: 'Rights and Records', author: 'Jon Exemplar', shelf: 'work', kind: 'cloth', colour: 'ochre' },
  { title: 'Ordinary Light', author: 'Rosa Modelo', shelf: 'loved', kind: 'cloth', colour: 'terracotta', note: 'Sample note: the line you still think about.' },
  { title: 'The Second Movement', author: 'Jon Exemplar', shelf: 'loved', kind: 'leather', colour: 'walnut', note: 'Sample note: where you found it, and when.' },
  { title: 'Harmonics', author: 'Ada Specimen', shelf: 'loved', kind: 'jacket', colour: 'ink' },
  { title: 'Paper Boats', author: 'Theo Platzhalter', shelf: 'loved', kind: 'paperback', colour: 'rose', note: 'Sample note: read three times, the spine shows it.' },
  { title: 'Winter Index', author: 'Mara Beispiel', shelf: 'loved', kind: 'cloth', colour: 'slate' },
  { title: 'How Songs Travel', author: 'Paul Muster', shelf: 'loved', kind: 'jacket', colour: 'oxblood' },
  { title: 'The Archive of Small Things', author: 'Ines Ejemplo', shelf: 'loved', kind: 'cloth', colour: 'card' },
]
