import { isSectionId, type SectionId } from '../content/types'

/**
 * A tiny hash router. Sections live at `#work`, `#about`, … so the site works
 * on any static host, deep links work, and the browser's back/forward buttons
 * open and close panels naturally.
 *
 * We tag each history entry with an index so that "Close" can step back to the
 * room when the previous entry *was* the room (keeping history tidy), and
 * otherwise pushes a fresh room entry.
 */

type Listener = (section: SectionId | null) => void

interface EntryState {
  spIndex: number
}

const listeners = new Set<Listener>()
/** Known hash for each history index this session. */
const hashByIndex = new Map<number, string>()
let currentIndex = 0
let started = false

export function parseHash(hash: string): SectionId | null {
  let raw = hash.replace(/^#\/?/, '')
  try {
    raw = decodeURIComponent(raw)
  } catch {
    // A mangled link: keep the raw text, which will simply not match a section.
  }
  const id = raw.toLowerCase()
  return isSectionId(id) ? id : null
}

function readState(): EntryState | null {
  const state = window.history.state as Partial<EntryState> | null
  return state && typeof state.spIndex === 'number' ? (state as EntryState) : null
}

function emit() {
  const section = parseHash(window.location.hash)
  listeners.forEach((listener) => listener(section))
}

function onLocationChange() {
  const state = readState()
  if (state) {
    currentIndex = state.spIndex
  } else {
    // A new entry created by following a hash link.
    currentIndex += 1
    window.history.replaceState({ ...(window.history.state ?? {}), spIndex: currentIndex }, '')
  }
  hashByIndex.set(currentIndex, window.location.hash)
  emit()
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  const state = readState()
  currentIndex = state?.spIndex ?? 0
  if (!state) window.history.replaceState({ ...(window.history.state ?? {}), spIndex: 0 }, '')
  hashByIndex.set(currentIndex, window.location.hash)
  window.addEventListener('hashchange', onLocationChange)
  window.addEventListener('popstate', () => {
    // popstate fires before hashchange on back/forward; sync index early.
    const s = readState()
    if (s) currentIndex = s.spIndex
  })
}

export function subscribe(listener: Listener): () => void {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function currentSection(): SectionId | null {
  return typeof window === 'undefined' ? null : parseHash(window.location.hash)
}

export function hrefFor(section: SectionId): string {
  return `#${section}`
}

/** Return to the room. */
export function closeSection() {
  if (!parseHash(window.location.hash)) return
  const previousHash = hashByIndex.get(currentIndex - 1)
  if (previousHash !== undefined && parseHash(previousHash) === null) {
    window.history.back()
    return
  }
  currentIndex += 1
  const url = window.location.pathname + window.location.search
  window.history.pushState({ spIndex: currentIndex }, '', url)
  hashByIndex.set(currentIndex, '')
  emit()
}
