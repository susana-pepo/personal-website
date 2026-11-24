import { describe, expect, it } from 'vitest'
import { content } from '../content/content'
import { SECTION_IDS } from '../content/types'
import { HOTSPOTS, SCENE_HEIGHT, SCENE_WIDTH, boundsOf, type Point } from '../scene/hotspots'
import { OVERLAYS } from '../scene/layout'

function inside([x, y]: Point, poly: Point[]): boolean {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

function polygonArea(poly: Point[]): number {
  let sum = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) sum += (poly[j]![0] + poly[i]![0]) * (poly[j]![1] - poly[i]![1])
  return Math.abs(sum / 2)
}

/** Even-odd: a point inside an odd number of a hotspot's polygons belongs to it. */
const insideAny = (p: Point, polys: Point[][]) => polys.filter((poly) => inside(p, poly)).length % 2 === 1

describe('hotspot geometry', () => {
  it('gives each object its own section (or the cat its pet action), and every named section an object', () => {
    const sections = HOTSPOTS.flatMap((h) => (h.section ? [h.section] : []))
    expect(new Set(sections).size).toBe(sections.length)
    for (const id of SECTION_IDS) {
      const named = content.sections[id].objectName !== ''
      expect(HOTSPOTS.some((h) => h.section === id), id).toBe(named)
    }
    expect(HOTSPOTS.filter((h) => h.action === 'pet').map((h) => h.id)).toEqual(['cat'])
  })

  it('keeps every point and label anchor inside the 1920×1080 scene', () => {
    for (const h of HOTSPOTS) {
      for (const [x, y] of h.polygons.flat()) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(SCENE_WIDTH)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(SCENE_HEIGHT)
      }
      expect(h.label.x).toBeGreaterThanOrEqual(0)
      expect(h.label.y).toBeGreaterThanOrEqual(0)
    }
  })

  it('uses outlines, not oversized boxes (objects under 12% of the scene; the woman, the largest figure, under 30%)', () => {
    for (const h of HOTSPOTS) {
      const area = h.polygons.reduce((sum, poly) => sum + polygonArea(poly), 0)
      expect(area / (SCENE_WIDTH * SCENE_HEIGHT), h.id).toBeLessThan(h.overlay === 'woman' ? 0.3 : 0.12)
      // and the outline is meaningfully tighter than its bounding box
      const b = boundsOf(h.polygons)
      expect(area / (b.width * b.height), h.id).toBeLessThan(0.95)
    }
  })

  it('only lets outlines overlap where a transparent object sits on top, and then the top one takes the click', () => {
    // Sample a grid. Two outlines may share a point only where an overlay genuinely sits over
    // something (the record player's lid and the books; the laptop's base over the notebook's
    // corner; the lamp standing behind the woman's hair and the desk books; her long hair in
    // front of the lowest shelf of books). There the outline drawn last, the overlay painted
    // on top, must win.
    let shared = 0
    for (let x = 0; x <= SCENE_WIDTH; x += 4) {
      for (let y = 0; y <= SCENE_HEIGHT; y += 4) {
        const owners = HOTSPOTS.filter((h) => insideAny([x, y], h.polygons))
        if (owners.length <= 1) continue
        const top = owners[owners.length - 1]!
        const topZ = OVERLAYS.find((o) => o.id === top.overlay)?.z ?? 0
        for (const other of owners.slice(0, -1)) {
          const otherZ = OVERLAYS.find((o) => o.id === other.overlay)?.z ?? 1 // painted into the room
          expect(topZ, `overlap at ${x},${y}: ${top.id} must be above ${other.id}`).toBeGreaterThan(otherZ)
        }
        shared++
      }
    }
    expect(shared, 'overlapping sample points').toBeLessThan(650)
  })

  it('stacks overlay outlines in the same order as the pictures', () => {
    const z = (id: string | null) => OVERLAYS.find((o) => o.id === id)?.z ?? 0
    const order = HOTSPOTS.filter((h) => h.overlay).map((h) => z(h.overlay))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
})
