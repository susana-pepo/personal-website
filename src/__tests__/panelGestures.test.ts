import { describe, expect, it } from 'vitest'
import {
  GAP_MS,
  SWIPE_PX,
  createRecognizer,
  createRoomRecognizer,
  createTouchSwipe,
  lean,
  type RoomWheel,
  type WheelInput,
} from '../components/SectionPanel/panelGestures'

/** A run of wheel events 16ms apart, from `t0`. */
const run = (t0: number, steps: Array<Partial<WheelInput>>) =>
  steps.map((s, i) => ({ t: t0 + i * 16, dx: 0, dy: 0, mode: 0, ctrl: false, scroller: null, ...s }))
const repeat = (n: number, e: Partial<WheelInput>) => Array.from({ length: n }, () => e)
/** A trackpad flick: a push, then the momentum the OS adds after the fingers lift (no gap). */
const flick = (dx: number) => [...repeat(10, { dx }), ...Array.from({ length: 40 }, (_, i) => ({ dx: dx * 0.93 ** i }))]

const feedAll = (rec: ReturnType<typeof createRecognizer>, events: WheelInput[]) => events.map((e) => rec.feed(e))
const gos = (outs: ReturnType<ReturnType<typeof createRecognizer>['feed']>[]) => outs.filter((o) => o.go).map((o) => o.go)

describe('panel swipe', () => {
  it('turns once per swipe, momentum included', () => {
    const rec = createRecognizer()
    const outs = feedAll(rec, run(0, flick(18)))
    expect(gos(outs)).toEqual([1])
  })

  it('swiping right goes back', () => {
    expect(gos(feedAll(createRecognizer(), run(0, flick(-18))))).toEqual([-1])
  })

  it('needs the fingers to stop before the next swipe', () => {
    const rec = createRecognizer()
    const first = run(0, flick(18))
    const end = first[first.length - 1]!.t
    // straight on with no gap: still the same gesture
    expect(gos(feedAll(rec, [...first, ...run(end + 16, repeat(20, { dx: 18 }))]))).toEqual([1])
    // after a pause: a new swipe
    expect(gos(feedAll(rec, run(end + 16 * 21 + GAP_MS + 1, flick(18))))).toEqual([1])
  })

  it('a short sideways nudge doesn’t turn, and leans back', () => {
    const outs = feedAll(createRecognizer(), run(0, repeat(6, { dx: 12 })))
    expect(gos(outs)).toEqual([])
    expect(outs.at(-1)!.lean).toBeLessThan(0)
    expect(6 * 12).toBeLessThan(SWIPE_PX)
  })

  it('never turns from a scroll, even one that drifts sideways later', () => {
    const outs = feedAll(createRecognizer(), run(0, [...repeat(8, { dy: 20, dx: 3 }), ...repeat(30, { dx: 25, dy: 2 })]))
    expect(gos(outs)).toEqual([])
    expect(outs.every((o) => o.lean === 0)).toBe(true)
  })

  it('a diagonal scroll is a scroll', () => {
    expect(gos(feedAll(createRecognizer(), run(0, repeat(40, { dx: 10, dy: 8 }))))).toEqual([])
  })

  it('leaves a sideways scroller alone for the whole gesture', () => {
    const outs = feedAll(createRecognizer(), run(0, repeat(40, { dx: 20, scroller: { forward: true, back: true } })))
    expect(gos(outs)).toEqual([])
    expect(outs.some((o) => o.prevent)).toBe(false)
  })

  it('a shelf already at its end that way lets the swipe turn', () => {
    expect(gos(feedAll(createRecognizer(), run(0, flick(18).map((e) => ({ ...e, scroller: { forward: false, back: true } })))))).toEqual([1])
  })

  it('catches a swipe made while a scroll is still gliding', () => {
    // a read scroll's momentum (no gap), then fingers back on the pad, swiping
    const glide = Array.from({ length: 30 }, (_, i) => ({ dy: 30 * 0.9 ** i, dx: 0.4 }))
    const push = [4, 8, 13, 18, 18, 18, 18, 18].map((dx) => ({ dx, dy: 1 }))
    expect(gos(feedAll(createRecognizer(), run(0, [...glide, ...push])))).toEqual([1])
  })

  it('catches the next swipe while the last one is still gliding', () => {
    const push = [4, 8, 13, 18, 18, 18, 18, 18].map((dx) => ({ dx }))
    expect(gos(feedAll(createRecognizer(), run(0, [...flick(18), ...push])))).toEqual([1, 1])
  })

  it('a gliding scroll alone never turns, even with a little sideways wobble', () => {
    const glide = Array.from({ length: 60 }, (_, i) => ({ dy: 40 * 0.95 ** i, dx: (i % 3) - 1 }))
    expect(gos(feedAll(createRecognizer(), run(0, glide)))).toEqual([])
  })

  it('a mouse wheel (big steps, or line mode) never turns', () => {
    expect(gos(feedAll(createRecognizer(), run(0, repeat(6, { dx: 100 }))))).toEqual([])
    expect(gos(feedAll(createRecognizer(), run(0, repeat(10, { dx: 3, mode: 1 }))))).toEqual([])
  })

  it('never cancels a swipe or a scroll (cancelling the first event would freeze a scroll)', () => {
    const outs = feedAll(createRecognizer(), run(0, [...repeat(4, { dx: 6 }), ...flick(18), { dx: 0, dy: 0 }]))
    expect(outs.some((o) => o.prevent)).toBe(false)
  })

  it('leans with the fingers, against their travel, and never past 1', () => {
    expect(lean(-60)).toBeLessThan(0)
    expect(lean(60)).toBeGreaterThan(0)
    for (const px of [10, 50, 129, 400]) expect(Math.abs(lean(px))).toBeLessThanOrEqual(1)
  })
})

