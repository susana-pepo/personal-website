/**
 * How a book looks, derived from its data alone. Pure functions, no DOM.
 *
 * Height, thickness, lettering layout, sun-fade, wear and creases all come from
 * a hash of the title and author, so a book always looks the same and a new one
 * needs no artwork. Every size is in "book units" (the CSS multiplies by --u).
 */
import type { Book, BookColour, BookKind, BookPose, Shelf, ShelfObject } from './types'

/** Tallest book the shelf holds, in book units. */
export const SHELF_H = 186

export interface Swatch {
  /** Cloth, leather or paper. */
  c: string
  /** Lettering on it. */
  t: string
}

/** Colours are all taken from the room, plus one oxblood for old leather. */
export const PALETTE: Record<BookColour, Swatch> = {
  walnut: { c: 'oklch(0.42 0.075 50)', t: 'oklch(0.93 0.01 80)' },
  terracotta: { c: 'oklch(0.55 0.13 40)', t: 'oklch(0.96 0.01 80)' },
  rose: { c: 'oklch(0.72 0.065 28)', t: 'oklch(0.22 0.01 45)' },
  teal: { c: 'oklch(0.36 0.045 185)', t: 'oklch(0.93 0.01 80)' },
  slate: { c: 'oklch(0.46 0.05 262)', t: 'oklch(0.94 0.01 80)' },
  ochre: { c: 'oklch(0.76 0.095 78)', t: 'oklch(0.22 0.01 45)' },
  card: { c: 'oklch(0.9 0.015 80)', t: 'oklch(0.25 0.01 45)' },
  ink: { c: 'oklch(0.25 0.012 45)', t: 'oklch(0.9 0.01 80)' },
  oxblood: { c: 'oklch(0.37 0.09 25)', t: 'oklch(0.92 0.01 80)' },
}
export const COLOUR_KEYS = Object.keys(PALETTE) as BookColour[]
/** Pale colours: no gilt on these, dark lettering instead. */
export const LIGHT_COLOURS: ReadonlySet<BookColour> = new Set<BookColour>(['rose', 'ochre', 'card'])

const KINDS: BookKind[] = ['cloth', 'jacket', 'paperback', 'cloth', 'leather', 'jacket']
export type Motif = 'sun' | 'horizon' | 'arc' | 'grid' | 'band' | 'stack'
const MOTIFS: Motif[] = ['sun', 'horizon', 'arc', 'grid', 'band', 'stack']

