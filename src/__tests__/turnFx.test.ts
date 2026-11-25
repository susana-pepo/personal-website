import { afterEach, describe, expect, it, vi } from 'vitest'
import { INK_BASE_WIDTH } from '../components/SectionPanel/folio'
import { cubicBezier } from '../components/SectionPanel/genie/geometry'
import {
  FLOW,
  INK_EASE,
  inkKeyframes,
  inkPoseAt,
  inkPoseTransform,
  moveInk,
  planInk,
  poseFromMatrix,
  swellAt,
  type InkPose,
} from '../components/SectionPanel/liquidInk'
import { LIGHT, LIGHT_EASE, lightAt, lightFromStyle, lightKeyframes, lightTransform, planLight } from '../components/SectionPanel/turnLight'
import { parseBezier } from '../components/SectionPanel/turnEase'

const lead = cubicBezier(INK_EASE.lead)
const gather = cubicBezier(INK_EASE.gather)
const ease = cubicBezier(LIGHT_EASE)
const MS = 460
const steps = (n: number) => Array.from({ length: n + 1 }, (_, i) => (i / n) * MS)

/** "About" and "Bookshelf" in the row, roughly as at 1440. */
const ABOUT = { left: 90, width: 41 }
const BOOKSHELF = { left: 270, width: 70 }
const at = (span: { left: number; width: number }): InkPose => ({ ...span, full: 1 })

