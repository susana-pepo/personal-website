import { describe, expect, it } from 'vitest'
import { DREAM_EVERY_MS, DREAM_MS, FIRST_DREAM_MS, acceptsPet, catReducer, choosePetStyle, nextDreamDelay, nextReaction, playVariation, type CatClip } from '../scene/catReaction'
import { HOTSPOTS, boundsOf } from '../scene/hotspots'
import { CANVAS_HEIGHT, CANVAS_WIDTH, CAT_MEDIA, OVERLAYS, coverFit } from '../scene/layout'

describe('scene layout', () => {
  it('stacks the layers back to front: plant, shelf books, the piano on the top shelf, record player, lamp, vase, desk books, laptop, woman, cat, coffee (the mug stands in front of the cat)', () => {
    expect(OVERLAYS.map((o) => [o.id, o.z])).toEqual([
      ['plant', 3],
      ['books', 4],
      ['piano', 5],
      ['vinyl', 5],
      ['lamp', 5],
      ['vase', 5],
      ['deskbooks', 6],
      ['laptop', 7],
      ['woman', 8],
      ['cat', 8],
      ['coffee', 9],
    ])
  })

  it('gives a halo only to the interactive section objects', () => {
    expect(OVERLAYS.filter((o) => o.halo).map((o) => o.id)).toEqual(['books', 'vinyl', 'deskbooks', 'laptop', 'coffee'])
  })

  it('gives every content object the same halo glow, at rest and on hover', () => {
    const glows = OVERLAYS.filter((o) => o.glow).map((o) => [o.glow!.rest, o.glow!.hover])
    expect(new Set(glows.map((g) => g.join())).size, 'all halos match').toBe(1)
  })

  it('keeps every overlay on the canvas (a transparent margin may run past the frame)', () => {
    for (const o of OVERLAYS) {
      const slackX = o.width * 0.08
      const slackY = o.height * 0.08
      expect(o.x, o.id).toBeGreaterThanOrEqual(-slackX)
      expect(o.y, o.id).toBeGreaterThanOrEqual(-slackY)
      expect(o.x + o.width, o.id).toBeLessThanOrEqual(CANVAS_WIDTH + slackX)
      expect(o.y + o.height, o.id).toBeLessThanOrEqual(CANVAS_HEIGHT + slackY)
    }
  })

  it('has a traced outline for every interactive overlay that still matches where it sits', () => {
    for (const o of OVERLAYS.filter((overlay) => HOTSPOTS.some((h) => h.overlay === overlay.id))) {
      const spot = HOTSPOTS.find((h) => h.overlay === o.id)
      expect(spot, o.id).toBeDefined()
      const b = boundsOf(spot!.polygons)
      // The outline sits inside the box (the artwork may have a transparent margin);
      // a moved overlay without a re-trace fails here.
      const marginX = o.width * 0.1 + 12
      const marginY = o.height * 0.15 + 12
      const top = o.y + o.hitFrom // where the clickable part starts (below the coffee's steam)
      expect(b.x - o.x, `${o.id} left`).toBeGreaterThan(-12)
      expect(b.x - o.x, `${o.id} left`).toBeLessThan(marginX)
      expect(b.y - top, `${o.id} top`).toBeGreaterThan(-12)
      expect(b.y - top, `${o.id} top`).toBeLessThan(marginY)
      expect(b.x + b.width, `${o.id} right`).toBeLessThanOrEqual(o.x + o.width + 8)
      expect(b.y + b.height, `${o.id} bottom`).toBeLessThanOrEqual(o.y + o.height + 8)
      expect(b.width, `${o.id} width`).toBeGreaterThan(o.width * 0.7)
    }
  })

  it('gives the cat a sleeping loop, its variations, at least one reaction, and a still for reduced motion', () => {
    expect(CAT_MEDIA.sleep.src).toBe('/media/scene/cat/cat-sleep.webp')
    expect(CAT_MEDIA.reactions.length).toBeGreaterThan(0)
    for (const clip of [CAT_MEDIA.sleep, ...CAT_MEDIA.variations, ...CAT_MEDIA.reactions]) {
      expect(clip.src).toBe(`/media/scene/cat/cat-${clip.name}.webp`)
      expect(clip.ms).toBeGreaterThan(3000)
    }
    expect(CAT_MEDIA.still).toMatch(/\.webp$/)
  })
})

