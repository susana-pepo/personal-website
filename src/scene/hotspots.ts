import { height, hotspots, width } from './hotspot-geometry.json'
import { isSectionId, type SectionId } from '../content/types'
import { CANVAS_HEIGHT, CANVAS_WIDTH, OVERLAY_IDS, type OverlayId } from './layout'

/** The canvas size. All hotspot coordinates use this space. */
export const SCENE_WIDTH = width
export const SCENE_HEIGHT = height

if (width !== CANVAS_WIDTH || height !== CANVAS_HEIGHT) {
  throw new Error('hotspot-geometry.json and scene-layout.json disagree about the canvas size')
}

export type Point = readonly [number, number]
export type LabelPlacement = 'top' | 'bottom' | 'left' | 'right'
export type HotspotAction = 'pet' | 'light' | 'play'

export interface Hotspot {
  id: string
  /** Section this object opens, or null when it does something in place (the cat, the lamp, the piano). */
  section: SectionId | null
  /** What an object without a section does when activated. */
  action: HotspotAction | null
  /** The transparent overlay this outline was traced from, if any. */
  overlay: OverlayId | null
  polygons: Point[][]
  /** Where the hover tag attaches, and which side of that point it sits on. */
  label: { x: number; y: number; placement: LabelPlacement }
}

const PLACEMENTS: readonly LabelPlacement[] = ['top', 'bottom', 'left', 'right']
const ACTIONS: readonly HotspotAction[] = ['pet', 'light', 'play']

type RawHotspot = (typeof hotspots)[number] & { action?: string; overlay?: string }

function toHotspot(raw: RawHotspot): Hotspot {
  const placement = raw.label.placement as LabelPlacement
  if (!PLACEMENTS.includes(placement)) throw new Error(`Hotspot ${raw.id}: invalid label placement`)
  if (raw.section !== null && !isSectionId(raw.section)) throw new Error(`Hotspot ${raw.id}: unknown section`)
  const action = (raw.action ?? null) as HotspotAction | null
  if (action !== null && !ACTIONS.includes(action)) throw new Error(`Hotspot ${raw.id}: unknown action`)
  if ((raw.section === null) === (action === null)) throw new Error(`Hotspot ${raw.id}: needs a section or an action`)
  const overlayId = (raw.overlay ?? null) as OverlayId | null
  if (overlayId !== null && !OVERLAY_IDS.includes(overlayId)) throw new Error(`Hotspot ${raw.id}: unknown overlay`)
  return {
    id: raw.id,
    section: raw.section as SectionId | null,
    action,
    overlay: overlayId,
    label: { x: raw.label.x, y: raw.label.y, placement },
    polygons: raw.polygons.map((poly) => poly.map(([x, y]) => [x, y] as Point)),
  }
}

export const HOTSPOTS: readonly Hotspot[] = (hotspots as RawHotspot[]).map(toHotspot)

/** SVG path data for one or more closed polygons. */
export function toPathData(polygons: Point[][]): string {
  return polygons.map((poly) => 'M' + poly.map(([x, y]) => `${x} ${y}`).join('L') + 'Z').join('')
}

/** Axis-aligned bounds of a hotspot, in canvas coordinates. */
export function boundsOf(polygons: Point[][]) {
  const xs = polygons.flat().map(([x]) => x)
  const ys = polygons.flat().map(([, y]) => y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

export { pctX, pctY } from './layout'
