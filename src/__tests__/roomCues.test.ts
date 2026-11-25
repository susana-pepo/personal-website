import { describe, expect, it } from 'vitest'
import { content } from '../content/content'
import { TELL_CYCLE_MS } from '../scene/glimmers'
import { HOTSPOTS } from '../scene/hotspots'
import { BREATH_MS, FIRST_CUE_MS, QUIET_AFTER_MS, cueGap, linesLeft, nextHint, nextLine, type Line } from '../scene/roomCues'

const LINES: Line[] = [
  { about: 'books', text: 'You can find some of the books I love on the bookshelf.' },
  { about: 'vinyl', text: 'Have you checked out my record player?' },
  { about: 'cat', text: 'Meet Pola. She loves a little attention.' },
]

describe('the room’s cues and Susana’s lines', () => {
  it('give the glimmers’ hints in turn, well paced, starting just after her greeting and second line', () => {
    expect(nextHint(['cat', 'lamp', 'piano'], null)).toBe('cat')
    expect(nextHint(['cat', 'lamp', 'piano'], 'cat')).toBe('lamp')
    expect(nextHint(['cat', 'piano'], 'piano')).toBe('cat')
    expect(nextHint([], 'cat')).toBeNull()
    expect(cueGap(['cat', 'lamp', 'piano'])).toBe(TELL_CYCLE_MS / 3)
    expect(cueGap(['piano'])).toBe(TELL_CYCLE_MS)
    expect(FIRST_CUE_MS).toBeLessThanOrEqual(1000)
    expect(QUIET_AFTER_MS).toBeLessThanOrEqual(1500)
    expect(BREATH_MS).toBeLessThan(TELL_CYCLE_MS / 3)
  })

  it('on hover, only mention what is still to find or open', () => {
    expect(linesLeft(LINES, ['cat'], ['books', 'vinyl']).map((l) => l.about)).toEqual(['books', 'vinyl', 'cat'])
    expect(linesLeft(LINES, [], ['vinyl']).map((l) => l.about)).toEqual(['vinyl'])
    expect(linesLeft(LINES, [], [])).toEqual([])
  })

  it('on hover, never say the same line twice running', () => {
    for (const last of LINES)
      for (const random of [0, 0.4, 0.99, 1]) expect(nextLine(LINES, last.text, random)?.text).not.toBe(last.text)
    expect(nextLine([LINES[0]!], LINES[0]!.text, 0.5)).toBe(LINES[0])
    expect(nextLine([], null, 0.5)).toBeNull()
  })

  it('has a line for every glimmer and every section object, each about something in the room', () => {
    const objects = new Set(HOTSPOTS.flatMap((h) => (h.action ? [h.id] : h.section && h.overlay && h.overlay !== 'woman' ? [h.overlay] : [])))
    const mentioned = new Set(content.susana.lines.map((l) => l.about))
    for (const object of objects) expect(mentioned, object).toContain(object)
    for (const about of mentioned) expect(objects, about).toContain(about)
  })
})
