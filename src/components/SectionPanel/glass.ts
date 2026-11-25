/**
 * The smoked glass's reflection of the room (SectionPanel.css). The glass can't sample the live
 * room (no backdrop-filter, no filter: the room animates and a blur flickered on Retina), so
 * each time of day has one still of the whole room, mirrored and blurred ahead of time, in
 * public/media/panel. When the panel opens, the still is laid where the room's mirror image
 * really falls on the sheet, measured from the stage's box, so the lamp and the window show in
 * the glass where they would at any window size. The pure maths here is tested without a DOM.
 */

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** Where the reflection still goes, in px from the sheet's top left corner. */
export interface Plate {
  x: number
  y: number
  w: number
  h: number
}

export type Light = 'night' | 'midday' | 'dawn'

const measurable = (b: Box) => b.width > 0 && b.height > 0 && [b.left, b.top, b.width, b.height].every(Number.isFinite)
const px = (v: number) => Math.round(v * 10) / 10

/**
 * Desktop: the room beside the sheet, mirrored about the sheet's lamp-side (left) edge. A point
 * d px left of the edge shows d px inside it, so the still (already mirrored left to right)
 * starts where the stage's right end lands: sheet.left - stage.right.
 */
export function mirrorBeside(stage: Box, sheet: Box): Plate | null {
  if (!measurable(stage) || !measurable(sheet)) return null
  return {
    x: px(sheet.left - (stage.left + stage.width)),
    y: px(stage.top - sheet.top),
    w: px(stage.width),
    h: px(stage.height),
  }
}

/**
 * Phones: the sheet covers the room, so its top edge shows the room as if held up to it: the
 * still (mirrored top to bottom) hangs from the top edge, lined up with the room across.
 */
export function mirrorAbove(stage: Box, sheet: Box): Plate | null {
  if (!measurable(stage) || !measurable(sheet)) return null
  return { x: px(stage.left - sheet.left), y: 0, w: px(stage.width), h: px(stage.height) }
}

/**
 * How strongly the lamp lights the lit edge, 1 when the bulb is right beside it, easing to 0.35
 * when it is far off (a wide window, where the room ends well before the sheet). `gap` is the
 * bulb's distance from the edge in px.
 */
export function lampReach(gap: number): number {
  if (!Number.isFinite(gap)) return 1
  const d = Math.max(0, gap - 40)
  return Math.round((0.35 + 0.65 * Math.exp(-((d / 260) ** 2))) * 100) / 100
}

export const LIGHTS: readonly Light[] = ['night', 'midday', 'dawn']

export function asLight(value: string | null | undefined): Light {
  return value === 'midday' || value === 'dawn' ? value : 'night'
}

/** The stills one layout needs: the face and the bevel beside the lamp, or the phone's top edge. */
export function reflectionFiles(light: Light, phone: boolean): string[] {
  const parts = phone ? ['top'] : ['face', 'edge']
  return parts.map((part) => `/media/panel/reflection-${light}-${part}.webp`)
}

export const PHONE_QUERY = '(max-width: 639px)'

/** Measures the stage and sets the reflection's place and light on the dialog. */
export function placeReflection(dialog: HTMLElement, bulb: { x: number; y: number } | null) {
  const stage = document.querySelector('.cover .stage') ?? document.querySelector('.stage')
  const scene = stage?.querySelector('.scene')
  dialog.dataset.light = asLight(scene?.getAttribute('data-time'))
  const sheet = dialog.getBoundingClientRect()
  const phone = window.matchMedia(PHONE_QUERY).matches
  const box = stage?.getBoundingClientRect()
  const plate = box ? (phone ? mirrorAbove : mirrorBeside)(box, sheet) : null
  const set = (name: string, value: string | null) =>
    value === null ? dialog.style.removeProperty(name) : dialog.style.setProperty(name, value)
  set('--refl-x', plate ? `${plate.x}px` : null)
  set('--refl-y', plate ? `${plate.y}px` : null)
  set('--refl-w', plate ? `${plate.w}px` : null)
  set('--refl-h', plate ? `${plate.h}px` : null)
  const gap = bulb ? (phone ? sheet.top - bulb.y : sheet.left - bulb.x) : Number.NaN
  set('--lamp-near', bulb ? String(lampReach(gap)) : null)
}

/** Decoded stills, held so the browser keeps them ready for the first open. */
const prepared = new Map<string, HTMLImageElement>()

/**
 * Fetches and decodes the stills while the page is idle, the current light first, so opening a
 * panel never waits on them. Cheap: the stills are small and fetched once.
 */
export function prepareReflections(current: Light) {
  const phone = window.matchMedia(PHONE_QUERY).matches
  const order = [current, ...LIGHTS.filter((l) => l !== current)]
  const files = [...order.flatMap((l) => reflectionFiles(l, phone)), '/media/panel/smoke.webp']
  for (const src of files) {
    if (prepared.has(src)) continue
    const img = new Image()
    img.decoding = 'async'
    img.src = src
    prepared.set(src, img)
    img.decode?.().catch(() => prepared.delete(src))
  }
}
