import type { CSSProperties } from 'react'
import { pctBox } from './layout'
import views from './window-views.json'

/** The three views the window can show (dawn is what the painting itself shows). */
export const TIMES = ['dawn', 'midday', 'night'] as const
export type TimeOfDay = (typeof TIMES)[number]

/**
 * The hour (0-23, the visitor's own clock) each view starts at. Each runs until
 * the next one starts; night runs on past midnight to dawn.
 */
export const TIME_STARTS: Record<TimeOfDay, number> = { dawn: 5, midday: 11, night: 18 }

/** The view for an hour of the day (0-23). */
export function timeForHour(hour: number): TimeOfDay {
  if (hour >= TIME_STARTS.night || hour < TIME_STARTS.dawn) return 'night'
  if (hour >= TIME_STARTS.midday) return 'midday'
  return 'dawn'
}

/**
 * The view for a moment, read in the visitor's own time zone (the browser's
 * clock): no location lookup, nothing sent anywhere.
 */
export function timeAt(date: Date): TimeOfDay {
  return timeForHour(date.getHours())
}

/** A box on the 1920x1080 canvas, in canvas px. */
export interface CanvasRect {
  x: number
  y: number
  width: number
  height: number
}

export interface TowerLightSpot {
  x: number
  y: number
  size: number
  /** 0-1: how strongly it glows (faint by day). */
  strength: number
}

export interface CityWindow {
  x: number
  y: number
  w: number
  h: number
  /** The wall colour around it: what the window turns to when its light goes out. */
  facade: string
}

export interface WindowViewMedia {
  /** The animated loop (a forward-and-back ping-pong, so it never jumps). */
  animated: string
  /** Its first frame: shown at once, and on its own with reduced motion or a paused room. */
  still: string
  /** The loop's frame size in pixels (it plays as an H.264 video beside the WebP: LoopClip). */
  size: readonly [number, number]
  towerLights: TowerLightSpot[]
  cityWindows: CityWindow[]
}

/** Where the views are drawn on the canvas; `mask` is the painting's exact glass over that box. */
export const WINDOW_VIEW_BOX: CanvasRect = views.canvasBox
export const WINDOW_VIEW_MASK: string = views.mask

/** Style for a layer drawn behind the window's glass: the view's box, masked to the glass. */
export const WINDOW_GLASS_STYLE: CSSProperties = {
  ...pctBox(WINDOW_VIEW_BOX),
  WebkitMask: `url('${WINDOW_VIEW_MASK}') 0 0 / 100% 100% no-repeat`,
  mask: `url('${WINDOW_VIEW_MASK}') 0 0 / 100% 100% no-repeat`,
}

/** Each time's view, with the tower lights and lit windows found in it (scripts/build-window-views.py). */
export const WINDOW_VIEWS: Record<TimeOfDay, WindowViewMedia> = {
  dawn: pick(views.dawn),
  midday: pick(views.midday),
  night: pick(views.night),
}

function pick(entry: { animated: string; still: string; size?: number[]; towerLights?: TowerLightSpot[]; cityWindows?: CityWindow[] }): WindowViewMedia {
  return {
    animated: entry.animated,
    size: [entry.size?.[0] ?? 957, entry.size?.[1] ?? 695],
    still: entry.still,
    towerLights: entry.towerLights ?? [],
    cityWindows: entry.cityWindows ?? [],
  }
}
