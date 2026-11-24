import { describe, expect, it } from 'vitest'
import { content } from '../content/content'
import { SECTION_IDS } from '../content/types'
import {
  inkTransform,
  lampOnSheet,
  objectLabel,
  pad,
  readDuration,
  readingProgress,
  tabIndexForKey,
  tabRowScroll,
  turnDirection,
} from '../components/SectionPanel/folio'

describe('turnDirection', () => {
  it('moves forward on first open and when turning to a later section', () => {
    expect(turnDirection(null, 'music')).toBe(1)
    expect(turnDirection('work', 'contact')).toBe(1)
  })

  it('moves back when turning to an earlier section', () => {
    expect(turnDirection('contact', 'work')).toBe(-1)
    expect(turnDirection('experience', 'about')).toBe(-1)
  })
})

describe('objectLabel', () => {
  it('names the object a section lives in, capitalised, or nothing', () => {
    for (const id of SECTION_IDS) {
      const name = content.sections[id].objectName
      const label = objectLabel(id)
      if (!name) expect(label).toBe('')
      else expect(label.toLowerCase()).toBe(name.trim().toLowerCase())
      if (label) expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase())
    }
  })
})

describe('tabIndexForKey', () => {
  it('wraps with the arrow keys and jumps with Home and End', () => {
    expect(tabIndexForKey(0, 'ArrowRight', 6)).toBe(1)
    expect(tabIndexForKey(5, 'ArrowRight', 6)).toBe(0)
    expect(tabIndexForKey(0, 'ArrowLeft', 6)).toBe(5)
    expect(tabIndexForKey(3, 'Home', 6)).toBe(0)
    expect(tabIndexForKey(3, 'End', 6)).toBe(5)
  })

  it('ignores other keys and focus outside the tabs', () => {
    expect(tabIndexForKey(2, 'Enter', 6)).toBeNull()
    expect(tabIndexForKey(-1, 'ArrowRight', 6)).toBeNull()
    expect(tabIndexForKey(0, 'ArrowRight', 0)).toBeNull()
  })
})

describe('readingProgress', () => {
  it('only shows on pages that really scroll, once reading has started', () => {
    expect(readingProgress(0, 2000, 800)).toEqual({ fraction: 0, visible: false })
    expect(readingProgress(10, 820, 800).visible).toBe(false)
    expect(readingProgress(600, 2000, 800)).toEqual({ fraction: 0.5, visible: true })
  })

  it('clamps to the ends', () => {
    expect(readingProgress(5000, 2000, 800).fraction).toBe(1)
    expect(readingProgress(-20, 2000, 800).fraction).toBe(0)
    expect(readingProgress(0, 500, 800).fraction).toBe(0)
  })
})

describe('small helpers', () => {
  it('pads section numbers', () => {
    expect(pad(3)).toBe('03')
    expect(pad(12)).toBe('12')
  })

  it('scales the 100px ink mark to the tab', () => {
    expect(inkTransform(48, 75)).toBe('translateX(48px) scaleX(0.75)')
  })

  it('reads CSS durations', () => {
    expect(readDuration('240ms', 0)).toBe(240)
    expect(readDuration(' 0.12s', 0)).toBe(120)
    expect(readDuration('', 240)).toBe(240)
    expect(readDuration('fast', 240)).toBe(240)
  })
})

describe('tabRowScroll', () => {
  // Six tabs 60px wide with 16px between them, in a 200px window: the row is 446px, so 246px of scroll.
  const tabs = Array.from({ length: 6 }, (_, i) => ({ left: i * 76, width: 60 }))
  const max = 6 * 76 - 16 - 200

  it('rests on the tab before the current one, at its edge', () => {
    expect(tabRowScroll(tabs, 0, 200, max)).toBe(0)
    expect(tabRowScroll(tabs, 2, 200, max)).toBe(76)
    expect(tabRowScroll(tabs, 3, 200, max)).toBe(152)
  })

  it('near the end, takes the furthest edge that still shows the current tab, or the very end', () => {
    // the tab before the last starts past the end of the scroll; no edge shows the last tab whole
    expect(tabRowScroll(tabs, 5, 200, max)).toBe(max)
    // with room at the row's end (a phone's trailing padding), it rests on an edge again
    expect(tabRowScroll(tabs, 5, 200, max + 70)).toBe(304)
  })

  it('treats the faded end as hidden', () => {
    expect(tabRowScroll(tabs, 3, 200, max)).toBe(152)
    // with 80px faded, tab 3 would sit in the fade behind tab 2, so it leads itself
    expect(tabRowScroll(tabs, 3, 200, max, 80)).toBe(228)
  })

  it('at the end of the row, lets the last tab sit in the fade rather than cut a tab in two', () => {
    // no edge clears an 80px fade for the last tab; ignoring it, the edge of tab 4 shows it whole
    expect(tabRowScroll(tabs, 5, 200, max + 70, 80)).toBe(304)
  })
})

describe('lampOnSheet', () => {
  const sheet = { left: 738, top: 14, width: 688, height: 872 }

  it('places the bulb as percentages of the sheet', () => {
    expect(lampOnSheet({ x: 738 + 344, y: 14 + 436 }, sheet)).toEqual({ x: 50, y: 50 })
  })

  it('keeps the light off the rounded corners', () => {
    expect(lampOnSheet({ x: 0, y: 2000 }, sheet)).toEqual({ x: 12, y: 88 })
    expect(lampOnSheet({ x: 5000, y: -40 }, sheet)).toEqual({ x: 88, y: 12 })
  })

  it('gives up on a sheet or a bulb it cannot measure', () => {
    expect(lampOnSheet({ x: 10, y: 10 }, { ...sheet, width: 0 })).toBeNull()
    expect(lampOnSheet({ x: Number.NaN, y: 10 }, sheet)).toBeNull()
  })
})
