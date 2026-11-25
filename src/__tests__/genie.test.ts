import { describe, expect, it } from 'vitest'
import {
  CLOSE,
  OPEN,
  TUNING,
  coverT,
  cubicBezier,
  glintAt,
  landingT,
  openTimeline,
  partShadows,
  planMove,
  pointAt,
  reverseMs,
  sameGlass,
  shadowCloseAt,
  shadowOpenAt,
  silhouetteOf,
  sliceAt,
  splitShadows,
  sweepAt,
  travel,
  worstDistance,
} from '../components/SectionPanel/genie/geometry'

// 1440×900: the slab docked beside the room, and three objects as the room draws them.
const shell = { x: 801, y: 88, w: 615, h: 727 }
const recordPlayer = { cx: 150, cy: 520, w: 210, h: 130 }
const cup = { cx: 1050, cy: 690, w: 60, h: 70 }
const shelfTop = { cx: 1100, cy: 40, w: 120, h: 40 }

describe('cubicBezier', () => {
  it('runs from 0 to 1 and never backwards', () => {
    for (const b of [TUNING.ease, TUNING.closeEase]) {
      const f = cubicBezier(b)
      expect(f(0)).toBe(0)
      expect(f(1)).toBe(1)
      let last = 0
      for (let x = 0.01; x <= 1; x += 0.01) {
        const y = f(x)
        expect(y).toBeGreaterThanOrEqual(last - 1e-9)
        last = y
      }
    }
  })

  it('matches the browser on a known curve (ease-in-out at its middle)', () => {
    expect(cubicBezier([0.42, 0, 0.58, 1])(0.5)).toBeCloseTo(0.5, 5)
  })

  it('never overshoots: the slab settles, it doesn’t bounce', () => {
    const f = cubicBezier(TUNING.ease)
    for (let x = 0; x <= 1; x += 0.005) expect(f(x)).toBeLessThanOrEqual(1)
  })
})

describe('planMove', () => {
  it('pours sideways from an object left of the dock, with the neck kept left of it', () => {
    const plan = planMove(recordPlayer, shell)
    expect(plan.axis).toBe(0)
    expect(plan.neck.x + plan.neck.w).toBeLessThan(shell.x)
  })

  it('rises out of an object under the dock and falls from one above it', () => {
    expect(planMove(cup, shell).axis).toBe(1)
    expect(planMove(shelfTop, shell).axis).toBe(2)
  })

  it('sizes the neck from the silhouette, within its limits', () => {
    const plan = planMove({ cx: 100, cy: 300, w: 1000, h: 10 }, shell)
    expect(plan.neck.h).toBe(TUNING.neck.min)
    expect(plan.neck.w).toBeLessThanOrEqual(TUNING.neck.max)
  })
})

describe('the pour', () => {
  const plan = planMove(recordPlayer, shell)

  it('starts in the object and ends in the dock, for both curves', () => {
    for (const shape of ['open', 'close'] as const) {
      expect(worstDistance(plan, 1, shape)).toBeLessThan(1e-6)
      const start = pointAt(plan, 0, shape, 0.5, 0.5)
      expect(start.x).toBeCloseTo(plan.neck.x + plan.neck.w / 2, 3)
      expect(start.y).toBeCloseTo(plan.neck.y + plan.neck.h / 2, 3)
    }
  })

  it('lets the far edge lead: it is further along than the near edge at every moment', () => {
    for (let T = 0.05; T < 1; T += 0.05) expect(travel(T, 1, 'open')).toBeGreaterThanOrEqual(travel(T, 0, 'open'))
  })

  it('closes on an accelerating curve: slow to leave the dock, quickest into the object', () => {
    // T falls from 1 to 0 as the close runs; each step of T moves the slab further than the last
    const steps = [1, 0.75, 0.5, 0.25, 0].map((T) => travel(T, 0.5, 'close'))
    const moves = steps.slice(1).map((s, i) => steps[i]! - s)
    expect(moves[0]!).toBeLessThan(moves[moves.length - 1]!)
  })

  it('widens only as it travels (the neck is narrow, the dock full)', () => {
    const early = sliceAt(plan, 0.3, 0.5, 'open')
    const late = sliceAt(plan, 0.95, 0.5, 'open')
    expect(early.c1 - early.c0).toBeLessThan(late.c1 - late.c0)
  })

  it('lands within the landing distance at landingT, not before', () => {
    const T = landingT(plan, OPEN.landPx)
    expect(worstDistance(plan, T)).toBeLessThanOrEqual(OPEN.landPx + 1e-6)
    expect(worstDistance(plan, T - 0.02)).toBeGreaterThan(OPEN.landPx)
  })

  it('covers the dock before it lands when pouring sideways', () => {
    expect(coverT(plan)).toBeLessThanOrEqual(landingT(plan))
  })
})

