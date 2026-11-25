import { describe, expect, it } from 'vitest'
import { NARROW_REM, PAIR_REM, shelfLayout } from '../components/sections/bookshelf/layout'

const REM = 16

describe('shelfLayout', () => {
  it('on a phone or tablet follows the width of the shelves, as the CSS thresholds did', () => {
    expect(shelfLayout(0, REM, false)).toEqual({ paired: false, narrow: false })
    expect(shelfLayout(358, REM, false)).toEqual({ paired: false, narrow: true })
    expect(shelfLayout(NARROW_REM * REM, REM, false)).toEqual({ paired: false, narrow: true })
    expect(shelfLayout(NARROW_REM * REM + 1, REM, false)).toEqual({ paired: false, narrow: false })
    expect(shelfLayout(PAIR_REM * REM - 1, REM, false)).toEqual({ paired: false, narrow: false })
    expect(shelfLayout(PAIR_REM * REM, REM, false)).toEqual({ paired: true, narrow: false })
    expect(shelfLayout(576, REM, false)).toEqual({ paired: true, narrow: false })
  })

  it('on a desktop window always pairs the upper shelves and never takes the phone layout', () => {
    // the floating panel's column at 1280x800 (about 457px) and 1440x900 (about 527px)
    for (const width of [0, 457, NARROW_REM * REM, 527, 576]) {
      expect(shelfLayout(width, REM, true)).toEqual({ paired: true, narrow: false })
    }
  })

  it('follows the reader’s text size', () => {
    expect(shelfLayout(480, 20, false).narrow).toBe(true) // 24rem
    expect(shelfLayout(600, 20, false).paired).toBe(false) // 30rem
  })
})