describe('liquid ink: one move', () => {
  it('starts exactly where the mark is and ends exactly under the new tab, at its own size', () => {
    const plan = planInk(at(ABOUT), BOOKSHELF, MS)
    const first = inkPoseAt(plan, 0, lead, gather)
    expect(first.left).toBeCloseTo(ABOUT.left)
    expect(first.width).toBeCloseTo(ABOUT.width)
    expect(first.full).toBeCloseTo(1)
    expect(inkPoseAt(plan, MS, lead, gather)).toEqual({ left: BOOKSHELF.left, width: BOOKSHELF.width, full: 1 })
  })

  it('knows its direction', () => {
    expect(planInk(at(ABOUT), BOOKSHELF, MS).dir).toBe(1)
    expect(planInk(at(BOOKSHELF), ABOUT, MS).dir).toBe(-1)
    expect(planInk(at(ABOUT), { left: 90.2, width: 41 }, MS).dir).toBe(0)
  })

  it('runs its leading edge ahead and stretches across both tabs before it gathers', () => {
    for (const [from, to] of [
      [ABOUT, BOOKSHELF],
      [BOOKSHELF, ABOUT],
    ] as const) {
      const plan = planInk(at(from), to, MS)
      const left = Math.min(from.left, to.left)
      const right = Math.max(from.left + from.width, to.left + to.width)
      // at its longest it reaches across nearly both tabs, early in the move
      const poses = steps(92).map((ms) => inkPoseAt(plan, ms, lead, gather))
      const longest = poses.reduce((a, b) => (b.width > a.width ? b : a))
      expect(longest.width).toBeGreaterThan((right - left) * 0.85)
      expect(poses.indexOf(longest) / poses.length).toBeLessThan(FLOW.leadEnd)
      // and the leading edge is home by FLOW.leadEnd, while the trailing one is still on its way
      const mid = inkPoseAt(plan, MS * FLOW.leadEnd, lead, gather)
      if (plan.dir > 0) expect(mid.left + mid.width).toBeCloseTo(to.left + to.width, 0)
      else expect(mid.left).toBeCloseTo(to.left, 0)
      expect(mid.width).toBeGreaterThan(to.width + 20)
    }
  })

  it('never passes the new tab or goes back past the old one: each edge only moves toward its rest', () => {
    for (const [from, to] of [
      [ABOUT, BOOKSHELF],
      [BOOKSHELF, ABOUT],
    ] as const) {
      const plan = planInk(at(from), to, MS)
      let prev = inkPoseAt(plan, 0, lead, gather)
      for (const ms of steps(92)) {
        const p = inkPoseAt(plan, ms, lead, gather)
        expect(p.left).toBeGreaterThanOrEqual(Math.min(from.left, to.left) - 1e-6)
        expect(p.left + p.width).toBeLessThanOrEqual(Math.max(from.left + from.width, to.left + to.width) + 1e-6)
        // monotonic edges: no bounce
        expect((p.left - prev.left) * plan.dir).toBeGreaterThanOrEqual(-1e-6)
        expect((p.left + p.width - (prev.left + prev.width)) * plan.dir).toBeGreaterThanOrEqual(-1e-6)
        expect(p.width).toBeGreaterThan(0)
        prev = p
      }
    }
  })

  it('thins while stretched, is a touch fuller once as it gathers, then exactly its size', () => {
    const plan = planInk(at(ABOUT), BOOKSHELF, MS)
    const fulls = steps(92).map((ms) => inkPoseAt(plan, ms, lead, gather).full)
    expect(Math.min(...fulls)).toBeLessThan(1)
    expect(Math.min(...fulls)).toBeGreaterThanOrEqual(FLOW.minFull)
    const peak = Math.max(...fulls)
    expect(peak).toBeGreaterThan(1.15)
    expect(peak).toBeLessThanOrEqual(1 + FLOW.fuller + 1e-6)
    // the swell comes late, in the gathering, not while it runs out
    expect(fulls.indexOf(peak) / fulls.length).toBeGreaterThan(0.6)
    expect(fulls.at(-1)).toBe(1)
    // and it eases out of the swell into its rest: no step at the end
    expect(Math.abs(fulls.at(-2)! - 1)).toBeLessThan(0.02)
  })

  it('swells as it settles: at its fullest it is already under the new tab', () => {
    for (const [from, to] of [
      [ABOUT, BOOKSHELF],
      [BOOKSHELF, ABOUT],
    ] as const) {
      const plan = planInk(at(from), to, MS)
      const poses = steps(92).map((ms) => inkPoseAt(plan, ms, lead, gather))
      const fullest = poses.reduce((a, b) => (b.full > a.full ? b : a))
      expect(fullest.full).toBeGreaterThan(1 + FLOW.fuller * 0.95)
      expect(Math.abs(fullest.left - to.left)).toBeLessThan(1)
      expect(Math.abs(fullest.width - to.width)).toBeLessThan(1)
      // never thinner than it rests once it is home: the thinning has eased out before the swell
      for (const p of poses) if (Math.abs(p.width - to.width) < 1 && Math.abs(p.left - to.left) < 1) expect(p.full).toBeGreaterThanOrEqual(1 - 1e-6)
    }
    expect(swellAt(FLOW.fullAt)).toBeCloseTo(1)
    expect(swellAt(FLOW.fullFrom)).toBe(0)
    expect(swellAt(1)).toBe(0)
  })

  it('answers the click at once without leaping: the first frame covers well under half the way', () => {
    const plan = planInk(at(BOOKSHELF), ABOUT, MS)
    const first = inkPoseAt(plan, 1000 / 60, lead, gather)
    const travel = BOOKSHELF.left - ABOUT.left
    expect(BOOKSHELF.left - first.left).toBeGreaterThan(0)
    expect(BOOKSHELF.left - first.left).toBeLessThan(travel * 0.3)
  })

  it('a turn taken up mid-flow carries on from where the mark is, with no jump back to the old tab', () => {
    const first = planInk(at(ABOUT), BOOKSHELF, MS)
    const now = inkPoseAt(first, 150, lead, gather)
    // a second click, back to Work at the row's start
    const WORK = { left: 0, width: 36 }
    const second = planInk(now, WORK, MS, true)
    // taken up mid-flow, the gathering edge never pauses
    expect(second.trailAt).toBe(0)
    expect(inkPoseAt(second, 1000 / 60, lead, gather).left + inkPoseAt(second, 1000 / 60, lead, gather).width).toBeLessThan(now.left + now.width)
    const start = inkPoseAt(second, 0, lead, gather)
    expect(start.left).toBeCloseTo(now.left)
    expect(start.width).toBeCloseTo(now.width)
    expect(start.full).toBeCloseTo(now.full)
    expect(second.dir).toBe(-1)
    for (const ms of steps(46)) {
      const p = inkPoseAt(second, ms, lead, gather)
      expect(p.width).toBeGreaterThan(0)
      // never further right than it already reached, never left of Work
      expect(p.left + p.width).toBeLessThanOrEqual(now.left + now.width + 1e-6)
      expect(p.left).toBeGreaterThanOrEqual(WORK.left - 1e-6)
    }
    expect(inkPoseAt(second, MS, lead, gather)).toEqual({ ...WORK, full: 1 })
  })

  it('turns into evenly spaced keyframes about a frame apart, ending on the rest transform', () => {
    const plan = planInk(at(ABOUT), BOOKSHELF, MS)
    const frames = inkKeyframes(plan, lead, gather)
    expect(frames.length).toBeGreaterThanOrEqual(MS / 16)
    expect(frames[0]!.offset).toBe(0)
    expect(frames.at(-1)!.offset).toBe(1)
    expect(frames.at(-1)!.transform).toBe(inkPoseTransform(at(BOOKSHELF)))
    expect(inkPoseTransform(at(BOOKSHELF))).toBe(`translateX(270px) scaleX(${70 / INK_BASE_WIDTH}) scaleY(1)`)
  })

  it('reads the mark back from its computed transform', () => {
    expect(poseFromMatrix('matrix(0.41, 0, 0, 1.2, 60, 0)')).toEqual({ left: 60, width: 41, full: 1.2 })
    expect(poseFromMatrix('none')).toEqual({ left: 0, width: INK_BASE_WIDTH, full: 1 })
    expect(poseFromMatrix('rotate(3deg)')).toBeNull()
  })
})

