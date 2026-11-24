import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { saveNote } from './bookNotes'

describe('saveNote', () => {
  let dir = ''
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

  it('writes, replaces and removes a note', () => {
    dir = mkdtempSync(join(tmpdir(), 'notes-'))
    const file = join(dir, 'bookNotes.json')
    expect(saveNote(file, 'La perra', ' How quiet it is. ')).toEqual({ 'La perra': 'How quiet it is.' })
    saveNote(file, 'Inspired', 'For anyone new to product.')
    expect(saveNote(file, 'La perra', '')).toEqual({ Inspired: 'For anyone new to product.' })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ Inspired: 'For anyone new to product.' })
  })

  it('refuses a missing title or an overlong note', () => {
    dir = mkdtempSync(join(tmpdir(), 'notes-'))
    const file = join(dir, 'bookNotes.json')
    expect(() => saveNote(file, ' ', 'x')).toThrow()
    expect(() => saveNote(file, 'A', 'x'.repeat(601))).toThrow()
  })
})
