import { describe, expect, it } from 'vitest'
import { withNotes } from '../content/notes'
import type { Book } from '../content/types'
import { compose, PROMPTS, sentence, voiceCheck } from '../dev/bookNotes/voice'

describe('sentence', () => {
  it('capitalises and ends an answer, and keeps your words', () => {
    expect(sentence('  how quiet it is ')).toBe('How quiet it is.')
    expect(sentence('Twice?')).toBe('Twice?')
    expect(sentence('')).toBe('')
  })

  it('puts the lead in front only once', () => {
    expect(sentence('anyone new to product', 'For ')).toBe('For anyone new to product.')
    expect(sentence('for my sister', 'For ')).toBe('For my sister.')
  })
})

describe('compose', () => {
  it('joins the answers in order and skips the empty ones', () => {
    const note = compose(PROMPTS.loved, { one: 'how quiet it is', three: 'anyone who likes short novels' })
    expect(note).toBe('How quiet it is. For anyone who likes short novels.')
  })
})

describe('voiceCheck', () => {
  it('is quiet for a plain note', () => {
    expect(voiceCheck('How quiet it is. I read it in two evenings.')).toEqual([])
  })

  it('points out blurb phrases, dashes and exclamation marks', () => {
    const found = voiceCheck('A must-read masterpiece — truly thought-provoking!').map((f) => f.found)
    expect(found).toEqual(expect.arrayContaining(['must-read', 'masterpiece', '—', 'thought-provoking', '!']))
  })

  it('asks for less when a note runs long', () => {
    expect(voiceCheck('One. Two. Three. Four.').some((f) => f.found.startsWith('4 sentences'))).toBe(true)
  })
})

describe('withNotes', () => {
  const books: Book[] = [
    { title: 'La perra', author: 'Pilar Quintana', shelf: 'loved' },
    { title: 'Inspired', author: 'Marty Cagan', shelf: 'work', note: 'Typed in content.ts.' },
  ]

  it('adds saved notes by title and leaves the rest alone', () => {
    const out = withNotes(books, { 'La perra': ' How quiet it is. ', Other: 'x' })
    expect(out[0]!.note).toBe('How quiet it is.')
    expect(out[1]!.note).toBe('Typed in content.ts.')
  })
})