/** [min height, max height] as a share of SHELF_H, then [min, max] thickness in units. */
const RANGES: Record<BookKind, [number, number, number, number]> = {
  cloth: [0.8, 0.96, 24, 40],
  leather: [0.86, 0.98, 28, 44],
  jacket: [0.78, 0.95, 26, 38],
  paperback: [0.64, 0.76, 17, 27],
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** FNV-1a: a small, stable string hash. */
export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** mulberry32: a seeded generator, so each book draws the same numbers every time. */
export function prng(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface BookSpec {
  seed: number
  kind: BookKind
  colour: BookColour
  /** True for pale colours. */
  light: boolean
  col: Swatch
  /** A second colour for bands, blocks and motifs. */
  alt: Swatch
  /** In book units. */
  height: number
  thick: number
  /** Which lettering layout a cloth or jacket spine uses (0, 1 or 2). */
  variant: number
  faded: boolean
  /** 0 to 1: how rubbed the head and tail are. */
  wear: number
  /** Where the slip of paper sits across the top, 0 to 1. */
  slipX: number
  motif: Motif
  /** Paperback reading creases: [x as a share of width, jitter 0 to 1]. */
  creases: [number, number][]
}

/** A swatch from a real spine colour ('#rrggbb'), with ink that reads on it. */
export function realSwatch(hex: string): Swatch & { light: boolean } {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  const lin = (v: number) => {
    const x = v / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  const light = lum > 0.35
  return { c: hex, t: light ? PALETTE.ink.c : PALETTE.card.c, light }
}

/** Everything about how a book looks, derived once from its data. Same book, same look. */
export function specFor(book: Book): BookSpec {
  const seed = hash(book.title + '|' + book.author)
  const r = prng(seed)
  const kind = book.kind ?? KINDS[seed % KINDS.length]!
  // Always draw, so a given colour override does not shift the other numbers.
  const drawn = COLOUR_KEYS[Math.floor(r() * COLOUR_KEYS.length)]!
  let colour = book.colour ?? drawn
  if (kind === 'leather' && LIGHT_COLOURS.has(colour)) colour = 'walnut'

  const [h0, h1, t0, t1] = RANGES[kind]
  let height = Math.round(SHELF_H * lerp(h0, h1, r()))
  let thick = Math.round(lerp(t0, t1, r()))
  // Real dimensions win when given (a 245mm book is the tallest the shelf holds).
  if (book.heightMm) height = Math.round(SHELF_H * clamp(book.heightMm / 245, 0.5, 1))
  if (book.thicknessMm) thick = Math.round(clamp(book.thicknessMm * 0.95, 12, 60))
  // A real book's spine is drawn wide enough to carry its whole title.
  else if (book.spineColour) thick = Math.max(thick, 26)

  const real = book.spineColour ? realSwatch(book.spineColour) : null
  const light = real ? real.light : LIGHT_COLOURS.has(colour)
  const altPool = COLOUR_KEYS.filter(
    (k) => k !== colour && (light ? !LIGHT_COLOURS.has(k) : k !== 'ink' && k !== 'walnut'),
  )
  const altKey = altPool[Math.floor(r() * altPool.length)]!
  const variant = Math.floor(r() * 3)
  const faded = r() < 0.4
  const wear = r()
  const slipX = 0.2 + r() * 0.45
  const motif = MOTIFS[Math.floor(r() * MOTIFS.length)]!
  const creases: [number, number][] =
    kind === 'paperback' ? Array.from({ length: 1 + Math.floor(r() * 3) }, () => [0.25 + r() * 0.5, r()]) : []

  // A real book keeps one colour: no invented series band or second colour.
  const col = real ? { c: real.c, t: real.t } : PALETTE[colour]
  const alt = real ? { ...col } : PALETTE[altKey]!
  return { seed, kind, colour, light, col, alt, height, thick, variant, faded, wear, slipX, motif, creases }
}

/** Spines carry the surname, as most real ones do; the detail shows the full name. */
export function spineName(book: Book): string {
  if (book.spineAuthor) return book.spineAuthor
  const parts = book.author.trim().split(/\s+/)
  return parts[parts.length - 1] ?? ''
}

/** Greedy word wrap by character count, for cover titles. */
export function wrapWords(text: string, maxChars: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word
    else if ((line + ' ' + word).length <= maxChars) line += ' ' + word
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

export type FitResult = { kind: 'fits' } | { kind: 'shrink'; fontSize: number } | { kind: 'hide' } | { kind: 'truncate'; fontSize: number }

/** Smallest legible lettering, in book units. */
export const MIN_FONT = 5.2
export const TRUNCATE_FONT = 5.6

/**
 * What to do with lettering of measured length `length` at `fontSize` in a panel `max` long.
 * Shrink if that keeps it legible; otherwise leave optional text (the author) off,
 * and only cut a title short as a last resort.
 */
export function fitLettering(length: number, max: number, fontSize: number, optional: boolean): FitResult {
  if (!length || length <= max) return { kind: 'fits' }
  const shrunk = (fontSize * max) / length
  if (shrunk >= MIN_FONT) return { kind: 'shrink', fontSize: shrunk }
  if (optional) return { kind: 'hide' }
  return { kind: 'truncate', fontSize: TRUNCATE_FONT }
}

/* ───────────── Shelf layout ───────────── */

export function poseFor(books: Book[], i: number, shelfId: Shelf['id']): BookPose {
  const book = books[i]
  if (book?.pose) return book.pose
  if (shelfId === 'reading' && i === 0) return 'face'
  return 'upright'
}

export interface PlacedBook {
  book: Book
  spec: BookSpec
  /** 1-based position on the shelf, in data order. */
  position: number
}

export type Slot =
  | (PlacedBook & { type: 'upright'; w: number; h: number; shade: number })
  | (PlacedBook & { type: 'face'; w: number; h: number; shade: number })
  | (PlacedBook & { type: 'lean'; w: number; h: number; shade: number; lean: number; marginLeft: number; marginRight: number })
  | {
      type: 'stack'
      /** Read top to bottom: the biggest book lies at the bottom. */
      books: (PlacedBook & { dx: number })[]
      w: number
      h: number
      shade: number
    }
  | { type: 'object'; object: ShelfObject; w: number; h: number }

export const OBJECT_SIZE: Record<ShelfObject, { w: number; h: number }> = {
  // The photo's own proportions, about two thirds the height of a 23 cm book.
  bookend: { w: 74, h: 118 },
}

const LEAN_DEG = 7
/** Distance at which the lamp (on the right) no longer reaches, in units. */
const LAMP_REACH = 520

/**
 * Lays a shelf out from its books: poses, sizes, the darkening away from the
 * lamp, the pile, and the shelf's object. Pure, so it can be unit-tested.
 */
export function layoutShelf(books: Book[], shelf: Shelf): Slot[] {
  const slots: Slot[] = []
  const flat: PlacedBook[] = []
  let x = 0
  let prevH: number | null = null
  // Books further from the lamp sit a little darker.
  const shade = (w: number) => {
    const mid = x + w / 2
    x += w + 1
    return Number((0.16 * clamp(1 - mid / LAMP_REACH, 0, 1)).toFixed(3))
  }

  books.forEach((book, i) => {
    const spec = specFor(book)
    const placed = { book, spec, position: i + 1 }
    const pose = poseFor(books, i, shelf.id)
    if (pose === 'face') {
      const w = Math.round(spec.height * 0.667)
      slots.push({ ...placed, type: 'face', w, h: spec.height, shade: shade(w) })
      prevH = spec.height * 0.9
    } else if (pose === 'lean') {
      const contact = Math.min(prevH ?? spec.height, spec.height)
      const marginLeft = Math.round(contact * Math.tan((LEAN_DEG * Math.PI) / 180)) - 2
      slots.push({
        ...placed,
        type: 'lean',
        w: spec.thick,
        h: spec.height,
        shade: shade(spec.thick + marginLeft),
        lean: LEAN_DEG,
        marginLeft,
        marginRight: Math.round(spec.height * 0.05),
      })
      prevH = null
    } else if (pose === 'flat') {
      flat.push(placed)
    } else {
      slots.push({ ...placed, type: 'upright', w: spec.thick, h: spec.height, shade: shade(spec.thick) })
      prevH = spec.height
    }
  })

  // The bookend stands against the last upright book, holding the row up; any pile lies beyond it.
  if (shelf.object) {
    slots.push({ type: 'object', object: shelf.object, ...OBJECT_SIZE[shelf.object] })
  }

  if (flat.length) {
    const pile = [...flat].sort((a, b) => a.spec.height - b.spec.height)
    const w = Math.max(...pile.map((p) => p.spec.height))
    const h = pile.reduce((n, p) => n + p.spec.thick, 0)
    slots.push({
      type: 'stack',
      books: pile.map((p) => ({ ...p, dx: Math.round((p.spec.seed % 9) - 4 + (w - p.spec.height) * 0.5) })),
      w,
      h,
      shade: shade(w + 8),
    })
  }
  return slots
}

/**
 * The shelf's boards. On a narrow shelf a pile of books lying flat moves to a board of its
 * own beneath the upright books, so the whole shelf shows without sliding sideways.
 */
export function shelfRows(slots: Slot[], narrow: boolean): Slot[][] {
  const pile = slots.findIndex((s) => s.type === 'stack')
  return narrow && pile > 0 ? [slots.slice(0, pile), slots.slice(pile)] : [slots]
}

/** Size of the 3D book in the detail drawer, in CSS pixels. */
export function detailSize(spec: BookSpec, coverHeight = 200) {
  return {
    ch: coverHeight,
    cw: Math.round(coverHeight * 0.667),
    t: Math.max(12, Math.round((spec.thick * coverHeight) / spec.height)),
  }
}
