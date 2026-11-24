import { describe, expect, it } from 'vitest'
import { parseHash, hrefFor } from '../lib/router'

describe('parseHash', () => {
  it('reads section hashes', () => {
    expect(parseHash('#work')).toBe('work')
    expect(parseHash('#/music')).toBe('music')
    expect(parseHash('#Contact')).toBe('contact')
  })

  it('ignores anything that is not a section', () => {
    expect(parseHash('')).toBeNull()
    expect(parseHash('#')).toBeNull()
    expect(parseHash('#main')).toBeNull()
    expect(parseHash('#work/extra')).toBeNull()
    expect(parseHash('#%E0%A4%A')).toBeNull()
  })

  it('round-trips with hrefFor', () => {
    expect(parseHash(hrefFor('bookshelf'))).toBe('bookshelf')
  })
})
