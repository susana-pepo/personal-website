import { useSyncExternalStore } from 'react'
import { currentSection, subscribe } from '../lib/router'

/** The section currently open via the URL hash, or null when in the room. */
export function useSection() {
  return useSyncExternalStore(subscribe, currentSection, () => null)
}
