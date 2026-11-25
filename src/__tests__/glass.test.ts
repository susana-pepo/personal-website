import { describe, expect, it } from 'vitest'
import { asLight, lampReach, mirrorAbove, mirrorBeside, reflectionFiles } from '../components/SectionPanel/glass'

describe('mirrorBeside', () => {
  // 1440×900: the room's stage and the docked sheet beside it, overlapping its right end.
  const stage = { left: 57, top: 97, width: 1326, height: 698 }
  const sheet = { left: 740, top: 12, width: 688, height: 876 }

  it("starts the mirrored still where the stage's right end lands, mirrored about the sheet's left edge", () => {
    expect(mirrorBeside(stage, sheet)).toEqual({ x: 740 - 1383, y: 85, w: 1326, h: 698 })
  })

  it('puts a point d px left of the edge d px inside the sheet', () => {
    const plate = mirrorBeside(stage, sheet)!
    // The still is mirrored left to right, so the stage's x maps to the plate's (right - x).
    const lampX = 700 // a point in the room 40px left of the sheet
    const inPlate = stage.left + stage.width - lampX
    expect(plate.x + inPlate).toBe(sheet.left - lampX)
  })

  it('follows the layout at any width', () => {
    const wide = mirrorBeside({ left: 240, top: 156, width: 1440, height: 758 }, { left: 1218, top: 14, width: 688, height: 1052 })
    expect(wide).toEqual({ x: 1218 - 1680, y: 142, w: 1440, h: 758 })
  })

  it('rounds to a tenth of a pixel', () => {
    expect(mirrorBeside({ left: 0.123, top: 0, width: 100.456, height: 50 }, { left: 80.01, top: 0, width: 10, height: 10 })).toEqual({
      x: -20.6,
      y: 0,
      w: 100.5,
      h: 50,
    })
  })

  it('gives up on a box it cannot measure', () => {
    expect(mirrorBeside({ ...stage, width: 0 }, sheet)).toBeNull()
    expect(mirrorBeside(stage, { ...sheet, height: Number.NaN })).toBeNull()
  })
})

describe('mirrorAbove', () => {
  it('hangs the still from the top edge, lined up with the room across', () => {
    expect(mirrorAbove({ left: 12, top: 120, width: 366, height: 206 }, { left: 8, top: 64, width: 374, height: 772 })).toEqual({
      x: 4,
      y: 0,
      w: 366,
      h: 206,
    })
  })

  it('gives up on a box it cannot measure', () => {
    expect(mirrorAbove({ left: 0, top: 0, width: 0, height: 0 }, { left: 0, top: 0, width: 10, height: 10 })).toBeNull()
  })
})

describe('lampReach', () => {
  it('is full when the bulb is beside the edge, or behind the sheet', () => {
    expect(lampReach(0)).toBe(1)
    expect(lampReach(40)).toBe(1)
    expect(lampReach(-300)).toBe(1)
  })

  it('eases off with distance but never goes dark', () => {
    const near = lampReach(120)
    const mid = lampReach(260)
    const far = lampReach(2000)
    expect(near).toBeLessThan(1)
    expect(mid).toBeLessThan(near)
    expect(far).toBe(0.35)
  })

  it('treats an unmeasured gap as near', () => {
    expect(lampReach(Number.NaN)).toBe(1)
  })
})

describe('reflection stills', () => {
  it('reads the light from the scene, night when unknown', () => {
    expect(asLight('midday')).toBe('midday')
    expect(asLight('dawn')).toBe('dawn')
    expect(asLight('night')).toBe('night')
    expect(asLight(null)).toBe('night')
    expect(asLight('dusk')).toBe('night')
  })

  it('names the files each layout needs', () => {
    expect(reflectionFiles('dawn', false)).toEqual(['/media/panel/reflection-dawn-face.webp', '/media/panel/reflection-dawn-edge.webp'])
    expect(reflectionFiles('night', true)).toEqual(['/media/panel/reflection-night-top.webp'])
  })
})