describe('panel pinch', () => {
  it('a pinch in closes once', () => {
    const outs = feedAll(createRecognizer(), run(0, repeat(40, { ctrl: true, dy: 4 })))
    expect(outs.filter((o) => o.close)).toHaveLength(1)
    expect(outs.every((o) => o.prevent)).toBe(true)
  })

  it('a pinch out doesn’t close', () => {
    expect(feedAll(createRecognizer(), run(0, repeat(40, { ctrl: true, dy: -4 }))).some((o) => o.close)).toBe(false)
  })

  it('ctrl with a mouse wheel (zooming) doesn’t close', () => {
    expect(feedAll(createRecognizer(), run(0, repeat(5, { ctrl: true, dy: 100 }))).some((o) => o.close)).toBe(false)
  })

  it('a pinch never turns, and a swipe never closes', () => {
    expect(gos(feedAll(createRecognizer(), run(0, repeat(40, { ctrl: true, dy: 4, dx: 20 }))))).toEqual([])
    expect(feedAll(createRecognizer(), run(0, flick(18))).some((o) => o.close)).toBe(false)
  })
})

describe('gestures that must not fire (review)', () => {
  it('a scroll right after a pinch is a scroll, not a close', () => {
    const rec = createRecognizer()
    const outs = feedAll(rec, run(0, [...repeat(5, { ctrl: true, dy: -4 }), ...repeat(40, { dy: 4 })]))
    expect(outs.some((o) => o.close)).toBe(false)
    expect(outs.slice(5).some((o) => o.prevent)).toBe(false)
  })

  it('fingers landing with a sideways roll, then scrolling down: a scroll, never a turn', () => {
    const outs = feedAll(createRecognizer(), run(0, [...repeat(3, { dx: 6 }), ...repeat(80, { dx: 2, dy: 12 })]))
    expect(gos(outs)).toEqual([])
    expect(outs.slice(10).some((o) => o.prevent)).toBe(false)
  })

  it('a sideways mouse scroll (Shift + wheel, small pixel steps) never turns', () => {
    expect(gos(feedAll(createRecognizer(), run(0, repeat(8, { dx: 40, shift: true }))))).toEqual([])
  })

  it('Ctrl + wheel with the key held is a zoom, never a close', () => {
    expect(feedAll(createRecognizer(), run(0, repeat(30, { ctrl: true, ctrlHeld: true, dy: 4 }))).some((o) => o.close)).toBe(false)
  })

  it('a pinch out is left to the browser’s zoom', () => {
    expect(feedAll(createRecognizer(), run(0, repeat(20, { ctrl: true, dy: -4 }))).some((o) => o.prevent)).toBe(false)
  })

  it('no second turn from momentum merged after a stall', () => {
    const rec = createRecognizer()
    const first = run(0, flick(18).slice(0, 20))
    const end = first.at(-1)!.t
    const merged = run(end + GAP_MS + 40, [{ dx: 50 }, ...Array.from({ length: 12 }, (_, i) => ({ dx: 6 * 0.9 ** i }))])
    expect(gos(feedAll(rec, [...first, ...merged]))).toEqual([1])
  })

  it('a scroll that starts right after a turn scrolls', () => {
    const rec = createRecognizer()
    const outs = feedAll(rec, run(0, [...repeat(8, { dx: 18 }), ...repeat(30, { dy: 10 })]))
    expect(gos(outs)).toEqual([1])
    expect(outs.slice(14).some((o) => o.prevent)).toBe(false)
  })

  it('a gesture begun while the panel was arriving stays ignored to its end', () => {
    const rec = createRecognizer()
    rec.hold(0)
    expect(gos(feedAll(rec, run(16, flick(18))))).toEqual([])
  })
})

