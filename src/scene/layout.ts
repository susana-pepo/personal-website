import { canvas, cat, coffee, media, overlays, vinyl, woman } from './scene-layout.json'

/**
 * The scene is one 1920×1080 canvas. The static room, every transparent
 * layer (each can be animated on its own) and every clickable outline use
 * these coordinates, and the whole canvas is scaled as a single unit, so
 * nothing can drift apart.
 */
export const CANVAS_WIDTH = canvas.width
export const CANVAS_HEIGHT = canvas.height

/** Optional animated room; null for the static room. */
export const ROOM_VIDEO_SRC: string | null = media.video
export const ROOM_POSTER_SRC = media.poster
/** Where the room image (and video, if any) is drawn on the canvas (slightly zoomed so the room lines up). */
export const ROOM_FRAME = media.frame
/** Playback speed of the room clip (1 = as rendered). */
export const ROOM_PLAYBACK_RATE = media.playbackRate

export type OverlayId = 'camera' | 'books' | 'vinyl' | 'lamp' | 'vase' | 'deskbooks' | 'laptop' | 'woman' | 'coffee' | 'cat'

/** Halo images extend this many canvas pixels beyond each overlay (see scripts/build-glows.py). */
export const HALO_MARGIN = 36

export interface Glow {
  /** Halo opacity when nobody is interacting: soft, steady. */
  rest: number
  /** How much the halo swells during the breathing invitation pulse, before the first interaction. */
  invite: number
  /** Halo opacity on hover or focus. */
  hover: number
  /** Brightness of the artwork on hover (1 = unchanged). */
  lift: number
}

export interface Overlay {
  id: OverlayId
  src: string
  /** Precomputed silhouette glow, drawn just behind the object. Only interactive section objects have one. */
  halo: string | null
  /** Optional precomputed highlight (laptop screen, record and metal details), drawn on top. */
  sheen: string | null
  /** Glow settings; null for plain layers (woman, camera, desk books) and the cat. */
  glow: Glow | null
  /** Optional soft contact shadow under the object, in fractions of its box. */
  shadow: { x: number; y: number; w: number; h: number; opacity: number } | null
  /** Canvas px from the top of the box where the clickable outline starts (0 = the whole artwork; the coffee's steam is left out). */
  hitFrom: number
  /** Top-left corner and size in canvas pixels. Height follows the PNG's own ratio. */
  x: number
  y: number
  width: number
  height: number
  z: number
}

export const OVERLAY_IDS: readonly OverlayId[] = ['camera', 'books', 'vinyl', 'lamp', 'vase', 'deskbooks', 'laptop', 'woman', 'coffee', 'cat']

type RawOverlay = (typeof overlays)[number] & { glow?: Glow; shadow?: Overlay['shadow']; hitFromY?: number }

export const OVERLAYS: readonly Overlay[] = (overlays as RawOverlay[]).map((raw) => {
  if (!OVERLAY_IDS.includes(raw.id as OverlayId)) throw new Error(`Unknown overlay ${raw.id}`)
  const [iw, ih] = raw.intrinsic as [number, number]
  return {
    id: raw.id as OverlayId,
    src: raw.src,
    halo: 'glow' in raw ? `/media/scene/glow/${raw.id}-halo.png` : null,
    sheen: raw.id === 'laptop' || raw.id === 'vinyl' ? `/media/scene/glow/${raw.id}-sheen.png` : null,
    glow: 'glow' in raw ? (raw as { glow: Glow }).glow : null,
    shadow: 'shadow' in raw ? (raw as { shadow: Overlay['shadow'] }).shadow : null,
    hitFrom: raw.hitFromY ? (raw.hitFromY * raw.width) / iw : 0,
    x: raw.x,
    y: raw.y,
    width: raw.width,
    height: (raw.width * ih) / iw,
    z: raw.z,
  }
})

export function overlay(id: OverlayId): Overlay {
  const found = OVERLAYS.find((o) => o.id === id)
  if (!found) throw new Error(`Missing overlay ${id}`)
  return found
}

