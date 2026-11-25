import { useSyncExternalStore } from 'react'

/**
 * Where the open page's sheet covers the whole room: a phone in portrait, at least 640px tall.
 * The same media as the tower-light rule in HeroScene.css (measured there).
 */
const SHEET_COVERS_ROOM = '(max-width: 639px) and (min-height: 640px)'
/** The sheet has landed over the room by then (its rise, or its fade with reduced motion): the tower-light rule's delay. */
const LANDED_MS = 500

type Listener = (covered: boolean) => void

const listeners = new Set<Listener>()
let covered = false
let landing: number | undefined
let stopWatching: (() => void) | null = null
let stopping: number | undefined

function set(next: boolean) {
  if (next === covered) return
  covered = next
  // For the room's CSS animations, which pause in place under it (HeroScene.css).
  document.documentElement.toggleAttribute('data-room-covered', next)
  for (const listener of [...listeners]) listener(next)
}

/**
 * Whether the landed sheet really hides the room: its top edge is at or above the room's. The
 * media query alone doesn't promise it: in a short, narrow window (a desktop window, a split
 * screen) the page can be scrolled before the page opens, and the open page keeps that scroll,
 * so the top of the room can show in the strip above the sheet, where nothing may be seen to stop.
 */
function sheetCoversRoom(): boolean {
  const room = document.querySelector('.stage')
  const sheet = document.querySelector('.panel__sheet')
  if (!room || !sheet) return false
  return room.getBoundingClientRect().top >= sheet.getBoundingClientRect().top - 0.5
}

/**
 * Covered from the moment the sheet has landed over the room, until the moment the page starts
 * to close (data-panel becomes 'closing' or goes): the room is already moving again while the
 * sheet still covers it, so the close never uncovers a room still at rest. Checked again when
 * the window is resized, since that can move the room or the sheet.
 */
function update(media: MediaQueryList) {
  const open = document.documentElement.dataset.panel === 'open' && media.matches
  if (!open) {
    window.clearTimeout(landing)
    landing = undefined
    set(false)
    return
  }
  if (landing !== undefined) return
  if (covered) {
    set(sheetCoversRoom())
    return
  }
  landing = window.setTimeout(() => {
    landing = undefined
    set(sheetCoversRoom())
  }, LANDED_MS)
}

/** Watches the page's html[data-panel] (SectionPanel sets it), the screen and the window's size, while anyone listens. */
function watch() {
  const media = window.matchMedia(SHEET_COVERS_ROOM)
  const check = () => update(media)
  const observer = new MutationObserver(check)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-panel'] })
  media.addEventListener('change', check)
  window.addEventListener('resize', check)
  check()
  return () => {
    observer.disconnect()
    media.removeEventListener('change', check)
    window.removeEventListener('resize', check)
    window.clearTimeout(landing)
    landing = undefined
    set(false)
  }
}

/**
 * True while, on a phone, the open page's opaque sheet covers the whole room, so nothing of it
 * can be seen. The room's loops rest in place then: they stop drawing frames and their videos
 * pause, keeping every state exactly where it is, and they carry on from there once it's
 * uncovered. It is not part of motionAllowed (useScenePlayback), which would swap the clips for
 * their stills and snap the weather to where it's going.
 */
export function roomCovered(): boolean {
  return covered
}

/** Calls `listener` each time the room is covered or uncovered; returns the unsubscribe. */
export function onRoomCovered(listener: Listener): () => void {
  if (typeof window === 'undefined') return () => {}
  listeners.add(listener)
  window.clearTimeout(stopping)
  if (!stopWatching) stopWatching = watch()
  return () => {
    listeners.delete(listener)
    if (listeners.size > 0) return
    // Not at once: when the room's motion changes, every loop lets go and takes hold again in
    // the same commit, and the room must stay covered through that (not wait another LANDED_MS).
    window.clearTimeout(stopping)
    stopping = window.setTimeout(() => {
      if (listeners.size > 0 || !stopWatching) return
      const stop = stopWatching
      stopWatching = null
      stop()
    })
  }
}

/** roomCovered() as React state, for a component that renders from it. */
export function useRoomCovered(): boolean {
  return useSyncExternalStore(onRoomCovered, roomCovered, () => false)
}
