import { describe, expect, it } from 'vitest'
import {
  detailSize,
  fitLettering,
  hash,
  layoutShelf,
  LIGHT_COLOURS,
  MIN_FONT,
  type PlacedBook,
  PALETTE,
  poseFor,
  SHELF_H,
  shelfRows,
  specFor,
  spineName,
  wrapWords,
} from '../content/bookGeometry'
import { content } from '../content/content'
import { SAMPLE_BOOKS } from '../content/sampleBooks'
import type { Book, Shelf } from '../content/types'

const book = (title: string, extra: Partial<Book> = {}): Book => ({ title, author: 'Ada Specimen', shelf: 'loved', ...extra })
const shelf = (id: Shelf['id'], object?: Shelf['object']): Shelf => ({ id, title: id, description: '', object })

describe('book geometry', () => {
  it('hashes like the original spine hash (FNV-1a)', () => {
    expect(hash('')).toBe(2166136261)
    expect(hash('a')).toBe(0xe40c292c)
  })

  it('draws the same book the same way every time', () => {
    const a = specFor(book('Ordinary Light'))
    const b = specFor(book('Ordinary Light'))
    expect(a).toEqual(b)
    expect(specFor(book('Low Tide'))).not.toEqual(a)
  })

  it('keeps every book within the shelf and its binding’s ranges', () => {
    for (const b of SAMPLE_BOOKS) {
      const s = specFor(b)
      expect(s.height).toBeGreaterThan(SHELF_H * 0.6)
      expect(s.height).toBeLessThanOrEqual(SHELF_H)
      expect(s.thick).toBeGreaterThanOrEqual(12)
      expect(s.thick).toBeLessThanOrEqual(60)
      if (s.kind === 'paperback') expect(s.height).toBeLessThanOrEqual(Math.round(SHELF_H * 0.76))
      else expect(s.creases).toHaveLength(0)
      expect(s.alt).not.toBe(s.col)
    }
  })

  it('honours the optional fields', () => {
    const s = specFor(book('Harmonics', { kind: 'paperback', colour: 'teal', heightMm: 245, thicknessMm: 20 }))
    expect(s.kind).toBe('paperback')
    expect(s.colour).toBe('teal')
    expect(s.col).toBe(PALETTE.teal)
    expect(s.height).toBe(SHELF_H)
    expect(s.thick).toBe(19)
  })

  it('never binds leather in a pale colour', () => {
    const s = specFor(book('Harmonics', { kind: 'leather', colour: 'card' }))
    expect(s.colour).toBe('walnut')
    expect(LIGHT_COLOURS.has(s.colour)).toBe(false)
  })

  it('puts the surname on the spine unless told otherwise', () => {
    expect(spineName(book('x', { author: 'Theo  Platzhalter ' }))).toBe('Platzhalter')
    expect(spineName(book('x', { author: 'Ines Ejemplo', spineAuthor: 'I. E.' }))).toBe('I. E.')
  })

  it('wraps cover titles by word', () => {
    expect(wrapWords('The Archive of Small Things', 14)).toEqual(['The Archive of', 'Small Things'])
    expect(wrapWords('Harmonics', 4)).toEqual(['Harmonics'])
  })

  it('shrinks lettering, leaves a name off, and cuts a title only as a last resort', () => {
    expect(fitLettering(40, 50, 10, false)).toEqual({ kind: 'fits' })
    expect(fitLettering(0, 50, 10, false)).toEqual({ kind: 'fits' })
    const shrink = fitLettering(100, 80, 10, false)
    expect(shrink).toEqual({ kind: 'shrink', fontSize: 8 })
    expect(fitLettering(400, 80, 10, true)).toEqual({ kind: 'hide' })
    const cut = fitLettering(400, 80, 10, false)
    expect(cut.kind).toBe('truncate')
    if (cut.kind === 'truncate') expect(cut.fontSize).toBeGreaterThanOrEqual(MIN_FONT)
  })

  it('sizes the 3D book from its proportions', () => {
    const s = specFor(book('Low Tide'))
    const d = detailSize(s)
    expect(d.ch).toBe(200)
    expect(d.cw).toBe(133)
    expect(d.t).toBeGreaterThanOrEqual(12)
  })
})