/**
 * The cat: its sleeping clip (the base), the variations played now and then in its place, the
 * reactions it plays when hovered (each exactly as exported, ending on the sleeping pose;
 * scripts/build-cat.py), and the sleeping clip's first frame as a still.
 */
export const CAT_MEDIA = {
  sleep: cat.sleep,
  variations: cat.variations,
  reactions: cat.reactions,
  still: cat.still,
} as const

/** The woman writing: the chair drawn over her, and one still of it all (her clips: womanClips.ts). */
export const WOMAN_MEDIA = {
  chair: woman.chair,
  still: woman.still,
} as const

/** The steaming coffee: an animated, transparent loop and its first frame as a still. */
export const COFFEE_MEDIA = {
  animated: coffee.animated,
  still: coffee.still,
} as const

/** The record player's moving parts (positions in the body image's own pixels). */
export const VINYL_PARTS = {
  body: vinyl.body,
  disc: vinyl.disc,
  discSheen: vinyl.discSheen,
  spindle: vinyl.spindle,
  tonearmArm: vinyl.tonearmArm,
  tonearmBase: vinyl.tonearmBase,
  discCenter: vinyl.discCenter as [number, number],
  discWidth: vinyl.discWidth,
  tilt: vinyl.tilt,
  edge: vinyl.edge,
  rpm: vinyl.rpm,
  imageSize: [960, 795] as const,
} as const

/** Percentages of the canvas, for positioning inside the scaled scene box. */
export const pctX = (x: number) => `${(x / CANVAS_WIDTH) * 100}%`
export const pctY = (y: number) => `${(y / CANVAS_HEIGHT) * 100}%`

/** A box on the canvas as left/top/width/height percentages, for an absolutely placed element. */
export function pctBox(box: { x: number; y: number; width: number; height: number }) {
  return { left: pctX(box.x), top: pctY(box.y), width: pctX(box.width), height: pctY(box.height) }
}

export interface CoverFit {
  width: number
  height: number
  left: number
  top: number
  scale: number
}

/**
 * Scale the canvas to cover a box, as one unit. When the box has a different
 * shape from the canvas, `focus` (0–1 on each axis, in canvas terms) decides
 * which part stays in view: by default the area between the writer and the cat.
 */
export function coverFit(boxWidth: number, boxHeight: number, focus = { x: 0.7, y: 0.6 }): CoverFit {
  const scale = Math.max(boxWidth / CANVAS_WIDTH, boxHeight / CANVAS_HEIGHT)
  const width = CANVAS_WIDTH * scale
  const height = CANVAS_HEIGHT * scale
  const clamp = (value: number, min: number) => Math.min(0, Math.max(min, value))
  return {
    width,
    height,
    left: clamp(boxWidth / 2 - width * focus.x, boxWidth - width),
    top: clamp(boxHeight / 2 - height * focus.y, boxHeight - height),
    scale,
  }
}

/**
 * How the room is framed on the page: a cinematic 1.9:1 instead of the
 * canvas's 16:9, so the masthead and the player fit around it. The whole width
 * shows (record player to cat); about 70 canvas px of height are hidden, 40%
 * of it at the top (about 28 px: the orchid's flowers start near y 56) and the
 * rest at the bottom (the floor and the desk's feet; the drawer fronts stay
 * whole). Nothing that can be hovered or clicked is hidden.
 */
export const ROOM_VIEW = { aspect: 1.9, topShare: 0.4 } as const

/**
 * The `focus` for coverFit that frames the room as ROOM_VIEW says: in a box
 * wider than the canvas, `topShare` of the hidden height comes off the top.
 * In a narrower box the sides crop around the desk, as before.
 */
export function roomFocus(boxWidth: number, boxHeight: number, topShare: number = ROOM_VIEW.topShare): { x: number; y: number } {
  const scale = Math.max(boxWidth / CANVAS_WIDTH, boxHeight / CANVAS_HEIGHT)
  const height = CANVAS_HEIGHT * scale
  const hidden = height - boxHeight
  return { x: 0.7, y: hidden > 0 ? (boxHeight / 2 + hidden * topShare) / height : 0.6 }
}