describe('openTimeline', () => {
  for (const [name, object] of [['record player', recordPlayer], ['cup', cup]] as const) {
    it(`keeps the beats in order for the ${name}`, () => {
      const tl = openTimeline(planMove(object, shell))
      expect(tl.anticipate).toBe(100)
      // the pour is stretched so it lands at 650
      expect(tl.anticipate + tl.pourMs * landingT(planMove(object, shell))).toBeCloseTo(OPEN.landAt, 3)
      // the contents rise as it lands, never long before, and are readable by about 800
      expect(tl.contentAt).toBeGreaterThanOrEqual(OPEN.landAt - OPEN.contentBefore)
      expect(tl.contentAt + 4 * 35).toBeLessThan(800)
      // the sweep runs 250-350ms from the landing, and the canvas hands over after it
      expect(tl.sweepMs).toBeGreaterThanOrEqual(250)
      expect(tl.sweepMs).toBeLessThanOrEqual(350)
      expect(tl.handoffAt).toBeGreaterThanOrEqual(tl.sweepAt + tl.sweepMs)
    })
  }

  it('closes in about 70-75% of the opening', () => {
    const total = CLOSE.fadeMs + CLOSE.pourMs
    expect(total / OPEN.landAt).toBeGreaterThan(0.7)
    expect(total / OPEN.landAt).toBeLessThan(0.75)
  })

  it('lets the contact shadow trail the slab by about 50ms', () => {
    const tl = openTimeline(planMove(recordPlayer, shell))
    expect(shadowOpenAt(tl.anticipate + tl.shadowLag, tl)).toBe(0)
    expect(shadowOpenAt(tl.landAt, tl)).toBeLessThan(1)
    expect(shadowOpenAt(tl.landAt + tl.shadowLag, tl)).toBe(1)
  })

  it('runs the sweep once, only in its window', () => {
    const tl = openTimeline(planMove(recordPlayer, shell))
    expect(sweepAt(tl.sweepAt - 1, tl)).toBeNull()
    expect(sweepAt(tl.sweepAt + tl.sweepMs / 2, tl)).toBeCloseTo(0.5)
    expect(sweepAt(tl.sweepAt + tl.sweepMs + 1, tl)).toBeNull()
  })

  it('lifts the shadow ahead of the slab on the way back', () => {
    expect(shadowCloseAt(0, CLOSE.pourMs)).toBeLessThan(1)
    expect(shadowCloseAt(CLOSE.pourMs, CLOSE.pourMs)).toBe(0)
  })
})

describe('glintAt', () => {
  it('is dark while the slab is away and fully lit once its lamp edge is under the bulb', () => {
    const plan = planMove(recordPlayer, shell)
    const lamp = { u: 0, v: 0.49 }
    expect(glintAt(plan, 0.3, 'open', lamp)).toBe(0)
    expect(glintAt(plan, 1, 'open', lamp)).toBe(1)
    expect(glintAt(plan, 1, 'close', lamp)).toBe(1)
  })
})

describe('reverseMs', () => {
  it('takes the share of the move still to undo, never less than a short floor', () => {
    expect(reverseMs(0.5, 0, 400)).toBe(200)
    expect(reverseMs(0.95, 1, 400)).toBe(160)
  })
})

describe('silhouetteOf', () => {
  it('finds the heart of the drawing, not of its box', () => {
    const box = { left: 0, top: 0, width: 180, height: 180 }
    const hits = []
    for (let x = 125; x < 175; x += 10) for (let y = 125; y < 175; y += 10) hits.push({ x, y })
    const s = silhouetteOf(hits, box, 18)
    expect(s.cx).toBeCloseTo(145)
    expect(s.cy).toBeCloseTo(145)
    expect(s.w).toBeLessThan(80)
  })

  it('falls back to the box with too few hits', () => {
    expect(silhouetteOf([], { left: 10, top: 20, width: 100, height: 50 }, 18)).toEqual({ cx: 60, cy: 45, w: 100, h: 50 })
  })
})

describe('shadows', () => {
  const list = 'rgba(0, 0, 0, 0.12) 0px 0px 0px 2px inset, oklch(0.05 0.01 45 / 0.4) -1px 1px 2px 0px, rgba(0, 0, 0, 0.5) 0px 40px 90px -30px'

  it('splits a computed list without breaking colours apart', () => {
    expect(splitShadows(list)).toHaveLength(3)
    expect(splitShadows('none')).toEqual([])
  })

  it('separates the slab’s own shadows from the ones it casts', () => {
    const { inset, outer } = partShadows(list)
    expect(inset).toBe('rgba(0, 0, 0, 0.12) 0px 0px 0px 2px inset')
    expect(outer.split('px, ')).toHaveLength(2)
    expect(partShadows('none')).toEqual({ inset: 'none', outer: 'none' })
  })
})

describe('sameGlass', () => {
  const a = 'radial-gradient(2px 1.4% at 1.5px 48.8%, oklch(0.92 0.015 78 / 0.3) 0%) | -581px 9.4px'

  it('allows the room’s box to land a pixel apart', () => {
    expect(sameGlass(a, 'radial-gradient(2px 1.4% at 1.5px 49%, oklch(0.92 0.015 78 / 0.3) 0%) | -581.4px 9.2px')).toBe(true)
  })

  it('notices a changed light or colour', () => {
    expect(sameGlass(a, a.replace('/ 0.3', '/ 0.2'))).toBe(false)
    expect(sameGlass(a, a.replace('oklch', 'rgb'))).toBe(false)
    expect(sameGlass(a, a.replace('-581px', '-590px'))).toBe(false)
  })
})
