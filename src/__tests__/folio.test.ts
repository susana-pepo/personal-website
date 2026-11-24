import { describe, expect, it } from 'vitest'
import { content } from '../content/content'
import { SECTION_IDS } from '../content/types'
import {
  inkTransform,
  objectLabel,
  pad,
  readDuration,
  readingProgress,
  tabIndexForKey,
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