describe('shelf layout', () => {
  const reading = SAMPLE_BOOKS.filter((b) => b.shelf === 'reading')
  const loved = SAMPLE_BOOKS.filter((b) => b.shelf === 'loved')

  it('stands the first book of Reading now face out', () => {
    expect(poseFor(reading, 0, 'reading')).toBe('face')
    expect(poseFor(reading, 1, 'reading')).toBe('upright')
    const slots = layoutShelf(reading, shelf('reading'))
    expect(slots[0]?.type).toBe('face')
    expect(slots.some((s) => s.type === 'object')).toBe(false)
  })

  it('stands books upright unless a book asks to lean or lie flat, with the bookend against them', () => {
    expect(layoutShelf(loved, shelf('loved')).every((s) => s.type === 'upright')).toBe(true)
    const posed = [book('A'), book('B', { pose: 'lean' }), book('C', { pose: 'flat' }), book('D', { pose: 'flat' })]
    const slots = layoutShelf(posed, shelf('loved', 'bookend'))
    expect(slots.map((s) => s.type)).toEqual(['upright', 'lean', 'object', 'stack'])
    const stack = slots.find((s) => s.type === 'stack')
    if (stack?.type !== 'stack') throw new Error('expected a pile')
    expect(stack.books).toHaveLength(2)
    // Biggest at the bottom.
    expect(stack.books[0]!.spec.height).toBeLessThanOrEqual(stack.books[1]!.spec.height)
  })

  it('moves a pile to a board of its own on a narrow shelf, and only there', () => {
    const posed = [book('A'), book('B'), book('C', { pose: 'flat' }), book('D', { pose: 'flat' })]
    const slots = layoutShelf(posed, shelf('loved', 'bookend'))
    expect(shelfRows(slots, false)).toEqual([slots])
    const [upper, lower] = shelfRows(slots, true)
    expect(upper!.map((s) => s.type)).toEqual(['upright', 'upright', 'object'])
    expect(lower!.map((s) => s.type)).toEqual(['stack'])
    // Nothing to move: one board, however narrow.
    const plain = layoutShelf(loved, shelf('loved'))
    expect(shelfRows(plain, true)).toEqual([plain])
  })

  it('places every book exactly once and numbers them in shelf order', () => {
    for (const [books, s] of [
      [reading, shelf('reading')],
      [loved, shelf('loved', 'bookend')],
    ] as const) {
      const placed = layoutShelf(books, s).flatMap((slot): PlacedBook[] => (slot.type === 'stack' ? slot.books : slot.type === 'object' ? [] : [slot]))
      expect(placed.map((p) => p.position).sort((a, b) => a - b)).toEqual(books.map((_, i) => i + 1))
      for (const p of placed) expect(p.book).toBe(books[p.position - 1])
    }
  })

  it('darkens books further from the lamp on the right', () => {
    const slots = layoutShelf(loved, shelf('loved'))
    const shades = slots.flatMap((s) => (s.type === 'object' ? [] : [s.shade]))
    for (let i = 1; i < shades.length; i++) expect(shades[i]!).toBeLessThanOrEqual(shades[i - 1]!)
    expect(shades[0]!).toBeLessThanOrEqual(0.16)
  })

  it('gives every configured shelf a known object', () => {
    for (const s of content.bookshelf.shelves) {
      if (s.object) expect(['bookend']).toContain(s.object)
    }
  })

  it('marks every sample note as a sample', () => {
    for (const b of SAMPLE_BOOKS) if (b.note) expect(b.note).toMatch(/^Sample note:/)
  })
})