describe('cover fit', () => {
  it('fills a 16:9 box exactly, with no crop', () => {
    expect(coverFit(1440, 810)).toEqual({ width: 1440, height: 810, left: 0, top: 0, scale: 0.75 })
  })

  it('scales the whole canvas as one unit and never leaves a gap', () => {
    for (const [w, h] of [
      [390, 844],
      [1024, 1366],
      [2560, 900],
    ] as const) {
      const fit = coverFit(w, h)
      expect(fit.width / fit.height).toBeCloseTo(CANVAS_WIDTH / CANVAS_HEIGHT, 6)
      expect(fit.width).toBeGreaterThanOrEqual(w - 1e-6)
      expect(fit.height).toBeGreaterThanOrEqual(h - 1e-6)
      expect(fit.left).toBeLessThanOrEqual(0)
      expect(fit.top).toBeLessThanOrEqual(0)
      expect(fit.left + fit.width).toBeGreaterThanOrEqual(w - 1e-6)
      expect(fit.top + fit.height).toBeGreaterThanOrEqual(h - 1e-6)
    }
  })

  it('keeps the writer and the cat in view when a squarer box crops the sides', () => {
    const fit = coverFit(1024, 768)
    const onScreen = (canvasX: number) => fit.left + canvasX * fit.scale
    const cat = OVERLAYS.find((o) => o.id === 'cat')!
    const writersHead = 840
    for (const x of [writersHead, cat.x + cat.width / 2]) {
      expect(onScreen(x)).toBeGreaterThan(0)
      expect(onScreen(x)).toBeLessThan(1024)
    }
  })
})

describe('cat reaction', () => {
  it('goes idle → petting → idle and ignores pets while a reaction plays', () => {
    let phase = catReducer('idle', 'pet')
    expect(phase).toBe('petting')
    expect(acceptsPet(phase)).toBe(false)
    phase = catReducer(phase, 'pet')
    expect(phase).toBe('petting')
    phase = catReducer(phase, 'finished')
    expect(phase).toBe('idle')
    expect(acceptsPet(phase)).toBe(true)
  })

  it('plays the clip only when motion is welcome and both transparent videos work', () => {
    expect(choosePetStyle({ motionAllowed: true, idleVideoShowing: true, petVideoUsable: true })).toBe('video')
    expect(choosePetStyle({ motionAllowed: true, idleVideoShowing: false, petVideoUsable: true })).toBe('css')
    expect(choosePetStyle({ motionAllowed: true, idleVideoShowing: true, petVideoUsable: false })).toBe('css')
    expect(choosePetStyle({ motionAllowed: false, idleVideoShowing: true, petVideoUsable: true })).toBe('still')
  })
})

describe('lamp light colours', () => {
  it('switches between its warm light and off (just the room light)', async () => {
    const { LAMP_OFF, LAMP_TONES, nextTone, toneAt } = await import('../scene/lampTones')
    const seen: string[] = []
    let i = 0
    for (let n = 0; n <= LAMP_TONES.length; n++) {
      seen.push(toneAt(i)?.id ?? 'off')
      i = nextTone(i)
    }
    expect(seen).toEqual([...LAMP_TONES.map((t) => t.id), 'off'])
    expect(toneAt(LAMP_OFF)).toBeNull()
    expect(i).toBe(0)
  })

  it('keeps every light a light: values in range, and near-white at the bulb', async () => {
    const { LAMP_TONES } = await import('../scene/lampTones')
    for (const t of LAMP_TONES) {
      for (const v of [...t.core, ...t.glow]) {
        expect(v).toBeGreaterThanOrEqual(0.2)
        expect(v).toBeLessThanOrEqual(1)
      }
      // the bulb itself always reads as a lit bulb, never a coloured sticker
      expect(Math.min(...t.core), t.id).toBeGreaterThan(0.65)
      expect(Math.max(...t.glow), t.id).toBe(1)
    }
  })

  it('has a name for every colour, for the screen-reader announcement', async () => {
    const [{ LAMP_TONES }, { content }] = await Promise.all([import('../scene/lampTones'), import('../content/content')])
    for (const t of LAMP_TONES) expect(content.lamp.tones[t.id]).toBeTruthy()
    expect(content.lamp.off).toBeTruthy()
  })
})