describe('the light through the glass', () => {
  /** --turn-light in turn-fx.css. */
  const MS_LIGHT = 480

  it('passes in the direction of travel: forward from the lamp side, back toward it', () => {
    const fwd = planLight(null, 1, MS_LIGHT)
    expect(fwd.from).toEqual({ at: LIGHT.start, alpha: 0 })
    expect(fwd.to).toBe(LIGHT.end)
    const back = planLight(null, -1, MS_LIGHT)
    expect(back.from.at).toBe(LIGHT.end)
    expect(back.to).toBe(LIGHT.start)
    expect(fwd.ms).toBe(MS_LIGHT)
  })

  it('is at its brightest while it crosses the slab, and brightest by the lamp in either direction', () => {
    for (const dir of [1, -1] as const) {
      const plan = planLight(null, dir, MS_LIGHT)
      const lit = Array.from({ length: 97 }, (_, i) => lightAt(plan, (i / 96) * MS_LIGHT, ease))
      // whenever it is near full, its heart is over the sheet or at its very edge
      for (const l of lit) if (l.alpha > 0.9) expect(l.at).toBeGreaterThan(-0.1), expect(l.at).toBeLessThan(1.1)
      // crossing the lamp's side (the first fifth of the sheet), it is at least nearly full
      const byLamp = lit.filter((l) => l.at > 0.05 && l.at < 0.2)
      expect(byLamp.length).toBeGreaterThan(0)
      expect(Math.max(...byLamp.map((l) => l.alpha))).toBeGreaterThan(0.9)
    }
  })

  it('starts and ends unseen, outside the sheet, and is fully there in between', () => {
    const plan = planLight(null, 1, MS_LIGHT)
    expect(lightAt(plan, 0, ease).alpha).toBe(0)
    expect(lightAt(plan, MS_LIGHT, ease).alpha).toBeCloseTo(0)
    expect(lightAt(plan, MS_LIGHT, ease).at).toBe(LIGHT.end)
    const alphas = Array.from({ length: 51 }, (_, i) => lightAt(plan, (i / 50) * MS_LIGHT, ease).alpha)
    expect(Math.max(...alphas)).toBe(1)
    for (const a of alphas) expect(a).toBeGreaterThanOrEqual(0)
    // it travels one way only
    let prev = -Infinity
    for (let i = 0; i <= 50; i++) {
      const p = lightAt(plan, (i / 50) * MS_LIGHT, ease).at
      expect(p).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = p
    }
  })

  it('a turn mid-pass takes the light on from where it is, shorter, either way', () => {
    const first = planLight(null, 1, MS_LIGHT)
    const now = lightAt(first, 200, ease)
    const on = planLight(now, 1, MS_LIGHT)
    expect(on.from).toEqual(now)
    expect(on.ms).toBeLessThan(MS_LIGHT)
    expect(on.ms).toBeGreaterThanOrEqual(MS_LIGHT * LIGHT.minShare)
    expect(lightAt(on, 0, ease)).toEqual(now)
    const back = planLight(now, -1, MS_LIGHT)
    expect(back.to).toBe(LIGHT.start)
    expect(lightAt(back, 0, ease).at).toBeCloseTo(now.at)
    expect(lightAt(back, back.ms, ease).alpha).toBeCloseTo(0)
  })

  it('writes keyframes as a share of the band and reads the light back from computed style', () => {
    const plan = planLight(null, 1, MS_LIGHT)
    const frames = lightKeyframes(plan, ease)
    expect(frames[0]!.opacity).toBe(0)
    expect(frames.at(-1)!.transform).toBe(lightTransform(LIGHT.end))
    // the band's centre over the sheet's middle: translateX puts its left edge half a band before
    expect(lightTransform(0.5)).toMatch(/^translateX\(/)
    const sheet = 800
    const band = sheet * LIGHT.band
    const e = 0.5 * sheet - band / 2
    expect(lightFromStyle(`matrix(1, 0, -0.2, 1, ${e}, 0)`, '0.6', band, sheet)).toEqual({ at: 0.5, alpha: 0.6 })
    expect(lightFromStyle('none', '0', band, sheet)).toBeNull()
  })
})

describe('turn curves from the tokens', () => {
  it('reads a cubic-bezier as the page resolves it, and refuses anything else', () => {
    expect(parseBezier('cubic-bezier(0.23, 1, 0.32, 1)')).toEqual([0.23, 1, 0.32, 1])
    expect(parseBezier(' cubic-bezier(0.33,0,0.2,1) ')).toEqual([0.33, 0, 0.2, 1])
    expect(parseBezier('ease')).toBeNull()
    expect(parseBezier('cubic-bezier(1.4, 0, 0.2, 1)')).toBeNull()
  })
})

describe('moving the live mark', () => {
  /** Just enough of a mark for moveInk: its transform, the panel's tokens, and Web Animations. */
  function fakeInk(transform = 'none') {
    const animations: { keyframes: Keyframe[]; cancelled: boolean; playState: string }[] = []
    const ink = {
      style: { transform: '' },
      closest: () => null,
      animate(keyframes: Keyframe[]) {
        const a = {
          keyframes,
          cancelled: false,
          playState: 'running',
          finished: new Promise(() => {}),
          cancel() {
            a.cancelled = true
            a.playState = 'idle'
          },
        }
        animations.push(a)
        return a
      },
    }
    const tokens: Record<string, string> = { '--turn-ink': '460ms', transform }
    vi.stubGlobal('getComputedStyle', () => ({
      transform: tokens.transform,
      getPropertyValue: (name: string) => tokens[name] ?? '',
    }))
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    return { ink: ink as unknown as HTMLElement, animations, tokens }
  }

  afterEach(() => vi.unstubAllGlobals())

  it('flows from where the mark is, ends on its rest transform, and retargets from the live pose', () => {
    const { ink, animations, tokens } = fakeInk('matrix(0.41, 0, 0, 1, 90, 0)')
    moveInk(ink, BOOKSHELF, true)
    expect(animations).toHaveLength(1)
    expect(ink.style.transform).toBe(inkPoseTransform(at(BOOKSHELF)))
    expect(animations[0]!.keyframes[0]!.transform).toBe(inkPoseTransform(at(ABOUT)))
    // a second turn mid-flow: the first is cancelled and the new one starts from the computed pose
    tokens.transform = 'matrix(1.8, 0, 0, 0.7, 120, 0)'
    moveInk(ink, ABOUT, true)
    expect(animations[0]!.cancelled).toBe(true)
    expect(animations[1]!.keyframes[0]!.transform).toBe(inkPoseTransform({ left: 120, width: 180, full: 0.7 }))
  })

  it('lets a flow finish when the row only reports a resize to the same place, and snaps for a real change', () => {
    const { ink, animations } = fakeInk('matrix(0.41, 0, 0, 1, 90, 0)')
    moveInk(ink, BOOKSHELF, true)
    moveInk(ink, { ...BOOKSHELF }, false)
    expect(animations[0]!.cancelled).toBe(false)
    moveInk(ink, { left: 300, width: 70 }, false)
    expect(animations[0]!.cancelled).toBe(true)
    expect(ink.style.transform).toBe(inkPoseTransform({ left: 300, width: 70, full: 1 }))
  })

  it('is placed at once with reduced motion', () => {
    const { ink, animations, tokens } = fakeInk('matrix(0.41, 0, 0, 1, 90, 0)')
    tokens['--turn-ink'] = '0ms'
    moveInk(ink, BOOKSHELF, true)
    expect(animations).toHaveLength(0)
    expect(ink.style.transform).toBe(inkPoseTransform(at(BOOKSHELF)))
  })
})
