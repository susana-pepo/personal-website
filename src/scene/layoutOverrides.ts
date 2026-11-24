import { useSyncExternalStore } from 'react'
import type { Overlay, OverlayId } from './layout'

/**
 * Development-only overrides of overlay positions, used by the placement
 * sandbox (?sandbox=1). They're kept in this browser's storage so a page reload
 * (e.g. the dev server picking up an edit) doesn't lose what you've placed;
 * "Reset all" clears them. Nothing reaches the real layout: copy the numbers
 * the sandbox shows into src/scene/scene-layout.json.
 */
export interface Placement {
  x: number
  y: number
  width: number
}

const STORAGE_KEY = 'scene-sandbox-placements'

function load(): Map<OverlayId, Placement> {
  if (!import.meta.env.DEV) return new Map()
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Placement>
    return new Map(Object.entries(saved) as [OverlayId, Placement][])
  } catch {
    return new Map()
  }
}

const overrides = load()
const listeners = new Set<() => void>()
let version = 0

const emit = () => {
  version++
  try {
    if (overrides.size) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(overrides)))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable (private window, blocked): placements just won't survive a reload
  }
  for (const listener of listeners) listener()
}

export function setPlacement(id: OverlayId, placement: Placement) {
  overrides.set(id, placement)
  emit()
}

export function clearPlacements() {
  overrides.clear()
  emit()
}

export function getPlacement(id: OverlayId): Placement | undefined {
  return overrides.get(id)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The overlay with any sandbox override applied (height keeps the artwork's own ratio). */
export function usePlacedOverlay(overlay: Overlay): Overlay {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  )
  if (!import.meta.env.DEV) return overlay
  const o = overrides.get(overlay.id)
  if (!o) return overlay
  return { ...overlay, x: o.x, y: o.y, width: o.width, height: (o.width * overlay.height) / overlay.width }
}