describe('scroll up to close', () => {
  const up = (n: number, extra: Partial<WheelInput> = {}) => repeat(n, { dy: -10, atTop: true, ...extra })

  it('a scroll up begun at the top pulls the page down and closes', () => {
    const rec = createRecognizer()
    const outs = feedAll(rec, run(1000, up(20)))
    expect(outs.filter((o) => o.close)).toHaveLength(1)
    expect(Math.max(...outs.map((o) => o.pull ?? 0))).toBeGreaterThan(0.5)
  })

  it('scrolling up through the page and arriving at the top never closes, momentum included', () => {
    const rec = createRecognizer()
    const reading = Array.from({ length: 60 }, (_, i) => ({ dy: -30 * 0.95 ** i, atTop: i > 20 }))
    expect(feedAll(rec, run(1000, reading)).some((o) => o.close)).toBe(false)
  })

  it('not at the top, a scroll up is just a scroll', () => {
    expect(feedAll(createRecognizer(), run(1000, up(30, { atTop: false }))).some((o) => o.close || o.prevent)).toBe(false)
  })

  it('a short pull springs back without closing', () => {
    const outs = feedAll(createRecognizer(), run(1000, up(6)))
    expect(outs.some((o) => o.close)).toBe(false)
  })

  it('a scroll down at the top is reading, never a close', () => {
    expect(feedAll(createRecognizer(), run(1000, repeat(30, { dy: 10, atTop: true }))).some((o) => o.close)).toBe(false)
  })

  it('a scroll that reaches the top, then a new pull up before its glide ends, closes', () => {
    const reading = Array.from({ length: 25 }, (_, i) => ({ dy: -20 * 0.85 ** i, atTop: i > 8 }))
    const pullUp = [-4, -8, -12, -14, -14, -14, -12, -10].map((dy) => ({ dy, atTop: true }))
    expect(feedAll(createRecognizer(), run(1000, [...reading, ...pullUp])).filter((o) => o.close)).toHaveLength(1)
  })
})

describe('scroll down in the room opens About', () => {
  const down = (n: number, extra: Partial<RoomWheel> = {}) =>
    Array.from({ length: n }, (_, i) => ({ t: 1000 + i * 16, dx: 0, dy: 10, mode: 0, ctrl: false, canScrollDown: false, ...extra }))

  it('a scroll down from rest opens once', () => {
    const rec = createRoomRecognizer()
    expect(down(20).map((e) => rec.feed(e)).filter(Boolean)).toHaveLength(1)
  })

  it('not when the page or a list under the pointer can still scroll down', () => {
    const rec = createRoomRecognizer()
    expect(down(20, { canScrollDown: true }).some((e) => rec.feed(e))).toBe(false)
  })

  it('a scroll up, a sideways one, a pinch or a short nudge never opens', () => {
    for (const extra of [{ dy: -10 }, { dx: 12, dy: 3 }, { ctrl: true }]) {
      const rec = createRoomRecognizer()
      expect(down(20, extra).some((e) => rec.feed(e))).toBe(false)
    }
    const rec = createRoomRecognizer()
    expect(down(5).some((e) => rec.feed(e))).toBe(false)
  })

  it('the tail of a gesture held while the room was busy never opens', () => {
    const rec = createRoomRecognizer()
    rec.hold(990)
    expect(down(20).some((e) => rec.feed(e))).toBe(false)
  })

  it('a mouse wheel scroll down opens too', () => {
    const rec = createRoomRecognizer()
    expect(down(3, { dy: 3, mode: 1 }).map((e) => ({ ...e, t: e.t * 1 })).some((e) => rec.feed(e))).toBe(true)
  })
})

