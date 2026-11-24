import { useSyncExternalStore } from 'react'

/**
 * The quiet "Explore the room" hint under the scene. It shows on a first
 * visit and goes away for good after the first real interaction with an
 * object, or when dismissed. Remembered in this browser only; if storage is
 * unavailable it simply shows again next visit.
 */
const KEY = 'room-hint-dismissed'
const listeners = new Set<() => void>()

let dismissed = (() => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
})()

export function dismissDiscoveryHint() {
  if (dismissed) return
  dismissed = true
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* private mode: fine, it just shows again next time */
  }
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDiscoveryHintVisible(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !dismissed,
    () => false,
  )
}
