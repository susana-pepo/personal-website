/**
 * The piano computer on the top shelf, a glimmer: a click brings it close, to be played. This is
 * which of its 13 keys (one octave, C4 to C5) are down.
 *
 * Its close-up is the resting piano with a pressed sprite for each key laid over it
 * (scripts/build-piano.py); a key shows its sprite while it is down. A key goes down at once
 * and comes up at once, but stays down at least MIN_DOWN_MS, so even the quickest tap is seen.
 * Any number of keys can be down together (chords, several fingers), and each finger or key on
 * the keyboard holds its own key, so lifting one never lifts another that is still held.
 *
 * Kept free of React and the DOM so it can be tested; listeners hear every note that starts
 * (for the screen's reactions and any sound to come).
 */
import geometry from './piano-keys.json'

export interface PianoKey {
  id: string
  midi: number
  kind: 'white' | 'black'
  /** Where the pressed sprite sits on the piano: x, y, width, height (in the piano picture's pixels). */
  box: [number, number, number, number]
  /** The sprite's top-left corner in the atlas. */
  atlas: [number, number]
  /** The key's clickable outline, an SVG path in the piano picture's pixels. */
  hit: string
}

/** The close-up's size, in its own pixels (every box and outline here uses them). */
export const PIANO_SIZE = geometry.size as [number, number]
/** The close-up: the piano at rest at full resolution. */
export const PIANO_CLOSE_SRC = geometry.close
export const PIANO_ATLAS = geometry.atlas as { src: string; size: [number, number] }
/** The black screen: where its pixel-art reactions will show (its box, and its outline as an SVG path). */
export const PIANO_SCREEN = geometry.screen as { box: [number, number, number, number]; path: string }
/**
 * The picture on the shelf: its own render (three-quarter, its left side showing, like the other things on
 * the shelf), so not the close-up's pixels: its size, and its screen's box (x, y, width, height) in them.
 * (The glimmer hint's notes rise from the top right of this screen.)
 */
export const PIANO_SHELF = geometry.shelf as { size: [number, number]; screen: [number, number, number, number] }
/** How far the shelf picture was sheared to sit on the sloping board (degrees, right side down). */
export const PIANO_SHELF_SHEAR = (geometry as unknown as { source?: { shelfShear?: number } }).source?.shelfShear ?? 0
/** A brass knob on the close-up (its printed needle is painted out: the close-up draws one that turns). */
export interface PianoKnob {
  cx: number
  cy: number
  r: number
  /** The printed needle: its angle (degrees, anticlockwise from 3 o'clock), reach from the centre, width and colour. */
  angle: number
  inner: number
  outer: number
  width: number
  colour: [number, number, number]
}
/** The two knobs, top first: the top one picks the screen's landscape, the bottom one the keys' tone. */
export const PIANO_KNOBS: PianoKnob[] = (geometry as unknown as { knobs?: PianoKnob[] }).knobs ?? []
/** White keys first, so the black keys draw, and catch the pointer, on top. */
export const PIANO_KEYS = geometry.keys as PianoKey[]
const KEY_IDS = new Set(PIANO_KEYS.map((k) => k.id))

/** Keys on a computer keyboard play the piano, the usual way: the home row is the white keys. */
export const KEYBOARD_NOTES: Readonly<Record<string, string>> = {
  KeyA: 'C4', KeyW: 'C#4', KeyS: 'D4', KeyE: 'D#4', KeyD: 'E4', KeyF: 'F4', KeyT: 'F#4',
  KeyG: 'G4', KeyY: 'G#4', KeyH: 'A4', KeyU: 'A#4', KeyJ: 'B4', KeyK: 'C5',
}

/** The shortest a key stays down, so a quick tap still shows. */
export const MIN_DOWN_MS = 90

type Listener = () => void
type NoteListener = (key: string) => void

/**
 * Who holds which key. A holder is one pointer (`p<id>`) or one keyboard key (`k<code>`);
 * a key is down while anyone holds it (and for MIN_DOWN_MS after it went down).
 */
export function createPiano(now: () => number = () => performance.now(), later = (fn: () => void, ms: number) => setTimeout(fn, ms)) {
  const holders = new Map<string, string>() // holder -> key
  const since = new Map<string, number>() // key -> when it went down
  const lingering = new Map<string, number>() // let go, but kept down for its minimum time (-> which lingering)
  let lingers = 0
  let down: ReadonlySet<string> = new Set()
  const listeners = new Set<Listener>()
  const noteListeners = new Set<NoteListener>()

  const update = () => {
    const next = new Set([...holders.values(), ...lingering.keys()])
    if (next.size === down.size && [...next].every((k) => down.has(k))) return
    down = next
    listeners.forEach((l) => l())
  }

  const isHeld = (key: string) => [...holders.values()].includes(key)

  function release(holder: string) {
    const key = holders.get(holder)
    if (!key) return
    holders.delete(holder)
    if (isHeld(key)) return
    const left = MIN_DOWN_MS - (now() - (since.get(key) ?? 0))
    if (left > 0) {
      const mine = ++lingers
      lingering.set(key, mine)
      later(() => {
        // (unless it was struck again since, and is someone else's now)
        if (lingering.get(key) !== mine) return
        lingering.delete(key)
        update()
      }, left)
    }
    update()
  }

  function press(holder: string, key: string) {
    if (!KEY_IDS.has(key) || holders.get(holder) === key) return
    release(holder)
    const struck = !isHeld(key)
    holders.set(holder, key)
    if (struck) {
      since.set(key, now())
      lingering.delete(key)
    }
    update()
    if (struck) noteListeners.forEach((l) => l(key))
  }

  return {
    press,
    release,
    /** Let go of everything (the page hides, the piano loses focus). */
    releaseAll() {
      for (const holder of [...holders.keys()]) release(holder)
    },
    keys: () => down,
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    /** Hear every note as it is struck. */
    onNote(listener: NoteListener) {
      noteListeners.add(listener)
      return () => void noteListeners.delete(listener)
    },
  }
}

export type Piano = ReturnType<typeof createPiano>

/** The room's piano. */
export const piano = createPiano()
