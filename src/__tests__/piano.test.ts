import { describe, expect, it } from 'vitest'
import { KEYBOARD_NOTES, MIN_DOWN_MS, PIANO_ATLAS, PIANO_KEYS, PIANO_SCREEN, PIANO_SHELF, PIANO_SIZE, createPiano } from '../scene/piano'

function setup() {
  let t = 0
  const timers: { at: number; fn: () => void }[] = []
  const piano = createPiano(
    () => t,
    (fn, ms) => timers.push({ at: t + ms, fn }),
  )
  const advance = (ms: number) => {
    t += ms
    for (const timer of timers.splice(0).sort((a, b) => a.at - b.at)) {
      if (timer.at <= t) timer.fn()
      else timers.push(timer)
    }
  }
  const notes: string[] = []
  piano.onNote((key) => notes.push(key))
  return { piano, advance, notes, down: () => [...piano.keys()].sort() }
}

describe('the piano computer on the top shelf', () => {
  it('has one octave, C4 to C5: eight white keys, then five black ones drawn on top', () => {
    expect(PIANO_KEYS.map((k) => k.id)).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'C#4', 'D#4', 'F#4', 'G#4', 'A#4'])
    expect(PIANO_KEYS.map((k) => k.midi).sort((a, b) => a - b)).toEqual([...Array(13)].map((_, i) => 60 + i))
  })

  it('cuts every pressed sprite from inside the piano and the atlas', () => {
    const [w, h] = PIANO_SIZE
    const [aw, ah] = PIANO_ATLAS.size
    for (const key of PIANO_KEYS) {
      const [x, y, bw, bh] = key.box
      const [ax, ay] = key.atlas
      expect(x >= 0 && y >= 0 && x + bw <= w && y + bh <= h).toBe(true)
      expect(ax >= 0 && ay >= 0 && ax + bw <= aw && ay + bh <= ah).toBe(true)
      expect(key.hit).toMatch(/^M[\d. L]+Z$/)
    }
  })

  it('plays every key from the computer keyboard: A S D F G H J K the white keys, W E T Y U the black ones', () => {
    expect(Object.values(KEYBOARD_NOTES).sort()).toEqual(PIANO_KEYS.map((k) => k.id).sort())
    const white = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK'].map((c) => KEYBOARD_NOTES[c])
    const black = ['KeyW', 'KeyE', 'KeyT', 'KeyY', 'KeyU'].map((c) => KEYBOARD_NOTES[c])
    expect(white).toEqual(PIANO_KEYS.filter((k) => k.kind === 'white').map((k) => k.id))
    expect(black).toEqual(PIANO_KEYS.filter((k) => k.kind === 'black').map((k) => k.id))
  })

  it('keeps a place for the screen’s reactions, above the keys', () => {
    const [x, y, w, h] = PIANO_SCREEN.box
    const [W, H] = PIANO_SIZE
    expect(x > 0 && y > 0 && x + w < W && y + h < H).toBe(true)
    const keysTop = Math.min(...PIANO_KEYS.map((k) => k.box[1]))
    expect(y + h).toBeLessThan(keysTop)
  })

  it('knows where the screen is on the shelf’s own picture, for the glimmer hint', () => {
    const [x, y, w, h] = PIANO_SHELF.screen
    const [W, H] = PIANO_SHELF.size
    expect(x > 0 && y > 0 && x + w < W && y + h < H).toBe(true)
    // a real screen: a good part of the picture, wider than tall, in its upper half
    expect(w * h).toBeGreaterThan(W * H * 0.08)
    expect(w).toBeGreaterThan(h)
    expect(y + h / 2).toBeLessThan(H / 2)
  })

  it('holds chords: each finger keeps its own key down', () => {
    const { piano, advance, notes, down } = setup()
    piano.press('p1', 'C4')
    piano.press('p2', 'E4')
    piano.press('kKeyG', 'G4')
    expect(down()).toEqual(['C4', 'E4', 'G4'])
    advance(200)
    piano.release('p2')
    expect(down()).toEqual(['C4', 'G4'])
    expect(notes).toEqual(['C4', 'E4', 'G4'])
  })

  it('keeps a quick tap down long enough to be seen', () => {
    const { piano, advance, down } = setup()
    piano.press('p1', 'A4')
    advance(10)
    piano.release('p1')
    expect(down()).toEqual(['A4'])
    advance(MIN_DOWN_MS - 11)
    expect(down()).toEqual(['A4'])
    advance(1)
    expect(down()).toEqual([])
  })

  it('slides from key to key, and a key held by two fingers waits for both', () => {
    const { piano, advance, notes, down } = setup()
    piano.press('p1', 'D4')
    advance(100)
    piano.press('p1', 'E4') // slid on
    advance(100)
    expect(down()).toEqual(['E4'])
    piano.press('p2', 'E4') // a second finger on the same key: no new note
    piano.release('p1')
    expect(down()).toEqual(['E4'])
    piano.release('p2')
    expect(down()).toEqual([])
    expect(notes).toEqual(['D4', 'E4'])
  })

  it('a key struck again while it springs back is struck anew, and stays down', () => {
    const { piano, advance, notes, down } = setup()
    piano.press('p1', 'F4')
    piano.release('p1') // lingers for MIN_DOWN_MS
    advance(50)
    piano.press('p2', 'F4')
    advance(MIN_DOWN_MS)
    expect(down()).toEqual(['F4'])
    expect(notes).toEqual(['F4', 'F4'])
    piano.releaseAll()
    advance(MIN_DOWN_MS)
    expect(down()).toEqual([])
  })
})
