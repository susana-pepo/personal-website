import { describe, expect, it } from 'vitest'
import {
  clampStart,
  columnsFrom,
  fileIndexForKey,
  genieKeyframes,
  selectionInView,
  startToShow,
} from '../components/sections/work/desktop'

describe('columnsFrom', () => {
  it('counts the files on the first row', () => {
    expect(columnsFrom([10, 10, 10, 10, 10])).toBe(5)
    expect(columnsFrom([10, 10.6, 10, 120, 120])).toBe(3)
    expect(columnsFrom([10, 90, 170])).toBe(1)
    expect(columnsFrom([])).toBe(1)
  })
})

describe('fileIndexForKey', () => {
  it('moves along a row and stops at the ends', () => {
    expect(fileIndexForKey(0, 'ArrowRight', 5, 5)).toBe(1)
    expect(fileIndexForKey(4, 'ArrowRight', 5, 5)).toBe(4)
    expect(fileIndexForKey(0, 'ArrowLeft', 5, 5)).toBe(0)
  })

  it('moves by a row in a single column, and stays put past the edge', () => {
    expect(fileIndexForKey(0, 'ArrowDown', 5, 1)).toBe(1)
    expect(fileIndexForKey(3, 'ArrowUp', 5, 1)).toBe(2)
    expect(fileIndexForKey(1, 'ArrowDown', 5, 5)).toBe(1)
    expect(fileIndexForKey(4, 'ArrowDown', 5, 1)).toBe(4)
  })

  it('jumps with Home and End and ignores other keys', () => {
    expect(fileIndexForKey(2, 'Home', 5, 5)).toBe(0)
    expect(fileIndexForKey(2, 'End', 5, 5)).toBe(4)
    expect(fileIndexForKey(2, 'Enter', 5, 5)).toBeNull()
    expect(fileIndexForKey(0, 'ArrowRight', 0, 5)).toBeNull()
  })
})

describe('genieKeyframes', () => {
  const file = { x: 110, y: 60, w: 100, h: 120 }
  const win = { x: 10, y: 20, w: 500, h: 400 }
  const frames = genieKeyframes(file, win)

  it('starts on the file, invisible', () => {
    expect(frames[0]).toMatchObject({ offset: 0, opacity: 0, transform: 'translate(100px, 40px) scale(0.2, 0.3)' })
  })

  it('reaches full width before full height', () => {
    const mid = frames.find((f) => f.offset === 0.55)!
    expect(mid.transform).toMatch(/^translate\(0px, 22px\) scale\(1, 0\.615\)$/)
  })

  it('lands exactly on the window', () => {
    expect(frames.at(-1)).toMatchObject({ offset: 1, opacity: 1, transform: 'translate(0px, 0px) scale(1, 1)' })
  })
})

describe('browsing three files at a time', () => {
  it('keeps the view inside the list', () => {
    expect(clampStart(-1, 3, 5)).toBe(0)
    expect(clampStart(4, 3, 5)).toBe(2)
    expect(clampStart(1, 3, 2)).toBe(0)
  })

  it('moves the view only as far as needed to show a file', () => {
    expect(startToShow(1, 0, 3, 5)).toBe(0)
    expect(startToShow(3, 0, 3, 5)).toBe(1)
    expect(startToShow(4, 0, 3, 5)).toBe(2)
    expect(startToShow(0, 2, 3, 5)).toBe(0)
    expect(startToShow(2, 2, 3, 5)).toBe(2)
  })
})

describe('selectionInView', () => {
  it('keeps the selected file among the three in view', () => {
    expect(selectionInView(0, 1, 3)).toBe(1)
    expect(selectionInView(4, 0, 3)).toBe(2)
    expect(selectionInView(3, 2, 3)).toBe(3)
  })
})