describe('scroll down in the room: reliability', () => {
  const ev = (i: number, dy: number, extra: Partial<RoomWheel> = {}) => ({ t: 1000 + i * 16, dx: 0, dy, mode: 0, ctrl: false, canScrollDown: false, ...extra })

  it('a brisk scroll whose first step is big still opens', () => {
    const rec = createRoomRecognizer()
    expect([35, 30, 20, 10].map((dy, i) => rec.feed(ev(i, dy))).some(Boolean)).toBe(true)
  })

  it('a scroll down made while a scroll up is still gliding opens', () => {
    const rec = createRoomRecognizer()
    const glideUp = Array.from({ length: 20 }, (_, i) => ev(i, -20 * 0.85 ** i))
    const down = [4, 8, 13, 18, 18, 18].map((dy, i) => ev(20 + i, dy))
    expect([...glideUp, ...down].map((e) => rec.feed(e)).filter(Boolean)).toHaveLength(1)
  })
})

describe('touch swipe (phones)', () => {
  const W = 390
  /** A one-finger drag from (x0, y0) by (dx, dy) over `ms`, then lifted after `hold` ms. */
  const drag = (dx: number, dy: number, ms = 200, opts: { x0?: number; claimed?: boolean | { forward: boolean; back: boolean }; hold?: number } = {}) => {
    const t = createTouchSwipe()
    const x0 = opts.x0 ?? 200
    t.start({ t: 0, x: x0, y: 400, width: W, claimed: opts.claimed ?? false })
    let lean = 0
    const n = 12
    for (let i = 1; i <= n; i++) lean = t.move(x0 + (dx * i) / n, 400 + (dy * i) / n, (ms * i) / n).lean
    return { ...t.end(ms + (opts.hold ?? 0)), lean }
  }

  it('a long drag left turns forward, right turns back', () => {
    expect(drag(-120, 6).go).toBe(1)
    expect(drag(120, -6).go).toBe(-1)
  })

  it('a short quick flick turns; the same short drag made slowly doesn’t', () => {
    expect(drag(-40, 2, 60).go).toBe(1)
    expect(drag(-40, 2, 600).go).toBeUndefined()
  })

  it('the page leans with the finger', () => {
    expect(drag(-50, 0, 300, { hold: 200 }).lean).toBeLessThan(0)
  })

  it('a drag that stops before lifting doesn’t flick', () => {
    expect(drag(-40, 0, 60, { hold: 200 }).go).toBeUndefined()
  })

  it('a scroll up or down never turns, even if it drifts sideways', () => {
    expect(drag(-30, 200).go).toBeUndefined()
    expect(drag(-100, -120).go).toBeUndefined()
  })

  it('leaves the screen edges to the system’s back gesture', () => {
    expect(drag(150, 0, 200, { x0: 6 }).go).toBeUndefined()
    expect(drag(-150, 0, 200, { x0: W - 6 }).go).toBeUndefined()
  })

  it('a shelf that can still scroll keeps the drag; one at its end lets it turn; the crate always keeps it', () => {
    expect(drag(-120, 0, 200, { claimed: { forward: true, back: false } }).go).toBeUndefined()
    expect(drag(-120, 0, 200, { claimed: { forward: false, back: true } }).go).toBe(1)
    expect(drag(-120, 0, 200, { claimed: true }).go).toBeUndefined()
  })

  it('a second finger (a pinch) ends the swipe', () => {
    const t = createTouchSwipe()
    t.start({ t: 0, x: 200, y: 400, width: W, claimed: false })
    t.move(150, 400, 50)
    t.cancel()
    t.move(60, 400, 150)
    expect(t.end(160).go).toBeUndefined()
  })
})