describe('the cat dreaming', () => {
  it('first dreams a little while after the room opens, then every 30-60 s', () => {
    expect(nextDreamDelay(true, 0)).toBe(FIRST_DREAM_MS[0])
    expect(nextDreamDelay(true, 1)).toBe(FIRST_DREAM_MS[1])
    expect(nextDreamDelay(false, 0)).toBe(30_000)
    expect(nextDreamDelay(false, 1)).toBe(60_000)
    expect(nextDreamDelay(false, 0.5)).toBe(45_000)
  })

  it('stays within its range whatever the random number', () => {
    for (const r of [-1, 2, Number.EPSILON, 0.999]) {
      const d = nextDreamDelay(false, r)
      expect(d).toBeGreaterThanOrEqual(DREAM_EVERY_MS[0])
      expect(d).toBeLessThanOrEqual(DREAM_EVERY_MS[1])
    }
  })

  it('has faded before the next one can start', () => {
    expect(DREAM_MS).toBeLessThan(Math.min(FIRST_DREAM_MS[0], DREAM_EVERY_MS[0]))
  })
})

describe('the cat reacting', () => {
  const clip = (name: string): CatClip => ({ name, src: `/media/scene/cat/cat-${name}.webp`, ms: 6000 })
  const both = [clip('head-turn'), clip('stretch')]
  const name = (c: CatClip | null) => c?.name ?? 'asleep'
  const randoms = Array.from({ length: 60 }, (_, i) => (i + 0.5) / 60)

  it('reacts to every hover once a clip has arrived: head-turn and stretch take turns', () => {
    for (const r of randoms) {
      expect(name(nextReaction(both, 'head-turn', r))).toBe('stretch')
      expect(name(nextReaction(both, 'stretch', r))).toBe('head-turn')
      expect(nextReaction(both, 'asleep', r)).not.toBeNull()
      expect(nextReaction(both, null, r)).not.toBeNull()
    }
    expect(new Set(randoms.map((r) => name(nextReaction(both, null, r)))).size).toBe(2)
  })

  it('plays the one clip that has arrived, even twice running', () => {
    const one = [clip('stretch')]
    for (const r of randoms) expect(name(nextReaction(one, 'stretch', r))).toBe('stretch')
  })

  it('stays asleep when no reaction clip has arrived', () => {
    expect(nextReaction([], 'asleep', 0.5)).toBeNull()
  })

  it('sweeps its tail often: after one or two sleeping turns, never twice running', () => {
    for (const r of randoms) {
      expect(playVariation(0, r)).toBe(false)
      expect(playVariation(2, r)).toBe(true)
    }
    expect(new Set(randoms.map((r) => playVariation(1, r))).size).toBe(2)
  })
})

describe('room framing', () => {
  it('shows the full width and hides a thin band, split as ROOM_VIEW says', async () => {
    const { ROOM_VIEW, roomFocus } = await import('../scene/layout')
    const width = 1480
    const height = width / ROOM_VIEW.aspect
    const fit = coverFit(width, height, roomFocus(width, height))
    expect(fit.left).toBe(0)
    expect(fit.width).toBeCloseTo(width, 6)
    const hiddenTop = -fit.top / fit.scale
    const hiddenBottom = (fit.top + fit.height - height) / fit.scale
    expect(hiddenTop + hiddenBottom).toBeLessThan(80) // a thin band, in canvas px (under 7.5%)
    expect(hiddenTop / (hiddenTop + hiddenBottom)).toBeCloseTo(ROOM_VIEW.topShare, 6)
  })

  it('keeps every object and hotspot in view', async () => {
    const { ROOM_VIEW, roomFocus } = await import('../scene/layout')
    const width = 1200
    const height = width / ROOM_VIEW.aspect
    const fit = coverFit(width, height, roomFocus(width, height))
    const top = -fit.top / fit.scale
    const bottom = top + height / fit.scale
    for (const h of HOTSPOTS) {
      const b = boundsOf(h.polygons)
      expect(b.y).toBeGreaterThanOrEqual(top) // the woman's head, the shelf books…
      expect(b.y + b.height / 2).toBeLessThan(bottom)
    }
    for (const o of OVERLAYS) expect(o.y).toBeGreaterThanOrEqual(top)
    expect(top).toBeLessThan(40) // the orchid's flowers (from about y 56) stay whole
    expect(bottom).toBeGreaterThan(1010) // and so do the desk drawers (to about y 1000)
  })

  it('crops the sides around the desk, as before, in a box narrower than the canvas', async () => {
    const { roomFocus } = await import('../scene/layout')
    expect(roomFocus(1024, 768)).toEqual({ x: 0.7, y: 0.6 })
  })
})

describe('the panning room on a portrait phone', () => {
  // A 390 x 844 phone: the room is 366 wide and 1.15 times as tall (App.css).
  const width = 366
  const height = 421

  it('shows the whole canvas height, from its left edge', async () => {
    const { panFit } = await import('../scene/layout')
    const fit = panFit(width, height)
    expect(fit.height).toBe(height)
    expect(fit.width).toBeCloseTo((CANVAS_WIDTH * height) / CANVAS_HEIGHT, 6)
    expect(fit.left).toBe(0)
    expect(fit.top).toBe(0)
  })

  it('opens on her and the desk, with the record player and shelf to the left and the cat to the right', async () => {
    const { ROOM_PAN, panFit, panScrollFor } = await import('../scene/layout')
    const fit = panFit(width, height)
    const scroll = panScrollFor(fit, width, ROOM_PAN.startX)
    const from = scroll / fit.scale
    const to = (scroll + width) / fit.scale
    const span = (id: string) => {
      const b = boundsOf(HOTSPOTS.find((h) => h.id === id)!.polygons)
      return [b.x, b.x + b.width]
    }
    const [, vinylTo] = span('vinyl')
    const [booksFrom] = span('books')
    const [catFrom] = span('cat')
    const [laptopFrom] = span('laptop')
    const [deskbooksFrom, deskbooksTo] = span('deskbooks')
    expect(vinylTo).toBeLessThan(from)
    expect(booksFrom).toBeLessThan(from)
    expect(catFrom).toBeGreaterThan(to)
    expect(deskbooksFrom).toBeGreaterThan(from)
    expect(deskbooksTo).toBeLessThan(to)
    expect(laptopFrom).toBeGreaterThan(from)
    // her greeting hangs from x 760, about 180 canvas px either side at this size
    expect(760 - 180).toBeGreaterThan(from)
  })

  it('keeps the scroll within the canvas, and finds the centre again from it', async () => {
    const { panCentreAt, panFit, panScrollFor } = await import('../scene/layout')
    const fit = panFit(width, height)
    expect(panScrollFor(fit, width, 0)).toBe(0)
    expect(panScrollFor(fit, width, CANVAS_WIDTH)).toBeCloseTo(fit.width - width, 6)
    const scroll = panScrollFor(fit, width, 1000)
    expect(panCentreAt(fit, width, scroll)).toBeCloseTo(1000, 6)
  })

  it('does not pan a box as wide as the canvas', async () => {
    const { panFit, panScrollFor } = await import('../scene/layout')
    const fit = panFit(1440, 810)
    expect(fit.width).toBe(1440)
    expect(panScrollFor(fit, 1440, 990)).toBe(0)
  })
})
