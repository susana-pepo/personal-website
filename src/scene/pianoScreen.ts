/**
 * The piano computer's screen: a little pixel-art landscape (128x95) that answers the music.
 * Four landscapes, picked with the top knob, painted as layers by scripts/paint-landscapes.py
 * (public/media/piano/landscapes, with anchors in piano-landscapes.json). The reactions are drawn
 * here, between the layers, following one grammar (see pianoMusic.ts for where each note acts):
 *   strike   something native appears above its key, in the note's colour
 *   hold     it grows, and a long hold changes the light
 *   loop     each loop note sparks something small, in time (pianoEngine's beads)
 *   chord    two or more held notes: one scene-wide event
 *   black    a black key is a rare special
 *   release  a trace lingers, so playing enriches the scene
 * While a backing loop plays, the scene pulses on its kick and snare and takes on its chords'
 * colours. Opening it boots like an old machine (PIXEL JAM PIANO, PRESS A KEY) until the first
 * note; switching landscapes is a CRT channel flicker; a knob shows its readout in pixel letters.
 * With reduced motion, things appear and fade where they are.
 */
import art from './piano-landscapes.json'
import { backingEvents, beat, groove, heard, jamming, screenClock, voices, type Voice } from '../audio/pianoEngine'
import { KEYS_BY_PITCH, LANDSCAPES, LOOPS, NOTE_COLOURS, bandOf, colourOfPitchClass, isBlack, placeOf, type Band } from './pianoMusic'
import { FONT_HEIGHT, textPixels, textWidth } from './pixelFont'
import { TITLE_BG, paintTitle } from './pianoTitle'

export const SCREEN_W = 128
export const SCREEN_H = 95
const W = SCREEN_W
const H = SCREEN_H
type Rgb = [number, number, number]

const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb
const mix = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const ease = (v: number) => {
  const x = clamp01(v)
  return x * x * (3 - 2 * x)
}
const NOTE: Record<string, Rgb> = Object.fromEntries(Object.entries(NOTE_COLOURS).map(([k, v]) => [k, hex(v)]))
const noteRgb = (key: string) => NOTE[key] ?? NOTE.C4!
const WHITE: Rgb = [1, 1, 1]
const MOON = hex('#f2efd9')
const colOf = (key: string) => W * placeOf(key)

interface Anchors {
  layers: string[]
  horizon: number
  lake_top?: number
  moon?: { x: number; y: number; r: number }
  cabin_window?: number[][]
  chimney?: number[]
  middle_dune_tops?: number[]
  far_dune_tops?: number[]
  sun?: { x: number; y: number; r: number }
  near_dune_tops?: number[]
  lamp?: { x: number; y: number }
}
const ANCHORS = art as unknown as Record<string, Anchors>
const anchor = (id: string) => ANCHORS[id]!

/** A scene: what each musical event does in it, and how it draws. */
interface Scene {
  strike(vc: Voice, band: Band): void
  special(vc: Voice): void
  spark(vc: Voice, colour: Rgb): void
  release(vc: Voice): void
  /** A drum hit of the backing loop (heard in its sound). */
  hit(kind: Drum, t: number): void
  /** A phrase just ended (a pause after a few notes): the landscape answers, near where it was drawn. */
  answer(at: { x: number; y: number; col: Rgb }, t: number): void
  /** A new bar of the loop: something in the landscape moves with it. */
  bar(t: number): void
  /** Its own colour for the life that rises as the playing gets busier (fireflies, snow glints...). */
  accent: Rgb
  /** A phrase has ended: the landscape's air moves (a breeze over the lake, a gust...). */
  settle(points: readonly PhrasePoint[], t: number): void
  draw(t: number, dt: number, held: Voice[]): void
}
/** How a note sits in the music: one of the chord's notes, another note of the key, a blue note, or outside. */
type Tier = 'chord' | 'key' | 'blue' | 'outside'
/** A note of the phrase being played: when, how high (y: high notes high, 6-32; step: 0-12 up the keys), its colour and its tier. */
type PhrasePoint = { t: number; y: number; col: Rgb; tier: Tier; step: number }
type Drum = 'kick' | 'snare' | 'hat'

type Readout = 'landscape' | 'loop' | 'loopVolume' | 'keysVolume' | 'loopState'
export interface PianoScreen {
  start(): void
  stop(): void
  setLandscape(index: number): void
  /** Show a readout for a moment: a choice (its name, and a dot for each option) or a volume (a bar). */
  readout(kind: Readout, value: number): void
}

export function createPianoScreen(canvas: HTMLCanvasElement, reduce: boolean): PianoScreen {
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!
  const img = g.createImageData(W, H)
  const px = new Float32Array(W * H * 3)
  const get = (i: number) => px[i] ?? 0

  // ── drawing helpers ──
  function put(x: number, y: number, c: Rgb, a = 1) {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (!(a > 0) || xi < 0 || yi < 0 || xi >= W || yi >= H) return
    const i = (yi * W + xi) * 3
    const k = Math.min(1, a)
    px[i] = get(i) + (c[0] - get(i)) * k
    px[i + 1] = get(i + 1) + (c[1] - get(i + 1)) * k
    px[i + 2] = get(i + 2) + (c[2] - get(i + 2)) * k
  }
  const plus = (x: number, y: number, c: Rgb, a: number) => {
    put(x, y, c, a)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(x + dx, y + dy, c, a * 0.4)
  }
  function flare(x: number, y: number, c: Rgb, a: number, size0: number) {
    const size = size0 + 1 // (a little bolder: the screen is small)
    put(x, y, WHITE, a * 0.8)
    for (let r = 1; r <= size; r++) {
      const k = a * (1 - r / (size + 1))
      put(x + r, y, c, k)
      put(x - r, y, c, k)
      put(x, y + r, c, k)
      put(x, y - r, c, k)
    }
  }
  /** Light falling on the picture: it adds, and catches what is already lit more than the dark (so it reads as light, not paint). */
  function light(x: number, y: number, c: Rgb, k: number) {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (!(k > 0.002) || xi < 0 || yi < 0 || xi >= W || yi >= H) return
    const i = (yi * W + xi) * 3
    const q = k * (0.45 + 0.9 * (0.3 * get(i) + 0.59 * get(i + 1) + 0.11 * get(i + 2)))
    px[i] = Math.min(1, get(i) + c[0] * q)
    px[i + 1] = Math.min(1, get(i + 1) + c[1] * q)
    px[i + 2] = Math.min(1, get(i + 2) + c[2] * q)
  }
  function line(x0: number, y0: number, x1: number, y1: number, c: Rgb, a: number) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0
    for (let i = 0; i <= n; i += 2) put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, a)
  }
  function sprite(rows: string[], x: number, y: number, c: Rgb, a = 1) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && put(x + i - (row.length >> 1), y + j, c, a)))
  }
  /** A line of pixel text; `scale` makes each of its pixels bigger, `colour(row)` may vary by row. */
  function text(str: string, x0: number, y0: number, c: Rgb, a: number, scale = 1, colour?: (row: number) => Rgb) {
    for (const [x, y] of textPixels(str)) {
      const cc = colour ? colour(y) : c
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) put(x0 + x * scale + dx, y0 + y * scale + dy, cc, a)
    }
  }
  const centred = (str: string, scale = 1) => Math.round((W - textWidth(str) * scale) / 2)
  const starField = (n: number, maxY: number) => Array.from({ length: n }, () => ({ x: Math.round(rnd(0, W)), y: Math.round(rnd(1, maxY)), tw: rnd(0, 6.3), s: rnd(0.15, 0.45) }))
  function starDust(field: ReturnType<typeof starField>, t: number, k: number) {
    const sn = reduce ? 0 : Math.exp(-Math.max(0, t - snareAt) / 0.18) // (the snare makes them flicker)
    for (const d of field) put(d.x, d.y, MOON, d.s * k * (reduce ? 1 : 0.6 + 0.4 * Math.sin(amb * 1.7 + d.tw)) * (1 + sn * (0.5 + 0.5 * Math.sin(d.tw * 7))) * (1 - Math.max(dawn, daybreak) * 0.8))
  }

  // ── the painted layers, decoded once ──
  const layers: Record<string, Record<string, Uint8ClampedArray>> = {}
  async function loadLandscape(id: string) {
    if (layers[id]) return
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const x = c.getContext('2d', { willReadFrequently: true })!
    const out: Record<string, Uint8ClampedArray> = {}
    for (const file of anchor(id).layers) {
      const im = new Image()
      im.src = `/media/piano/landscapes/${id}/${file}`
      await im.decode()
      x.clearRect(0, 0, W, H)
      x.drawImage(im, 0, 0)
      out[file.replace(/^\d+-|\.png$/g, '')] = x.getImageData(0, 0, W, H).data
    }
    layers[id] = out
  }
  /** Lays a painted layer into the screen; `dx` slides it sideways, wrapping round (for drifting mist and wisps). */
  function blit(id: string, name: string, dy = 0, tintC: Rgb | null = null, tintK = 0, dx = 0) {
    const d = layers[id]?.[name]
    if (!d) return
    const shift = ((Math.round(dx) % W) + W) % W
    for (let y = 0; y < H; y++) {
      const ty = y + dy
      if (ty < 0 || ty >= H) continue
      for (let x = 0; x < W; x++) {
        const i = (y * W + ((x - shift + W) % W)) * 4
        const a = d[i + 3] ?? 0
        if (!a) continue
        let r = (d[i] ?? 0) / 255
        let gg = (d[i + 1] ?? 0) / 255
        let b = (d[i + 2] ?? 0) / 255
        if (tintC && tintK > 0) {
          r += (tintC[0] - r) * tintK
          gg += (tintC[1] - gg) * tintK
          b += (tintC[2] - b) * tintK
        }
        const j = (ty * W + x) * 3
        const k = a / 255
        px[j] = get(j) + (r - get(j)) * k
        px[j + 1] = get(j + 1) + (gg - get(j + 1)) * k
        px[j + 2] = get(j + 2) + (b - get(j + 2)) * k
      }
    }
  }
  /** Light from something glowing falls on a painted layer around it (only where that layer is). */
  function lightUp(id: string, name: string, cx: number, cy: number, r: number, c: Rgb, a: number) {
    const d = layers[id]?.[name]
    if (!d || a < 0.01) return
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, cy + r); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, cx + r); x++) {
        if (!d[(y * W + x) * 4 + 3]) continue
        const q = 1 - Math.hypot(x - cx, (y - cy) * 1.3) / r
        if (q <= 0) continue
        const i = (y * W + x) * 3
        const k = q * q * a * 0.5
        px[i] = Math.min(1, get(i) + c[0] * k)
        px[i + 1] = Math.min(1, get(i + 1) + c[1] * k)
        px[i + 2] = Math.min(1, get(i + 2) + c[2] * k)
      }
  }
  function reflect(top: number, _t: number, stir: number, k0 = 0.42) {
    for (let y = top; y < H; y++) {
      const depth = (y - top) / (H - top)
      const src = top - 1 - Math.floor((y - top) * 1.15)
      for (let x = 0; x < W; x++) {
        const off = reduce ? 0 : Math.round(Math.sin(y * 0.9 + amb * 2.2 + x * 0.05) * ((0.6 + depth * 1.4) * (0.3 + 0.7 * life) + stir * 0.8))
        const j = (Math.max(0, src) * W + Math.max(0, Math.min(W - 1, x + off))) * 3
        const i = (y * W + x) * 3
        const k = k0 - depth * 0.22
        px[i] = get(i) + get(j) * k
        px[i + 1] = get(i + 1) + get(j + 1) * k
        px[i + 2] = get(i + 2) + get(j + 2) * k
      }
    }
  }

  // ── shared reactions ──
  let dawn = 0
  let tint: Rgb = [0, 0, 0]
  // the backing loop: its last kick and snare, and its chord's colour
  let kickAt = -9
  let snareAt = -9
  let chord: Rgb | null = null
  const kickK = (t: number) => (reduce ? 0 : Math.exp(-Math.max(0, t - kickAt) / 0.16))
  /** A chord change: its colour sweeps down the sky. */
  let sweep: { t0: number; col: Rgb } | null = null
  /**
   * What the screen hears and how the playing goes, for every landscape: the loop's bass, middle
   * and top (heard live, 0-1), how loud the keys are, how busy the playing is (notes in the last few
   * seconds), and how much a jam has built up (it grows with every note, and fades after a quiet).
   */
  const E = { bass: 0, mid: 0, high: 0, density: 0, build: 0 }
  /**
   * How alive the landscape is: about 0 at rest (a still picture, barely breathing), 1 while the
   * music plays (the loop, or your playing). The scenery's own motion (clouds, mist, water, snow,
   * sand, the lighthouse...) runs on its own clock, `amb`, which crawls at rest and runs at full
   * speed with the music; the life that comes and goes (fireflies, fish, gulls, shooting stars...)
   * comes only with the music.
   */
  let life = 0
  let amb = 0
  const pace = () => 0.08 + 0.92 * life
  /**
   * The air your phrases stir, in every landscape: how much (0-1; it gathers as a phrase goes on and
   * settles slowly after it) and the colour your notes lend it. Each landscape breathes it its own
   * way: moonlit mist on the lake, the aurora and alpenglow on the peaks, haze and a warmer sunset on
   * the dunes, a glowing sea; and when the phrase ends its air moves (scene.settle).
   */
  let air = 0
  let airCol: Rgb = MOON
  const recent: number[] = [] // when the last notes were struck
  /** A note's colour in a phrase, by how it sits in the music: a blue note cooler, an outside note dimmer, another note of the key leaning to the chord. */
  const BLUE: Rgb = hex('#9ec8ff')
  const tierColour = (p: PhrasePoint): Rgb =>
    p.tier === 'blue' ? mix(p.col, BLUE, 0.4) : p.tier === 'outside' ? mix(p.col, [0.45, 0.42, 0.5], 0.5) : p.tier === 'key' && chord ? mix(p.col, chord, 0.25) : p.col
  /** A long jam slowly brings first light (0: night, up to 0.9). */
  let daybreak = 0
  const DAWN_LOW = hex('#f3a07a')
  const DAWN_HIGH = hex('#6f5f9e')
  /** The shared sky: daybreak's warm band, a chord's colour sweeping down, and the kick's glow on the horizon. */
  function skyLife(t: number, HZ: number, k = 1) {
    if (daybreak > 0.01)
      for (let y = 0; y < HZ; y++) {
        const q = (y / HZ) ** 2
        const c = mix(DAWN_HIGH, DAWN_LOW, q)
        for (let x = 0; x < W; x++) put(x, y, c, daybreak * 0.45 * k * (0.2 + 0.8 * q))
      }
    if (sweep) {
      const s = (t - sweep.t0) / 1.8
      if (s > 1) sweep = null
      else if (s > 0) {
        const front = s * HZ * 1.4
        for (let y = 0; y < HZ; y++) {
          const d = front - y
          if (d <= 0 || d > 16) continue
          const a = 0.2 * k * (1 - d / 16) * (1 - s * 0.6)
          for (let x = 0; x < W; x++) put(x, y, sweep.col, a)
        }
      }
    }
    const kk = kickK(t)
    if (kk > 0.02)
      for (let y = Math.max(0, HZ - 12); y < HZ; y++) for (let x = 0; x < W; x++) put(x, y, chord ?? tint, kk * 0.13 * k * (1 - (HZ - y) / 12))
  }
  const amp = (vc: Voice, t: number) => {
    // a note's things arrive with it: in at once (70 ms), brightest at the strike, then settling
    const since = Math.max(0, t - vc.start)
    const att = ease(since / 0.07) * (1 + (reduce ? 0 : 0.5 * Math.exp(-since / 0.3)))
    return vc.released !== null && t > vc.released ? att * Math.exp(-(t - vc.released) / vc.tau) : att
  }
  const heldFor = (vc: Voice, t: number) => Math.min(t, vc.released ?? t) - vc.start
  const alive = (vc: Voice, t: number) => !vc.gone && !(vc.released !== null && t > vc.released && amp(vc, t) < 0.01)
  const meteors: { x: number; y: number; t0: number; col: Rgb; dx: number; dy: number }[] = []
  const meteor = (col: Rgb) => !reduce && meteors.push({ x: rnd(W * 0.4, W + 10), y: rnd(-4, 8), t0: screenClock(), col, dx: -rnd(55, 80), dy: rnd(22, 34) })
  function drawMeteors(t: number) {
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i]!
      const k = (t - m.t0) / 0.9
      if (k > 1) {
        meteors.splice(i, 1)
        continue
      }
      for (let j = 0; j < 9; j++) {
        const q = Math.max(0, k - j * 0.018)
        put(m.x + m.dx * q, m.y + m.dy * q, m.col, (1 - j / 9) * (1 - k * 0.6))
      }
    }
  }
  type Kept = { x: number; y: number; ty?: number; col: Rgb; t0: number; life: number; tw: number }
  function keptStars(list: Kept[], t: number, dt: number) {
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]!
      const k = t - s.t0
      if (k > s.life) {
        list.splice(i, 1)
        continue
      }
      if (s.ty !== undefined) s.y += (s.ty - s.y) * Math.min(1, dt * 1.5)
      const a = Math.min(1, (s.life - k) / 4) * (reduce ? 1 : 0.65 + 0.35 * Math.sin(t * 2.3 + s.tw)) * (1 + 0.6 * Math.exp(-(t - pulse()) / 0.25))
      if (k > 1) plus(s.x, s.y, s.col, a)
      else put(s.x, s.y, s.col, a)
    }
  }
  type Particle = { x: number; y: number; t0: number; col: Rgb; life: number; vx?: number; vy?: number }
  function particles(list: Particle[], t: number, dt: number, draw: (p: Particle, k: number) => void) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]!
      const k = (t - p.t0) / p.life
      if (k > 1) {
        list.splice(i, 1)
        continue
      }
      if (p.vx !== undefined) p.x += p.vx * dt
      if (p.vy !== undefined) p.y += p.vy * dt
      draw(p, k)
    }
  }
  const sinWave = (k: number) => Math.sin(Math.PI * k)

  // ── Lake. Your notes: lanterns rise from the water (low), lighting the pines and the shore and
  // drawing their light across the lake; moonlit clouds (middle); stars (high). A chord joins them
  // into a constellation, a long hold rings the moon, black keys send shooting stars, lanterns let go
  // rise and become stars. Your phrases: the mist over the water glows, the moon's halo and its path
  // brighten, in your notes' colours; when a phrase ends a breeze runs shimmering across the lake,
  // and a heron answers it, gliding low over the water. With the music, fireflies come out and a
  // fish jumps now and then. With a loop: the kick rings the water, the snare stirs the fireflies,
  // the hats glint. ──
  function lake(): Scene {
    const A = anchor('lake')
    const HZ = A.horizon
    const moon = A.moon!
    const CLOUD = hex('#2d2950')
    const FLY = hex('#e8f0a0')
    const field = starField(18, 40)
    const flies = Array.from({ length: 6 }, () => ({ x: rnd(36, W - 4), y: rnd(52, 61), ph: rnd(0, 6.3), sp: rnd(0.3, 0.8) }))
    const lanterns = new Map<Voice, { x: number; y: number; dy: number; col: Rgb; top: number }>()
    const clouds = new Map<Voice, { x: number; y: number; col: Rgb; puffs: { dx: number; dy: number; r: number }[]; scale: number; drift: number; leaving: number }>()
    const stars = new Map<Voice, { x: number; y: number; col: Rgb; tw: number }>()
    const kept: Kept[] = []
    const sparks: Particle[] = []
    const ripples: { x: number; t0: number; col: Rgb; size?: number }[] = []
    const glints: Particle[] = []
    const herons: { t0: number; dir: number; y: number; col: Rgb }[] = []
    let breeze: { t0: number; col: Rgb } | null = null
    const fish: { x: number; t0: number }[] = []
    const FISH = hex('#dff4ff') // (a moonlit silver, much brighter than the water)
    let nextFish = screenClock() + rnd(5, 10)
    const drifters = Array.from({ length: 2 }, (_, i) => ({ x: rnd(0, W), y: 26 + i * 9, sp: rnd(0.6, 1.2), puffs: [] as { dx: number; dy: number; r: number }[] }))
    const HERON = hex('#191628')
    let chordK = 0
    const puffs = () => {
      const n = Math.round(rnd(4, 7))
      return Array.from({ length: n }, (_, i) => ({ dx: (i - n / 2) * rnd(2.5, 4), dy: rnd(-1.5, 1.5), r: rnd(2.5, 4.5) }))
    }
    for (const d of drifters) d.puffs = puffs()
    const WATER = A.lake_top ?? HZ + 1
    return {
      strike(vc, band) {
        const x = colOf(vc.key)
        const col = noteRgb(vc.key)
        if (band === 'low') {
          lanterns.set(vc, { x, y: HZ + 2, dy: HZ + 2, col, top: rnd(32, 48) })
          ripples.push({ x, t0: screenClock(), col })
        } else if (band === 'mid') {
          clouds.set(vc, { x: x + rnd(-6, 6), y: rnd(22, 36), col, puffs: puffs(), scale: reduce ? 0.75 : 1.1, drift: rnd(0.4, 1.1) * (Math.random() < 0.5 ? -1 : 1), leaving: 0 })
        } else stars.set(vc, { x: x + rnd(-4, 4), y: rnd(4, 20), col, tw: rnd(0, 6.3) })
      },
      special: (vc) => meteor(noteRgb(vc.key)),
      spark(vc, col) {
        const at = lanterns.get(vc) ?? stars.get(vc) ?? clouds.get(vc)
        if (at) sparks.push({ x: at.x + rnd(-12, 12), y: at.y + rnd(-10, 4), t0: screenClock(), col, life: rnd(1.4, 2.6) })
      },
      release(vc) {
        const L = lanterns.get(vc)
        if (L) {
          kept.push({ x: L.x, y: L.dy, ty: rnd(4, 30), col: L.col, t0: screenClock(), life: rnd(18, 28), tw: rnd(0, 6.3) })
          lanterns.delete(vc)
        }
        const S = stars.get(vc)
        if (S) {
          kept.push({ x: S.x, y: S.y, col: S.col, t0: screenClock(), life: rnd(16, 24), tw: S.tw })
          stars.delete(vc)
        }
        const C = clouds.get(vc)
        if (C) C.leaving = screenClock()
      },
      settle(_pts, t) {
        // a breeze runs across the lake
        if (!reduce) breeze = { t0: t, col: airCol }
      },
      accent: hex('#e8f0a0'),
      answer(at, t) {
        // the lake answers a phrase: a heron glides low over the water, a thread of your last note's colour behind it
        if (reduce) return
        herons.push({ t0: t, dir: at.x < W / 2 ? 1 : -1, y: rnd(44, 54), col: at.col })
      },
      bar(t) {
        ripples.push({ x: rnd(20, W - 20), t0: t, col: chord ?? MOON, size: 0.35 + E.bass * 0.4 })
      },
      hit(kind, t) {
        if (kind === 'kick') ripples.push({ x: rnd(16, W - 16), t0: t, col: chord ?? MOON, size: 0.5 })
        else if (kind === 'snare') for (const f of flies) sparks.push({ x: f.x + rnd(-3, 3), y: f.y + rnd(-3, 1), t0: t, col: FLY, life: rnd(0.5, 0.9) })
        else if (Math.random() < 0.6) glints.push({ x: rnd(4, W - 4), y: rnd(WATER + 2, H - 4), t0: t, col: chord ? mix(MOON, chord, 0.5) : MOON, life: 0.35 })
      },
      draw(t, dt, held) {
        const longest = held.reduce((m, v) => Math.max(m, heldFor(v, t)), 0)
        chordK += ((held.length >= 2 ? 1 : 0) - chordK) * Math.min(1, dt * 2)
        blit('lake', 'sky', 0, tint, dawn * 0.5)
        skyLife(t, HZ)
        blit('lake', 'stars')
        starDust(field, t, 0.5)
        blit('lake', 'moon')
        // your playing lights a halo round the moon, in your notes' colours
        if (air > 0.01) {
          const hc = mix(MOON, airCol, 0.45)
          const R1 = moon.r + 10 + 5 * air
          for (let y = -Math.ceil(R1); y <= R1; y++)
            for (let x = -Math.ceil(R1); x <= R1; x++) {
              const d = Math.hypot(x, y)
              if (d > moon.r && d < R1) put(moon.x + x, moon.y + y, hc, air * 0.3 * (1 - (d - moon.r) / (R1 - moon.r)) ** 1.4)
            }
        }
        // the moon breathes with the kick
        const mk = kickK(t)
        if (mk > 0.02) for (let y = -moon.r - 3; y <= moon.r + 3; y++) for (let x = -moon.r - 3; x <= moon.r + 3; x++) if (Math.abs(Math.hypot(x, y) - moon.r - 1.5) < 1.2) put(moon.x + x, moon.y + y, MOON, mk * 0.3)
        // clouds drifting by on their own, faint
        for (const d of drifters) {
          if (!reduce) d.x += d.sp * dt * pace()
          if (d.x > W + 20) d.x = -20
          for (const p of d.puffs)
            for (let y = -Math.ceil(p.r); y <= p.r; y++) for (let x = -Math.ceil(p.r); x <= p.r; x++) if (x * x + y * y <= p.r * p.r) put(d.x + p.dx + x, d.y + p.dy + y, CLOUD, 0.28 * (1 - daybreak * 0.5))
        }
        const halo = ease((longest - 3) / 3)
        if (halo > 0) {
          for (let y = -moon.r - 10; y <= moon.r + 10; y++)
            for (let x = -moon.r - 10; x <= moon.r + 10; x++) if (Math.abs(Math.hypot(x, y) - (moon.r + 8)) < 0.7) put(moon.x + x, moon.y + y, tint, halo * 0.35)
        }
        for (const [vc, c] of clouds) {
          const leaving = c.leaving ? t - c.leaving : 0
          if (leaving > 9 || (vc.gone && !c.leaving)) {
            clouds.delete(vc)
            continue
          }
          if (!reduce) c.x += c.drift * dt * (1 + leaving * 2)
          c.scale += ((c.leaving ? 1 : 0.75 + 0.35 * ease(heldFor(vc, t) / 3)) - c.scale) * Math.min(1, dt * 3)
          const a = Math.min(1, 1 - leaving / 9) * (c.leaving ? 1 : ease((t - vc.start) / 0.12))
          const light = [Math.sign(moon.x - c.x) || 1, Math.sign(moon.y - c.y) || -1] as const
          for (const p of c.puffs) {
            const cx = c.x + p.dx * c.scale
            const cy = c.y + p.dy * c.scale
            const r = p.r * c.scale
            for (let y = -Math.ceil(r); y <= r; y++)
              for (let x = -Math.ceil(r); x <= r; x++) {
                if (x * x + y * y > r * r) continue
                const lit = clamp01(((x * light[0] + y * light[1]) / r) * 0.8 + 0.2)
                put(cx + x, cy + y, mix(CLOUD, mix(c.col, MOON, 0.35), 0.25 + 0.5 * lit), a * (0.55 + 0.35 * lit))
              }
          }
        }
        keptStars(kept, t, dt)
        for (const [vc, s] of stars) flare(s.x, s.y, s.col, amp(vc, t), 1 + Math.round(ease(heldFor(vc, t) / 2.5) * 2 + (reduce ? 0 : 0.5 + 0.5 * Math.sin(t * 3 + s.tw))))
        drawMeteors(t)
        blit('lake', 'far-mountains')
        blit('lake', 'forest-hills')
        blit('lake', 'pines')
        for (const [vc, L] of lanterns) lightUp('lake', 'pines', L.x, L.dy, 12 + 6 * ease(heldFor(vc, t) / 4), L.col, amp(vc, t) * 0.8)
        // a heron gliding low over the water, a thread of the note's colour behind it
        for (let i = herons.length - 1; i >= 0; i--) {
          const h = herons[i]!
          const k = (t - h.t0) / 7
          if (k > 1) {
            herons.splice(i, 1)
            continue
          }
          const x = h.dir > 0 ? -12 + k * (W + 24) : W + 12 - k * (W + 24)
          const y = h.y + Math.sin(k * 9) * 1.5
          const up = Math.sin(t * 5) > 0
          sprite(up ? ['#.........#', '.##.....##.', '...#####...', '....###....'] : ['...........', '...........', '###########', '....###....'], x, y, HERON, 0.95)
          sprite(h.dir > 0 ? ['##', '.#'] : ['##', '#.'], x + h.dir * 6, y + 2, HERON, 0.95)
          for (let j = 1; j < 9; j++) put(x - h.dir * (4 + j * 2), y + 3 + Math.sin(k * 9 - j * 0.4) * 1.2, h.col, 0.5 * (1 - j / 9))
        }
        for (const [vc, L] of lanterns) {
          const a = amp(vc, t)
          L.y += (L.top - L.y) * Math.min(1, dt * 0.9)
          L.dy = L.y + (reduce ? 0 : Math.sin(t * 1.6 + vc.seed) * 1.2)
          const R0 = 3.4 + 2.5 * ease(heldFor(vc, t) / 4) // held, its glow widens
          for (let yy = -Math.ceil(R0); yy <= R0; yy++)
            for (let xx = -Math.ceil(R0); xx <= R0; xx++) {
              const d = Math.hypot(xx, yy)
              if (d > 1.2 && d < R0) put(L.x + xx, L.dy + yy, L.col, 0.16 * a * (R0 - d))
            }
          plus(L.x, L.dy, L.col, 0.95 * a)
          put(L.x, L.dy, WHITE, 0.5 * a)
        }
        if (chordK > 0.02) {
          const pts = [...[...lanterns.values()].map((l) => [l.x, l.dy, l.col] as const), ...[...stars.values()].map((s) => [s.x, s.y, s.col] as const)].sort((a, b) => a[0] - b[0])
          for (let i = 1; i < pts.length; i++) {
            const [ax, ay, ac] = pts[i - 1]!
            const [bx, by, bc] = pts[i]!
            line(ax, ay, bx, by, mix(ac, bc, 0.5), 0.35 * chordK * (reduce ? 1 : 0.7 + 0.3 * Math.sin(t * 2 + i)))
          }
        }
        particles(sparks, t, dt, (s, k) => put(s.x, s.y - k * 3, s.col, sinWave(k)))
        const flash = Math.exp(-(t - pulse()) / 0.3)
        if (!reduce && life > 0.01) for (const f of flies) put(f.x + Math.sin(amb * 0.4 + f.ph) * 3, f.y + Math.cos(amb * 0.3 + f.ph) * 1.5, FLY, life * Math.min(1, Math.max(0, Math.sin(amb * f.sp * 2 + f.ph)) * 0.7 + flash * 0.8)) // (fireflies come out with the music)
        let stir = 0
        for (const r of ripples) stir += Math.max(0, 1 - (t - r.t0) / 2)
        const bk = breeze ? (t - breeze.t0) / 2.6 : 2
        if (bk > 1) breeze = null
        const breezeK = bk <= 1 ? Math.sin(Math.PI * bk) : 0
        blit('lake', 'lake')
        reflect(WATER, t, stir + E.bass * 1.2 + breezeK * 1.4) // (the loop's bass and a breeze stir the water; 0 with reduced motion)
        // the moon's path glitters on the water, brighter and wider while you play
        const pathCol = mix(MOON, airCol, 0.3 * air)
        for (let y = WATER + 1; y < H; y++) {
          const depth = (y - WATER) / (H - WATER)
          const wide = depth * (5 + 4 * air)
          for (let x = Math.floor(moon.x - 1 - wide); x <= moon.x + 1 + wide; x++) if (reduce ? (x + y) % 3 === 0 : Math.sin(x * 2.3 + y * 1.1 + amb * 3) > 0.55) put(x, y, pathCol, (0.15 + 0.15 * life + 0.3 * air) * (1 - depth * 0.5))
        }
        // a breeze running across the lake when a phrase ends: a front of shimmer on the water
        if (breeze && breezeK > 0) {
          const front = -24 + bk * (W + 48)
          const col = mix(MOON, breeze.col, 0.4)
          for (let y = WATER + 1; y < H; y += 2) {
            const depth = (y - WATER) / (H - WATER)
            const lag = ((y * 7) % 11) * 1.6
            for (let j = 0; j < 12; j++) {
              const x = front - lag - j * 1.5
              if (Math.sin(x * 1.7 + y) > -0.2) put(x, y, col, (1 - j / 12) * 0.5 * breezeK * (1 - depth * 0.4))
            }
          }
        }
        // each lantern draws a line of its light across the water
        for (const [vc, L] of lanterns) {
          const a = amp(vc, t)
          for (let y = WATER + 1; y < H; y += 2) put(L.x + (reduce ? 0 : Math.round(Math.sin(y * 0.8 + t * 2.5))), y, L.col, a * 0.45 * (1 - (y - WATER) / (H - WATER)))
        }
        // now and then a fish jumps
        if (!reduce && life > 0.6 && t > nextFish) {
          fish.push({ x: rnd(14, W - 14), t0: t })
          nextFish = t + rnd(7, 14)
        }
        for (let i = fish.length - 1; i >= 0; i--) {
          const f = fish[i]!
          const k = (t - f.t0) / 0.9
          if (k > 1) {
            fish.splice(i, 1)
            ripples.push({ x: f.x + 6, t0: t, col: MOON, size: 0.4 })
            continue
          }
          // a silver fish, its nose along its arc, bright against the dark water
          const fx = f.x + k * 10
          const fy = WATER + 5 - Math.sin(Math.PI * k) * 10
          const vy = -Math.cos(Math.PI * k) * 10 * Math.PI
          const n = Math.hypot(10, vy)
          const ux = 10 / n
          const uy = vy / n
          for (let i = -2; i <= 2; i++) {
            put(fx + ux * i, fy + uy * i, i === 2 ? WHITE : FISH, 1)
            if (i > -2 && i < 2) put(fx + ux * i - uy, fy + uy * i + ux, FISH, 0.75) // (its belly)
          }
          put(fx + ux - uy * 0.5, fy + uy + ux * 0.5, WHITE, 0.9) // (a glint of moonlight on it)
          for (const side of [-1.5, 1.5]) put(fx - ux * 3 - uy * side, fy - uy * 3 + ux * side, FISH, 0.9) // (its tail)
          // a splash where it leaves the water, and where it falls back in
          for (const [at, sx] of [[0, f.x], [1, f.x + 10]] as const) {
            const s = Math.max(0, 1 - Math.abs(k - at) / 0.25)
            if (s > 0) for (const j of [-2, -1, 1, 2]) put(sx + j * 1.5, WATER + 4 - s * (3 - Math.abs(j)) * 1.5, WHITE, 0.8 * s)
          }
        }
        particles(glints, t, dt, (g, k) => plus(g.x, g.y, g.col, sinWave(k) * 0.8))
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i]!
          const k = (t - r.t0) / 2.2
          if (k > 1) {
            ripples.splice(i, 1)
            continue
          }
          const rx = 2 + k * 20 * (r.size ?? 1)
          for (let a = 0; a < 6.283; a += 0.12) put(r.x + Math.cos(a) * rx, HZ + 6 + Math.sin(a) * rx * 0.22, r.col, (1 - k) * 0.55)
        }
        blit('lake', 'shore')
        for (const [vc, L] of lanterns) lightUp('lake', 'shore', L.x, L.dy + 8, 16, L.col, amp(vc, t) * 0.6)
        blit('lake', 'mist', 0, null, 0, reduce ? 0 : amb * 0.7)
        // ...and the mist over the water glows with your playing
        if (air > 0.01) {
          const mc = mix(MOON, airCol, 0.5)
          for (let y = WATER - 7; y < WATER + 9; y++) {
            const band = 1 - Math.abs(y - WATER - 1) / 8
            if (band <= 0) continue
            for (let x = 0; x < W; x++) {
              const n = 0.5 + 0.5 * Math.sin(x * 0.11 + amb * 0.9 + y * 0.5) * Math.sin(x * 0.04 - amb * 0.5 + y * 0.3)
              put(x, y, mc, air * 0.22 * band * (0.35 + 0.65 * n))
            }
          }
        }
      },
    }
  }

  // ── Peaks. Your notes: the cabin's window lights, its light falls on the snow and its chimney
  // smokes (low); aurora curtains (middle), spreading the longer they're held; diamond-dust stars
  // (high). A chord brings alpenglow to the snowcaps, loop notes glint in the falling snow, black
  // keys send shooting stars over the ridge. Your phrases: the sky's own aurora brightens and takes
  // your notes' colours, alpenglow warms the snowcaps, the snow falls thicker; when a phrase ends a
  // wave of light runs along the aurora and a gust blows the snow, and a fox answers it, trotting
  // across the snowfield. With the music the aurora sways, the snow falls, the chimney smokes. With
  // a loop: the kick lights the aurora and the snowcaps, the snare sends a gust through the snow. ──
  function peaks(): Scene {
    const A = anchor('peaks')
    const HZ = A.horizon
    const SNOW = hex('#dfe7f3')
    const SMOKE = hex('#9aa6b8')
    const field = starField(20, 34)
    const flakes = Array.from({ length: 55 }, () => ({ x: rnd(0, W), y: rnd(0, H), s: rnd(4, 9), ph: rnd(0, 6.3) }))
    const curtains = new Map<Voice, { x: number; col: Rgb; w: number; ph: number }>()
    const lamps = new Map<Voice, Rgb>()
    const dust = new Map<Voice, { x: number; y: number; col: Rgb }>()
    const glints: Particle[] = []
    const puffs: Particle[] = []
    const smoke: Particle[] = []
    const foxes: { t0: number; dir: number; col: Rgb; y: number }[] = []
    const tracks: Particle[] = []
    let gust = 0
    let wave: number | null = null // (when a wave of light set off along the aurora)
    const AURORA = hex('#5fe0a0')
    const FOX = hex('#d9824a')
    let glow = 0
    return {
      strike(vc, band) {
        const x = colOf(vc.key)
        const col = noteRgb(vc.key)
        if (band === 'low') {
          lamps.set(vc, col)
          for (let i = 0; i < 14; i++) puffs.push({ x: x + rnd(-3, 3), y: HZ + rnd(4, 10), vx: rnd(-6, 6), vy: rnd(-9, -3), t0: screenClock(), life: rnd(0.8, 1.6), col: SNOW })
        } else if (band === 'mid') curtains.set(vc, { x, col, w: rnd(14, 24), ph: rnd(0, 6.3) })
        else dust.set(vc, { x: x + rnd(-4, 4), y: rnd(4, 16), col })
      },
      special: (vc) => meteor(noteRgb(vc.key)),
      spark: (_vc, col) => void glints.push({ x: rnd(4, W - 4), y: rnd(10, HZ), t0: screenClock(), col, life: rnd(1.5, 2.5) }),
      release() {},
      settle(_pts, t) {
        // a wave of light runs along the aurora, and a gust blows the snow
        if (reduce) return
        wave = t
        gust = Math.max(gust, 0.8)
      },
      accent: hex('#dfe7f3'),
      answer(at, t) {
        if (reduce) return
        foxes.push({ t0: t, dir: at.x < W / 2 ? 1 : -1, col: at.col, y: rnd(84, 90) })
      },
      bar() {
        gust = Math.max(gust, 0.45)
      },
      hit(kind, t) {
        if (kind === 'snare') gust = 1
        else if (kind === 'hat' && Math.random() < 0.6) glints.push({ x: rnd(4, W - 4), y: rnd(4, HZ), t0: t, col: chord ? mix(SNOW, chord, 0.4) : SNOW, life: 0.4 })
      },
      draw(t, dt, held) {
        glow += ((held.length >= 2 ? 1 : 0) - glow) * Math.min(1, dt * 0.8)
        gust *= Math.exp(-dt / 0.5)
        blit('peaks', 'sky', 0, tint, dawn * 0.35)
        skyLife(t, HZ)
        blit('peaks', 'stars')
        starDust(field, t, 0.5)
        // a faint aurora, always breathing; the kick lights it up
        // (your playing brightens it and lends it your notes' colours; a phrase ending sends a wave of light along it)
        const ac = mix(chord ? mix(AURORA, chord, 0.5) : AURORA, airCol, 0.55 * air)
        const breathe = (reduce ? 0.1 : 0.05 + 0.04 * life + 0.04 * life * Math.sin(amb * 0.5)) + kickK(t) * 0.22 + E.mid * 0.16 + air * 0.24 // (it breathes with the loop)
        const wk = wave === null ? 2 : (t - wave) / 2.2
        if (wk > 1) wave = null
        const front = -20 + wk * (W + 40)
        for (let x = 0; x < W; x++) {
          const top = 8 + 5 * Math.sin(x * 0.06 + amb * (reduce ? 0 : 0.25)) - 3 * air
          const bot = top + 14 + 6 * air + 4 * Math.sin(x * 0.09 - amb * (reduce ? 0 : 0.3))
          const shim = reduce ? 1 : 0.6 + 0.4 * Math.sin(x * 0.9 + amb * 1.8)
          const lift = wave === null ? 0 : 0.35 * Math.exp(-(((x - front) / 9) ** 2)) * (1 - wk)
          for (let y = Math.ceil(top); y < bot; y++) put(x, y, ac, (breathe * shim + lift) * ((y - top) / (bot - top)) ** 1.5)
          if (lift > 0.02) put(x, top, mix(ac, WHITE, 0.4), lift * 1.4)
        }
        for (const [vc, s] of dust) {
          if (!alive(vc, t)) dust.delete(vc)
          else flare(s.x, s.y, s.col, amp(vc, t), 1 + Math.round(ease(heldFor(vc, t) / 2) * 2))
        }
        for (const [vc, c] of curtains) {
          if (!alive(vc, t)) {
            curtains.delete(vc)
            continue
          }
          const a = amp(vc, t)
          const spread = 0.6 + 1.1 * ease(heldFor(vc, t) / 5) // held, the curtain keeps spreading
          for (let x = Math.floor(c.x - c.w * spread); x <= c.x + c.w * spread; x++) {
            const edge = 1 - Math.abs(x - c.x) / (c.w * spread)
            if (edge <= 0) continue
            const top = 5 + 5 * Math.sin(x * 0.17 + t * (reduce ? 0 : 0.6) + c.ph)
            const bot = 34 + 6 * Math.sin(x * 0.11 - t * (reduce ? 0 : 0.4) + c.ph)
            const shim = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(x * 1.3 + t * 2.6 + c.ph)
            for (let y = Math.ceil(top); y < bot; y++) put(x, y, c.col, a * edge * shim * 0.5 * Math.pow(Math.max(0, (y - top) / (bot - top)), 1.6))
          }
        }
        drawMeteors(t)
        blit('peaks', 'far-peaks')
        blit('peaks', 'near-ridge')
        blit('peaks', 'snowcaps', 0, mix(mix(hex('#f4b8a8'), chord ?? tint, 0.4), airCol, 0.4 * air), Math.min(0.85, glow * 0.6 + kickK(t) * 0.3 + daybreak * 0.4 + air * 0.4)) // (alpenglow: a chord, the kick, a long jam, your phrases)
        blit('peaks', 'snowy-pines')
        blit('peaks', 'snowfield', 0, tint, dawn * 0.12)
        for (const [vc, c] of curtains) {
          const a = amp(vc, t)
          for (let x = Math.floor(c.x - c.w); x <= c.x + c.w; x++) for (let y = HZ + 2; y < H; y++) put(x, y, c.col, a * 0.1 * Math.max(0, 1 - Math.abs(x - c.x) / c.w))
        }
        blit('peaks', 'cabin')
        let lampA = 0
        let lampC = hex('#f2c070')
        for (const [vc, col] of lamps) {
          if (!alive(vc, t)) {
            lamps.delete(vc)
            continue
          }
          const a = amp(vc, t)
          if (a > lampA) {
            lampA = a
            lampC = col
          }
          if (vc.released === null && Math.random() < dt * 3 && !reduce && A.chimney) smoke.push({ x: A.chimney[0]!, y: A.chimney[1]! - 1, t0: t, life: 3, col: SMOKE })
        }
        // someone's home: a thin thread of smoke, always
        if (!reduce && A.chimney && Math.random() < dt * 0.8 * life) smoke.push({ x: A.chimney[0]!, y: A.chimney[1]! - 1, t0: t, life: 3, col: SMOKE })
        const win = A.cabin_window ?? []
        for (const [x, y] of win) put(x!, y!, mix(hex('#3d2f2a'), lampC, 0.25 + 0.75 * lampA), 1)
        const [wx = 0, wy = 0] = win[0] ?? []
        if (lampA > 0.05) for (let y = wy + 4; y < wy + 10; y++) for (let x = wx - 3; x <= wx + 4; x++) put(x, y, lampC, lampA * 0.16 * (1 - (y - wy - 4) / 6))
        lightUp('peaks', 'snowfield', wx, wy + 8, 26, lampC, lampA * 0.7)
        // a fox trotting across the snow, leaving tracks that fill in again
        particles(tracks, t, dt, (p, k) => put(p.x, p.y, hex('#8f9cb4'), 0.5 * (1 - k)))
        for (let i = foxes.length - 1; i >= 0; i--) {
          const f = foxes[i]!
          const k = (t - f.t0) / 8
          if (k > 1) {
            foxes.splice(i, 1)
            continue
          }
          const x = f.dir > 0 ? -8 + k * (W + 16) : W + 8 - k * (W + 16)
          const step = Math.floor(t * 8) % 2
          const body = f.dir > 0 ? ['.....#.#', '#.#####.', '.#####..', step ? '.#...#..' : '..#.#...'] : ['#.#.....', '.#####.#', '..#####.', step ? '..#...#.' : '...#.#..']
          sprite(body, x, f.y - 4, FOX, 1)
          put(x + f.dir * 3, f.y - 4, f.col, 0.9) // the note's colour, on its ear
          if (Math.random() < dt * 6) tracks.push({ x: x + rnd(-2, 2), y: f.y, t0: t, col: SNOW, life: 6 })
        }
        particles(smoke, t, dt, (s, k) => put(s.x + Math.sin(k * 5) * 2 + k * 4, s.y - k * 14, s.col, (1 - k) * 0.6))
        particles(puffs, t, dt, (p, k) => {
          p.vy = (p.vy ?? 0) + dt * 10
          put(p.x, p.y, p.col, (1 - k) * 0.9)
        })
        for (const f of flakes) {
          if (!reduce) {
            f.y += dt * f.s * (pace() + gust + air * 0.6) // (the snow hangs almost still at rest, and falls with the music, thicker as you play)
            f.x += Math.sin(amb + f.ph) * dt * 2 * pace() + gust * dt * 34
            if (f.x > W) f.x -= W
            if (f.y > H) {
              f.y = -1
              f.x = rnd(0, W)
            }
          }
          put(f.x, f.y, SNOW, 0.5 + 0.35 * air)
        }
        particles(glints, t, dt, (s, k) => plus(s.x, s.y + k * 10, s.col, sinWave(k)))
      },
    }
  }

  // ── Dunes. Your notes: flowers grow on the near dune and glow on the sand (low), taller the longer
  // they're held; ribbons of glowing sand lift off the crests (middle); the first evening stars
  // (high) while a long hold lowers the sun. A chord brings a caravan of camels along the far dunes,
  // loop notes blow petals away, black keys send
  // shooting stars. Your phrases stir the desert air: a warm haze gathers over the far dunes, and the
  // sunset and the sun's halo glow in your notes' colours; when a phrase ends a gust sweeps the dunes,
  // and a flock of birds answers it, crossing the sun. At rest it lies still; with the music the wisps
  // drift, sand blows, a tumbleweed rolls by. With a loop: the kick rings the sun, the snare throws
  // sand off a crest, the hats send grains along. ──
  function dunes(): Scene {
    const A = anchor('dunes')
    const near = A.near_dune_tops ?? []
    const mid = A.middle_dune_tops ?? []
    const STEM = hex('#5f7a43')
    const SUN = hex('#f8d690')
    const BIRD = hex('#2a1a2a')
    const flowers = new Map<Voice, { x: number; col: Rgb; h: number; t0: number }>()
    const ribbons = new Map<Voice, { x: number; col: Rgb }>()
    const eve = new Map<Voice, { x: number; y: number; col: Rgb; tw: number }>()
    const kept: Kept[] = []
    const petals: Particle[] = []
    const grains: Particle[] = []
    const flocks: { t0: number; y: number; dir: number; n: number }[] = []
    const sand = Array.from({ length: 24 }, () => ({ x: rnd(0, W), y: rnd(62, H), sp: rnd(6, 14) }))
    let chordOn = false
    let sink = 0
    const top = (arr: number[], x: number) => arr[Math.max(0, Math.min(W - 1, Math.round(x)))] ?? H
    const far = A.far_dune_tops ?? []
    const sun = A.sun ?? { x: 54, y: 56, r: 14 }
    const caravans: { t0: number; dir: number; n: number }[] = []
    let lastCaravan = -99
    const weeds: { t0: number; dir: number }[] = []
    let nextWeed = screenClock() + rnd(6, 12)
    const WEED = hex('#8a6a48')
    // the gust that sweeps the dunes when a phrase ends
    let gust: { t0: number; col: Rgb } | null = null
    return {
      strike(vc, band) {
        const x = Math.round(colOf(vc.key))
        const col = noteRgb(vc.key)
        if (band === 'low') flowers.set(vc, { x, col, h: rnd(7, 13), t0: screenClock() })
        else if (band === 'mid') ribbons.set(vc, { x, col })
        else eve.set(vc, { x: x + rnd(-5, 5), y: rnd(4, 14), col, tw: rnd(0, 6.3) })
      },
      special: (vc) => meteor(noteRgb(vc.key)),
      spark(vc, col) {
        const f = flowers.get(vc)
        if (f) petals.push({ x: f.x, y: top(near, f.x) - f.h, t0: screenClock(), col, vx: rnd(8, 16), vy: rnd(-5, -1), life: 2.6 })
        else grains.push({ x: rnd(0, W), y: rnd(64, 84), t0: screenClock(), col, life: 1.2 })
      },
      release(vc) {
        const s = eve.get(vc)
        if (s) {
          kept.push({ x: s.x, y: s.y, col: s.col, t0: screenClock(), life: rnd(14, 22), tw: s.tw })
          eve.delete(vc)
        }
      },
      settle(_pts, t) {
        // a phrase ends: a gust sweeps the dunes
        if (!reduce) gust = { t0: t, col: airCol }
      },
      accent: hex('#f8d690'),
      answer(at, t) {
        if (reduce) return
        flocks.push({ t0: t, y: Math.max(14, Math.min(34, at.y)), dir: at.x < W / 2 ? 1 : -1, n: Math.round(rnd(4, 7)) })
      },
      bar(t) {
        const x = rnd(10, W - 10)
        for (let i = 0; i < 8; i++) grains.push({ x: x + rnd(-3, 3), y: top(mid, x) - 1, vx: rnd(6, 16), vy: rnd(-8, -2), t0: t, col: SUN, life: rnd(0.6, 1) })
      },
      hit(kind, t) {
        if (kind === 'snare') {
          const x = rnd(10, W - 10)
          const col = chord ? mix(SUN, chord, 0.4) : SUN
          for (let i = 0; i < 10; i++) grains.push({ x: x + rnd(-3, 3), y: top(mid, x) - 1, vx: rnd(4, 14), vy: rnd(-10, -3), t0: t, col, life: rnd(0.6, 1.1) })
        } else if (kind === 'hat' && Math.random() < 0.6) grains.push({ x: rnd(0, W), y: rnd(64, 90), t0: t, col: SUN, life: 0.5 })
      },
      draw(t, dt, held) {
        const longest = held.reduce((m, v) => Math.max(m, heldFor(v, t)), 0)
        sink += ((reduce ? 0 : Math.min(8, Math.max(0, longest - 1.5) * 1.6)) - sink) * Math.min(1, dt * 0.6)
        // a chord brings a caravan along the far dunes
        if (held.length >= 2 && !chordOn && !reduce && t - lastCaravan > 8) {
          lastCaravan = t
          caravans.push({ t0: t, dir: Math.random() < 0.5 ? 1 : -1, n: Math.round(rnd(2, 4)) })
        }
        chordOn = held.length >= 2
        blit('dunes', 'sky', 0, tint, dawn * 0.3)
        skyLife(t, A.horizon, 0.7)
        blit('dunes', 'wisps', 0, null, 0, reduce ? 0 : amb * 0.5)
        // your playing warms the sunset, in your notes' colours
        if (air > 0.01) {
          const glowCol = mix(SUN, airCol, 0.45)
          for (let y = 0; y < A.horizon; y++) {
            const q = (y / A.horizon) ** 1.5
            for (let x = 0; x < W; x++) put(x, y, glowCol, air * 0.3 * q)
          }
        }
        blit('dunes', 'stars')
        keptStars(kept, t, dt)
        for (const [vc, s] of eve) {
          if (!alive(vc, t)) eve.delete(vc)
          else flare(s.x, s.y, s.col, amp(vc, t), 1 + Math.round(ease(heldFor(vc, t) / 2) * 2))
        }
        blit('dunes', 'sun', Math.round(sink))
        // ...and the sun's halo swells
        if (air > 0.01) {
          const haloCol = mix(SUN, airCol, 0.3)
          const R0 = sun.r
          const R1 = sun.r + 12 + 4 * air
          for (let y = -Math.ceil(R1); y <= R1; y++)
            for (let x = -Math.ceil(R1); x <= R1; x++) {
              const d = Math.hypot(x, y)
              if (d > R0 && d < R1) put(sun.x + x, sun.y + sink + y, haloCol, air * 0.45 * (1 - (d - R0) / (R1 - R0)) ** 1.3)
            }
        }
        // the kick rings the sun
        const sk = kickK(t)
        if (sk > 0.02)
          for (let a = 0; a < 6.283; a += 0.06) {
            const rr = sun.r + 2 + (1 - sk) * 4
            put(sun.x + Math.cos(a) * rr, sun.y + sink + Math.sin(a) * rr, chord ? mix(SUN, chord, 0.5) : SUN, sk * 0.45)
          }
        drawMeteors(t)
        for (let i = flocks.length - 1; i >= 0; i--) {
          const f = flocks[i]!
          const k = (t - f.t0) / 9
          if (k > 1) {
            flocks.splice(i, 1)
            continue
          }
          for (let j = 0; j < f.n; j++) {
            const x = (f.dir > 0 ? -10 + k * (W + 20) : W + 10 - k * (W + 20)) - f.dir * Math.abs(j - f.n / 2) * 4
            const y = f.y + Math.abs(j - f.n / 2) * 2 + Math.sin(t * 3 + j) * 0.6
            sprite(Math.sin(t * 10 + j) > 0 ? ['#...#', '.#.#.'] : ['.....', '#####'], x, y, BIRD, 0.9)
          }
        }
        blit('dunes', 'far-dunes')
        // a caravan walking the far crest, small against the sky
        for (let i = caravans.length - 1; i >= 0; i--) {
          const c = caravans[i]!
          const k = (t - c.t0) / 18
          if (k > 1) {
            caravans.splice(i, 1)
            continue
          }
          for (let j = 0; j < c.n; j++) {
            const x = (c.dir > 0 ? -10 + k * (W + 20) : W + 10 - k * (W + 20)) - c.dir * j * 9
            const step = Math.floor(t * 4 + j) % 2
            const camel = c.dir > 0 ? ['..#...#', '.###.##', '######.', step ? '#.#..#.' : '.#..#..'] : ['#...#..', '##.###.', '.######', step ? '.#..#.#' : '..#..#.']
            sprite(camel, x, top(far, x) - 4, BIRD, 0.95)
          }
        }
        // a warm haze of dust hangs over the far dunes while you play
        if (air > 0.01) {
          const hazeCol = mix(SUN, airCol, 0.35)
          const HZ = A.horizon
          for (let y = HZ - 14; y < HZ + 10; y++) {
            const band = 1 - Math.abs(y - HZ + 2) / 12
            if (band <= 0) continue
            for (let x = 0; x < W; x++) {
              const n = 0.5 + 0.5 * Math.sin(x * 0.13 + amb * 1.3 + y * 0.6) * Math.sin(x * 0.05 - amb * 0.7 + y * 0.2)
              put(x, y, hazeCol, air * 0.34 * band * (0.4 + 0.6 * n))
            }
          }
        }
        blit('dunes', 'middle-dunes')
        for (const [vc, r] of ribbons) {
          if (!alive(vc, t)) {
            ribbons.delete(vc)
            continue
          }
          const a = amp(vc, t)
          const crest = top(mid, r.x)
          for (let j = 0; j < 40; j++) {
            const q = j / 40
            put(r.x + q * 38 * (0.4 + 0.6 * ease(heldFor(vc, t) / 2)), crest - q * 10 + Math.sin(q * 9 - t * (reduce ? 0 : 3) + vc.seed) * 2.5 * q, r.col, a * (1 - q) * 0.8)
          }
        }
        blit('dunes', 'near-dune')
        for (const [vc, f] of flowers) lightUp('dunes', 'near-dune', f.x, top(near, f.x) - 2, 10, f.col, amp(vc, t) * 0.7)
        blit('dunes', 'cacti-and-rocks')
        // now and then a tumbleweed rolls along the near dune
        if (!reduce && life > 0.6 && t > nextWeed) {
          weeds.push({ t0: t, dir: Math.random() < 0.5 ? 1 : -1 })
          nextWeed = t + rnd(12, 20)
        }
        for (let i = weeds.length - 1; i >= 0; i--) {
          const w = weeds[i]!
          const k = (t - w.t0) / 7
          if (k > 1) {
            weeds.splice(i, 1)
            continue
          }
          const x = w.dir > 0 ? -6 + k * (W + 12) : W + 6 - k * (W + 12)
          const y = top(near, x) - 3 - Math.abs(Math.sin(k * 14)) * 3
          for (let a = 0; a < 6.283; a += 0.5) {
            const sp = a + t * 6 * w.dir
            put(x + Math.cos(sp) * 2.4, y + Math.sin(sp) * 2.4, WEED, 0.9)
            put(x + Math.cos(sp * 2) * 1.2, y + Math.sin(sp * 2) * 1.2, WEED, 0.6)
          }
        }
        // a gust sweeps across the dunes, a front of blown sand
        let gustK = 0
        if (gust) {
          const k = (t - gust.t0) / 2.4
          if (k > 1) gust = null
          else {
            gustK = Math.sin(Math.PI * k)
            const front = -24 + k * (W + 48)
            const col = mix(SUN, gust.col, 0.3)
            for (let y = A.horizon - 2; y < H; y += 2) {
              const lag = ((y * 7) % 11) * 1.5
              const yy = y + Math.sin(y * 1.3 + t * 6) * 0.8
              for (let j = 0; j < 16; j++) put(front - lag - j * 1.4, yy, col, (1 - j / 16) * 0.6 * gustK)
            }
          }
        }
        for (const s of sand) {
          if (!reduce) {
            s.x += s.sp * dt * (pace() + E.high * 2.5 + gustK * 6) // (the sand lies still at rest; the music, the loop's top and a gust blow it along)
            if (s.x > W) {
              s.x = 0
              s.y = rnd(62, H)
            }
          }
          put(s.x, s.y, SUN, 0.22)
        }
        for (const [vc, f] of flowers) {
          if (!alive(vc, t)) {
            flowers.delete(vc)
            continue
          }
          const a = amp(vc, t)
          const grow = ease((t - f.t0) / 1.4)
          const base = top(near, f.x)
          const tall = f.h * (1 + 0.6 * ease(heldFor(vc, t) / 4)) // held, it keeps growing
          const tip = base - Math.round(tall * grow * (vc.released !== null ? 0.7 + 0.3 * a : 1))
          for (let y = base - 1; y >= tip; y--) put(f.x + (y < base - 4 ? Math.round(Math.sin(y * 0.4 + t * (reduce ? 0 : 1.2)) * 0.6) : 0), y, STEM, 1)
          put(f.x - 1, base - 3, STEM, grow)
          put(f.x + 1, base - 5, STEM, grow)
          const r = 1 + 2.2 * a * grow
          for (let p = 0; p < 6; p++) {
            const an = (p / 6) * 6.283 + (reduce ? 0 : t * 0.4)
            put(f.x + Math.cos(an) * r, tip + Math.sin(an) * r * 0.8, f.col, a * grow)
          }
          put(f.x, tip, SUN, a * grow)
        }
        particles(petals, t, dt, (p, k) => {
          p.vy = (p.vy ?? 0) + dt * 3
          put(p.x, p.y, p.col, 1 - k)
        })
        particles(grains, t, dt, (s, k) => put(s.x + k * 6, s.y, s.col, sinWave(k)))
      },
    }
  }

  // ── Sea. Your notes: bioluminescent foam on the waves (low), and now and then a dolphin leaps
  // through it; the lighthouse beam in the note's colour (middle); stars (high), each mirrored on
  // the water. A chord brings a sailboat with a lantern along the horizon, loop notes glint in the
  // water, black keys send shooting stars. Your phrases: the waves glow, bioluminescent, in your
  // notes' colours, a sea haze lights along the horizon and the moon's path brightens; when a phrase
  // ends a glowing swell rolls in to the shore, and a whale answers it, lifting its tail. With the
  // music the lighthouse turns, the waves run, gulls pass. With a loop: the kick lifts the crests
  // and flashes the lamp, the snare throws spray up the rocks, the hats glint on the water. ──
  function sea(): Scene {
    const A = anchor('sea')
    const HZ = A.horizon
    const moon = A.moon!
    const lamp = A.lamp!
    const SAIL = hex('#d9d2c0')
    const HULL = hex('#2a1d1a')
    const WHALE = hex('#1b2238')
    const LANTERN = hex('#ffd890')
    const field = starField(16, 40)
    const beams = new Map<Voice, { col: Rgb; ph: number; sp: number }>()
    const foam = new Map<Voice, { x: number; col: Rgb }>()
    const stars = new Map<Voice, { x: number; y: number; col: Rgb; tw: number }>()
    const kept: Kept[] = []
    const glints: Particle[] = []
    const boats: { t0: number; dir: number; col: Rgb }[] = []
    const whales: { x: number; t0: number; col: Rgb; splashed?: boolean }[] = []
    const splash: Particle[] = []
    const dolphins: { x: number; t0: number; col: Rgb; dir: number }[] = []
    let lastDolphin = -9
    const gulls: { t0: number; dir: number; y: number; n: number }[] = []
    let nextGulls = screenClock() + rnd(8, 14)
    const GULL = hex('#e8e4da')
    let swell: { t0: number; col: Rgb } | null = null
    let chordOn = false
    return {
      strike(vc, band) {
        const x = colOf(vc.key)
        const col = noteRgb(vc.key)
        const t = screenClock()
        if (band === 'low') {
          foam.set(vc, { x: Math.min(W - 44, x), col })
          if (!reduce && t - lastDolphin > 4) {
            lastDolphin = t
            dolphins.push({ x: Math.min(W - 70, Math.max(4, x - 10)), t0: t, col, dir: 1 })
          }
        } else if (band === 'mid') {
          beams.set(vc, { col, ph: rnd(0, 6.3), sp: rnd(0.35, 0.6) })
        } else stars.set(vc, { x: Math.min(W - 44, x) + rnd(-4, 4), y: rnd(4, 22), col, tw: rnd(0, 6.3) })
      },
      special: (vc) => meteor(noteRgb(vc.key)),
      spark: (_vc, col) => void glints.push({ x: rnd(4, W - 46), y: rnd(HZ + 3, H - 2), t0: screenClock(), col, life: 1.2 }),
      release(vc) {
        const s = stars.get(vc)
        if (s) {
          kept.push({ x: s.x, y: s.y, col: s.col, t0: screenClock(), life: rnd(14, 22), tw: s.tw })
          stars.delete(vc)
        }
      },
      settle(_pts, t) {
        // a glowing swell rolls in to the shore
        if (!reduce) swell = { t0: t, col: airCol }
      },
      accent: hex('#8fe3ff'),
      answer(at, t) {
        if (reduce) return
        whales.push({ x: Math.min(W - 50, Math.max(10, at.x)), t0: t, col: at.col })
      },
      bar(t) {
        for (let i = 0; i < 6; i++) glints.push({ x: rnd(4, W - 46), y: rnd(HZ + 2, HZ + 12), t0: t, col: chord ? mix(MOON, chord, 0.5) : MOON, life: 0.6 })
      },
      hit(kind, t) {
        if (kind === 'snare') {
          const col = chord ? mix(MOON, chord, 0.4) : MOON
          for (let i = 0; i < 14; i++) splash.push({ x: rnd(88, 124), y: rnd(86, 93), vx: rnd(-6, 6), vy: rnd(-26, -12), t0: t, col, life: rnd(0.6, 1) })
        } else if (kind === 'hat' && Math.random() < 0.6) glints.push({ x: rnd(4, W - 46), y: rnd(HZ + 3, H - 2), t0: t, col: chord ? mix(MOON, chord, 0.5) : MOON, life: 0.35 })
      },
      draw(t, dt, held) {
        if (!reduce && life > 0.6 && t > nextGulls) {
          gulls.push({ t0: t, dir: Math.random() < 0.5 ? 1 : -1, y: rnd(20, 36), n: Math.round(rnd(1, 3)) })
          nextGulls = t + rnd(12, 22)
        }
        if (held.length >= 2 && !chordOn && !reduce) boats.push({ t0: t, dir: Math.random() < 0.5 ? 1 : -1, col: tint.some((v) => v > 0) ? tint : LANTERN })
        chordOn = held.length >= 2
        blit('sea', 'sky', 0, tint, dawn * 0.4)
        skyLife(t, HZ)
        blit('sea', 'stars')
        starDust(field, t, 0.5)
        blit('sea', 'moon')
        keptStars(kept, t, dt)
        for (const [vc, s] of stars) {
          if (!alive(vc, t)) stars.delete(vc)
          else flare(s.x, s.y, s.col, amp(vc, t), 1 + Math.round(ease(heldFor(vc, t) / 2) * 2))
        }
        drawMeteors(t)
        // the lighthouse keeps turning, its beam faint and warm, whether or not a note is on it
        if (!beams.size) {
          const ang = Math.PI + (reduce ? -0.3 : Math.sin(amb * 0.3) * 0.55 - 0.15)
          for (let r = 3; r < 120; r += 0.8) put(lamp.x + Math.cos(ang) * r, lamp.y + Math.sin(ang) * r, hex('#ffe3a0'), 0.08 * (1 - r / 120) + kickK(t) * 0.1 * (1 - r / 120))
        }
        for (const [vc, b] of beams) {
          if (!alive(vc, t)) {
            beams.delete(vc)
            continue
          }
          const a = amp(vc, t)
          const ang = Math.PI + (reduce ? -0.3 : Math.sin(t * b.sp + b.ph) * 0.55 - 0.15)
          for (let r = 3; r < 140; r += 0.7) {
            const spread = 0.015 + r * 0.0009
            for (let s = -1; s <= 1; s++) put(lamp.x + Math.cos(ang + s * spread * 6) * r, lamp.y + Math.sin(ang + s * spread * 6) * r, b.col, a * 0.2 * (1 - r / 140) * (s ? 0.5 : 1))
          }
        }
        // gulls crossing
        for (let i = gulls.length - 1; i >= 0; i--) {
          const gl = gulls[i]!
          const k = (t - gl.t0) / 9
          if (k > 1) {
            gulls.splice(i, 1)
            continue
          }
          for (let j = 0; j < gl.n; j++) {
            const x = (gl.dir > 0 ? -8 + k * (W + 16) : W + 8 - k * (W + 16)) - gl.dir * j * 7
            const y = gl.y + j * 3 + Math.sin(t * 2 + j) * 1.5
            sprite(Math.sin(t * 7 + j * 2) > 0 ? ['#...#', '.#.#.'] : ['.....', '##.##'], x, y, GULL, 0.85)
          }
        }
        blit('sea', 'islands')
        // a sea haze lights along the horizon while you play
        if (air > 0.01) {
          const hc = mix(MOON, airCol, 0.5)
          for (let y = HZ - 7; y < HZ + 4; y++) {
            const band = 1 - Math.abs(y - HZ + 1) / 6
            if (band > 0) for (let x = 0; x < W; x++) put(x, y, hc, air * 0.2 * band * (0.6 + 0.4 * Math.sin(x * 0.09 + amb * 0.6)))
          }
        }
        blit('sea', 'sea')
        for (let i = boats.length - 1; i >= 0; i--) {
          const b = boats[i]!
          const k = (t - b.t0) / 16
          if (k > 1) {
            boats.splice(i, 1)
            continue
          }
          const x = b.dir > 0 ? -8 + k * (W - 40) : W - 46 - k * (W - 40)
          const y = HZ - 1 + Math.sin(t * 1.5) * 0.5
          const fade = Math.min(1, k * 6, (1 - k) * 6)
          sprite(['..#....', '..##...', '..###..', '..####.', '..#####', '..#....'], x, y - 7, SAIL, 0.85 * fade)
          sprite(['#######', '.#####.'], x, y - 1, HULL, fade)
          plus(x - 3, y - 3, b.col, fade)
          for (let j = 1; j < 5; j++) put(x - 3, y + j * 2, LANTERN, (fade * 0.25) / j)
        }
        const crestK = Math.max(kickK(t), E.bass * 0.55) // the kick (and the loop's bass) lifts the crests
        // (your playing makes the waves glow, bioluminescent, in your notes' colours, and brightens the moon's path)
        const glowCol = mix(MOON, airCol, 0.7)
        for (let y = HZ + 1; y < H; y += 2)
          for (let x = 0; x < W; x++) {
            const crest = Math.sin(x * 0.35 + y * 1.7 + amb * (reduce ? 0 : 1.4)) > 0.92 - crestK * 0.12 - air * 0.1
            const path = Math.abs(x - moon.x - Math.sin(y * 0.7 + amb * 2) * 2) < 2 + (y - HZ) * 0.15
            if (crest) put(x, y, crestK > 0.05 && chord ? mix(MOON, chord, 0.5) : mix(MOON, glowCol, air), path ? 0.8 : 0.16 + crestK * 0.35 + air * 0.4)
            else if (path && Math.sin(x * 2.1 + y + amb * 3) > 0.3) put(x, y, MOON, 0.2 + 0.15 * life + 0.2 * air)
          }
        // a phrase ending sends a glowing swell rolling in from the horizon to the shore
        if (swell) {
          const k = (t - swell.t0) / 2.8
          if (k > 1) swell = null
          else {
            const row = HZ + 1 + k * (H - HZ)
            const col = mix(MOON, swell.col, 0.55)
            const fade = Math.sin(Math.PI * k)
            for (let y = HZ + 1; y < H; y++) {
              const d = Math.abs(y - row)
              if (d > 3) continue
              for (let x = 0; x < W; x++) if (Math.sin(x * 0.5 + y * 0.8 + amb * 2) > 0.1) put(x, y, col, 0.6 * fade * (1 - d / 3.5))
            }
          }
        }
        for (const [vc, f] of foam) {
          if (!alive(vc, t)) {
            foam.delete(vc)
            continue
          }
          const a = amp(vc, t)
          const reach = 6 + 10 * ease(heldFor(vc, t) / 2.5)
          for (let y = HZ + 2; y < H; y += 2)
            for (let x = Math.floor(f.x - reach); x <= f.x + reach; x++)
              if (Math.sin(x * 0.35 + y * 1.7 + amb * (reduce ? 0 : 1.4)) > 0.75) put(x, y, f.col, a * 0.9 * (1 - Math.abs(x - f.x) / (reach + 1)) * (0.6 + (0.4 * (y - HZ)) / (H - HZ)))
        }
        particles(glints, t, dt, (s, k) => plus(s.x, s.y, s.col, sinWave(k)))
        // each star held is mirrored on the water
        for (const [vc, s] of stars) {
          const a = amp(vc, t)
          for (let y = HZ + 2; y < H; y += 2) put(s.x + (reduce ? 0 : Math.round(Math.sin(y * 0.9 + t * 2))), y, s.col, a * 0.35 * (1 - (y - HZ) / (H - HZ)))
        }
        // a dolphin leaping through the glowing foam
        for (let i = dolphins.length - 1; i >= 0; i--) {
          const d = dolphins[i]!
          const k = (t - d.t0) / 1.7
          if (k > 1) {
            dolphins.splice(i, 1)
            for (let j = 0; j < 10; j++) splash.push({ x: d.x + 26 + rnd(-2, 2), y: HZ + 8, vx: rnd(-8, 8), vy: rnd(-16, -6), t0: t, col: d.col, life: 0.8 })
            continue
          }
          const x = d.x + k * 26
          const y = HZ + 9 - Math.sin(Math.PI * k) * 13
          const body = k < 0.35 ? ['....##', '..####', '.####.', '##....'] : k < 0.65 ? ['..###..', '#######', '.#...#.'] : ['##....', '.####.', '..####', '....##']
          sprite(body, x, y - 2, hex('#2b3a5c'), 1)
          put(x, y - 3, d.col, 0.9)
          for (let j = 1; j < 6; j++) put(x - j * 2, y + j * (k < 0.5 ? 1.4 : -1.4), d.col, 0.5 * (1 - j / 6)) // a trail of its light
        }
        for (let i = whales.length - 1; i >= 0; i--) {
          const w = whales[i]!
          const k = (t - w.t0) / 3.2
          if (k > 1) {
            whales.splice(i, 1)
            continue
          }
          const up = Math.sin(Math.PI * Math.min(1, k * 1.15))
          const y = HZ + 14 - up * 9
          const fluke = ['#.......#', '##.....##', '.##...##.', '..#####..', '...###...', '....#....', '....#....', '....#....']
          fluke.forEach((row, j) => {
            if (y + j < H && y + j > HZ - 6) [...row].forEach((ch, ii) => ch === '#' && put(w.x + ii - 4, y + j, WHALE, 1))
          })
          put(w.x - 4, y, w.col, up * 0.6)
          put(w.x + 4, y, w.col, up * 0.6)
          if (k > 0.7 && !w.splashed) {
            w.splashed = true
            for (let j = 0; j < 18; j++) splash.push({ x: w.x + rnd(-5, 5), y: HZ + 6, vx: rnd(-10, 10), vy: rnd(-22, -8), t0: t, col: w.col, life: 1.1 })
          }
        }
        particles(splash, t, dt, (s, k) => {
          s.vy = (s.vy ?? 0) + dt * 40
          put(s.x, s.y, mix(MOON, s.col, 0.5), 1 - k)
        })
        blit('sea', 'cliff')
        blit('sea', 'lighthouse')
        blit('sea', 'rocks')
        let lit = 0
        for (const [vc] of beams) lit = Math.max(lit, amp(vc, t))
        plus(lamp.x, lamp.y, hex('#ffe3a0'), Math.min(1, 0.4 + 0.6 * lit + kickK(t) * 0.5))
        lightUp('sea', 'lighthouse', lamp.x, lamp.y, 8, hex('#ffe3a0'), 0.3 + 0.5 * lit)
      },
    }
  }

  // ── running ──
  const BUILD = { lake, peaks, dunes, sea } as const
  let index = 0
  let scene: Scene = lake()
  let pending: number | null = null
  let switchedAt = -9
  let osd: { kind: Readout; value: number; until: number } | null = null
  const pulse = () => Math.max(beat(), kickAt, snareAt)

  // ── Your playing, in every landscape the same way. Each note makes its own thing (the scene's
  // strike: low, middle and high notes each something of their own). A phrase stirs the air: the
  // more you play, the more it gathers, in your notes' colours (a chord note's own colour, another
  // note of the key leaning to the chord, a blue note cooler, an outside note dimmer); when it ends
  // (a beat and a half of quiet, nothing held) the air moves (scene.settle), and on the next beat the
  // landscape answers a phrase of three notes or more with its animal (a heron, a fox, a flock, a
  // whale). When an outside note steps onto a chord note, the tension resolves: the chord's colour
  // sweeps down the sky. The busier the playing, the more life rises from the landscape. ──
  let phrase: PhrasePoint[] = []
  const motes: Particle[] = []
  let lastNoteAt = -9
  let quietSince = -9 // when the keys last fell silent (nothing held)
  let lastMidi: number | null = null
  let lastTier: Tier = 'chord'
  let lastResolve = -9
  let answerDue: { x: number; y: number; col: Rgb } | null = null
  let lastAnswerBeat = -9
  let lastBeatNo = -1
  let lastBar = -1
  let barChord: number | null = null
  const stepOf = (key: string) => Math.max(0, KEYS_BY_PITCH.indexOf(key))
  const heightOf = (key: string) => 32 - stepOf(key) * 2.15 // (the 13 keys span the sky, y 6-32)
  /** How a note sits in the music: one of the chord's notes (either third), another note of the key, a blue note (the key's b3, b5, b7), or outside. */
  function tierOf(midi: number): Tier {
    const now = groove()
    if (!now) return 'chord'
    const pc = ((midi % 12) + 12) % 12
    const inChord = (root: number | null) => root !== null && [0, 3, 4, 7].some((i) => (root + i) % 12 === pc)
    if (inChord(now.chord) || inChord(now.soon)) return 'chord' // (a note just before a change counts for the new chord)
    const k = now.scale
    if ([0, 2, 4, 5, 7, 9, 11].some((i) => (k + i) % 12 === pc)) return 'key'
    if ([3, 6, 10].some((i) => (k + i) % 12 === pc)) return 'blue'
    return 'outside'
  }
  function onNote(vc: Voice, t: number) {
    recent.push(t)
    strikes.push({ t0: t, x: colOf(vc.key), col: noteRgb(vc.key) })
    if (strikes.length > 16) strikes.shift()
    lastNoteAt = t
    E.build = Math.min(1, E.build + 0.012)
    const col = noteRgb(vc.key)
    const tier = tierOf(vc.midi)
    const y = heightOf(vc.key)
    const point: PhrasePoint = { t, y, col, tier, step: stepOf(vc.key) }
    phrase.push(point)
    if (phrase.length > 40) phrase.shift() // (a long run of notes with no breath: only its last forty count)
    airCol = mix(airCol, tierColour(point), 0.35)
    // a tension resolved: an outside note stepping (by a semitone or a tone) onto a chord note
    const stepped = lastMidi !== null && Math.abs(vc.midi - lastMidi) <= 2
    if (tier === 'chord' && lastTier === 'outside' && stepped && t - lastResolve > 4) {
      lastResolve = t
      sweep = { t0: t, col }
      air = Math.min(1, air + 0.3)
    }
    lastMidi = vc.midi
    lastTier = tier
  }
  /** A phrase is over (a beat and a half of quiet, nothing held): it settles into the landscape, which answers it. */
  function endPhrase(t: number) {
    const pts = phrase
    phrase = []
    lastMidi = null
    if (!pts.length) return
    scene.settle(pts, t)
    // a phrase of three or more that doesn't end outside the key: the landscape answers, on the next beat
    const last = pts[pts.length - 1]!
    const cx = pts.reduce((a, p) => a + 8 + (p.step / 12) * (W - 16), 0) / pts.length // (low notes on the left, high on the right)
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length
    if (pts.length >= 3 && last.tier !== 'outside') answerDue = { x: cx, y: cy, col: last.col }
  }
  // ── The moment of a note, the same in every landscape and drawn over it, so the screen moves with
  // your hands: as a note sounds, the landscape's own light (the moon, the sun, the aurora) flares in
  // its colour, the sky takes a breath of it, and a ring of light opens on the water, the snow, the
  // sand or the sea, above the key you played. All of it in at once, and gone in about half a second.
  // While a loop plays the whole picture breathes a little on its kick. ──
  const SOURCE: Record<string, { x: number; y: number; r: number; wide?: number }> = {
    lake: anchor('lake').moon!,
    peaks: { x: 64, y: 24, r: 0, wide: 46 }, // (no moon there: the aurora's part of the sky)
    dunes: anchor('dunes').sun ?? { x: 54, y: 56, r: 14 },
    sea: anchor('sea').moon!,
  }
  /** Where a note's ring opens in each landscape, under its key: on the water, the snowfield, the near dune's crest, the sea. */
  function groundAt(id: string, x: number) {
    const A = anchor(id)
    if (id === 'lake') return (A.lake_top ?? A.horizon) + 4
    if (id === 'dunes') return (A.middle_dune_tops?.[Math.max(0, Math.min(W - 1, Math.round(x)))] ?? A.horizon + 10) + 1
    if (id === 'sea') return A.horizon + 5
    return A.horizon + 8
  }
  const strikes: { t0: number; x: number; col: Rgb }[] = []
  function drawStrikes(t: number, id: string) {
    const src = SOURCE[id]!
    const HZ = anchor(id).horizon
    // the light and the sky, from all the notes sounding now together (a chord flares once, warmer)
    let e = 0
    let cr = 0
    let cg = 0
    let cb = 0
    for (let i = strikes.length - 1; i >= 0; i--) {
      const s = strikes[i]!
      const age = t - s.t0
      if (age > 1.2) {
        strikes.splice(i, 1)
        continue
      }
      const k = ease(age / 0.04) * Math.exp(-age / (reduce ? 0.3 : 0.42))
      e += k
      cr += s.col[0] * k
      cg += s.col[1] * k
      cb += s.col[2] * k
    }
    if (e < 0.01) return
    const col: Rgb = [cr / e, cg / e, cb / e]
    const hot = mix(col, WHITE, 0.55)
    e = Math.min(1.4, e)
    if (src.wide) {
      const ry = 13
      for (let y = Math.max(0, Math.floor(src.y - ry)); y <= src.y + ry; y++)
        for (let x = Math.max(0, Math.floor(src.x - src.wide)); x <= Math.min(W - 1, src.x + src.wide); x++) {
          const q = 1 - Math.hypot((x - src.x) / src.wide, (y - src.y) / ry)
          if (q > 0) light(x, y, col, 0.85 * e * q * q)
        }
    } else {
      const R = src.r + 6 + 12 * Math.min(1, e)
      for (let y = Math.floor(src.y - R); y <= src.y + R; y++)
        for (let x = Math.floor(src.x - R); x <= src.x + R; x++) {
          const d = Math.hypot(x - src.x, y - src.y)
          if (d <= src.r) light(x, y, hot, 0.25 * e)
          else if (d < R) light(x, y, col, 0.9 * e * (1 - (d - src.r) / (R - src.r)) ** 1.8)
        }
    }
    for (let y = 0; y < HZ; y++) {
      const k = 0.09 * e * (0.35 + 0.65 * (y / HZ))
      for (let x = 0; x < W; x++) light(x, y, col, k)
    }
    if (reduce) return
    // each note's own ring of light, opening on the ground above its key: a soft band lying on the
    // surface (following it, on the dunes), its near side brighter, a faint glow inside it, and a
    // spark where it lands
    for (const s of strikes) {
      const age = t - s.t0
      const k = age / 0.85
      if (k >= 1) continue
      const open = 1 - (1 - k) ** 3
      const rx = 3 + 28 * open
      const ry = Math.max(1.5, rx * 0.21)
      const a = (1 - k) ** 1.5
      const ring = mix(s.col, WHITE, 0.25)
      const band = 1.3 + 1.2 * open // (its width, in pixels, widening as it spreads)
      for (let x = Math.floor(s.x - rx - 3); x <= s.x + rx + 3; x++) {
        const gy = groundAt(id, x)
        for (let y = Math.floor(gy - ry - 3); y <= gy + ry + 3; y++) {
          const dx = (x - s.x) / rx
          const dy = (y - gy) / ry
          const rho = Math.hypot(dx, dy)
          const edge = (rho - 1) * Math.min(rx, ry * 2.2)
          const lit = Math.exp(-(edge * edge) / (band * band)) + (rho < 1 ? 0.22 * (1 - rho) : 0)
          if (lit > 0.02) light(x, y, ring, 0.75 * a * lit * (dy > 0 ? 1 : 0.55))
        }
      }
      const sp = 1 - age / 0.32
      if (sp > 0) {
        const y = groundAt(id, s.x)
        light(s.x, y, WHITE, sp)
        for (let r = 1; r <= 4; r++) {
          light(s.x + r, y, s.col, sp * (1 - r / 5))
          light(s.x - r, y, s.col, sp * (1 - r / 5))
          light(s.x, y - r, s.col, sp * 0.7 * (1 - r / 5))
        }
      }
    }
  }
  /** The loop's kick: the whole picture breathes a little brighter, in time. */
  function breathe(t: number) {
    const k = kickK(t) * 0.07 * life
    if (k < 0.004) return
    for (let i = 0; i < px.length; i++) px[i] = Math.min(1, get(i) * (1 + k))
  }
  function drawPlaying(t: number, dt: number) {
    // life rising from the landscape, as busy as the playing
    if (!reduce && motes.length < 70 && Math.random() < dt * E.density * 16) {
      motes.push({ x: rnd(4, W - 4), y: rnd(H * 0.45, H - 4), vx: rnd(-3, 3), vy: rnd(-12, -4), t0: t, col: scene.accent, life: rnd(1.2, 2.4) })
    }
    particles(motes, t, dt, (m, k) => put(m.x, m.y, m.col, Math.sin(Math.PI * k) * 0.9))
  }

  // the backing loop's hits arrive a moment early (they're scheduled ahead): each waits for its time
  const due: ReturnType<typeof backingEvents> = []
  let nextMeteor = screenClock() + rnd(6, 12)
  // On opening it boots, like an old machine: its name with a little keyboard and PRESS A KEY; the
  // first key brings up how to play it (the computer keys laid out like the piano's, lighting up in
  // turn), and the second key lets the landscape in. A knob or dial turned meanwhile shows its
  // readout over the landscape for a moment, then the boot screen comes back.
  const opened = screenClock()
  const boot = { strikes: 0, howAt: null as number | null, fading: null as number | null }
  const AMBER: Rgb[] = [[1, 0.86, 0.55], [0.98, 0.74, 0.4], [0.95, 0.6, 0.3]]
  const CAP: Rgb = [0.86, 0.82, 0.74]
  const INK: Rgb = [0.1, 0.08, 0.1]
  function keycap(label: string, x: number, y: number, w: number, black: boolean, lit: boolean, a: number) {
    const face = lit ? AMBER[0]! : black ? [0.16, 0.13, 0.15] as Rgb : CAP
    for (let j = 0; j < 9; j++) for (let i = 0; i < w; i++) {
      const edge = i === 0 || j === 0 || i === w - 1 || j === 8
      put(x + i, y + j, edge ? mix(face, INK, 0.45) : face, a)
    }
    text(label, x + Math.floor((w - textWidth(label)) / 2), y + 2, black && !lit ? CAP : INK, a)
  }
  function drawHowTo(t: number, a: number) {
    text('HOW TO PLAY', centred('HOW TO PLAY'), 6, AMBER[0]!, a)
    const whites = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K']
    const blacks: [string, number][] = [['W', 0], ['E', 1], ['T', 3], ['Y', 4], ['U', 5]]
    const x0 = 16
    const lit = reduce ? -1 : Math.floor((t - (boot.howAt ?? t)) * 5) % 13 // a little run up the keys
    const order = ['A', 'W', 'S', 'E', 'D', 'F', 'T', 'G', 'Y', 'H', 'U', 'J', 'K']
    whites.forEach((k, i) => keycap(k, x0 + i * 12, 27, 11, false, order[lit] === k, a))
    for (const [k, i] of blacks) keycap(k, x0 + i * 12 + 7, 16, 9, true, order[lit] === k, a)
    text('PLAY THE KEYS, OR TAP THEM', centred('PLAY THE KEYS, OR TAP THEM'), 42, MOON, a)
    text('A LOOP JOINS IN', centred('A LOOP JOINS IN'), 50, AMBER[1]!, a)
    text('KNOBS: LOOP + KEYS VOLUME', centred('KNOBS: LOOP + KEYS VOLUME'), 61, MOON, a * 0.85)
    text('PICK A SCENE + A LOOP BELOW', centred('PICK A SCENE + A LOOP BELOW'), 69, MOON, a * 0.85)
    if (reduce || Math.sin(t * 4) > -0.2) text('PRESS A KEY', centred('PRESS A KEY'), 82, AMBER[0]!, a)
  }
  function drawBoot(t: number, a: number) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, TITLE_BG, a)
    const howTo = boot.howAt === null ? 0 : clamp01((t - boot.howAt) / 0.4) // the name gives way to how to play
    if (howTo > 0) drawHowTo(t, a * howTo)
    if (howTo >= 1) return
    a *= 1 - howTo
    paintTitle(put, t, a, reduce)
  }
  const seen = new WeakSet<Voice>()
  const released = new WeakSet<Voice>()
  let frame = 0
  let last = screenClock()
  void loadLandscape('lake')

  function draw() {
    frame = requestAnimationFrame(draw)
    const t = screenClock()
    const dt = Math.min(0.1, Math.max(0, t - last))
    last = t
    if (pending !== null && t - switchedAt > 0.22) {
      index = pending
      pending = null
      const id = LANDSCAPES[index]!.id
      scene = BUILD[id]()
      void loadLandscape(id)
      for (const vc of voices()) if (vc.released === null && !isBlack(vc.key)) scene.strike(vc, bandOf(vc.key))
    }
    const id = LANDSCAPES[index]!.id
    const held: Voice[] = []
    let tr = 0
    let tg = 0
    let tb = 0
    let tw = 0
    for (const vc of voices()) {
      if (!seen.has(vc)) {
        seen.add(vc)
        if (vc.start >= opened) onNote(vc, t)
        if (vc.start >= opened) {
          // (a note still fading from the last time it was open doesn't count)
          boot.strikes++
          if (boot.strikes === 1) boot.howAt = t
          if (boot.strikes === 2) boot.fading = t
        }
        if (isBlack(vc.key)) scene.special(vc)
        else scene.strike(vc, bandOf(vc.key))
      }
      for (let i = vc.beads.length - 1; i >= 0; i--) {
        const b = vc.beads[i]!
        if (t < b.at) continue
        vc.beads.splice(i, 1)
        scene.spark(vc, hex(colourOfPitchClass(vc.midi + b.interval)))
      }
      if (vc.released !== null && t > vc.released) {
        if (!released.has(vc)) {
          released.add(vc)
          scene.release(vc)
        }
      } else {
        held.push(vc)
        const w = amp(vc, t) * ease((t - vc.start) / 3)
        const c = noteRgb(vc.key)
        tr += c[0] * w
        tg += c[1] * w
        tb += c[2] * w
        tw += w
      }
    }
    due.push(...backingEvents())
    for (let i = 0; i < due.length; i++) {
      const e = due[i]!
      if (e.at > t) continue
      due.splice(i--, 1)
      if (t - e.at > 0.25) continue // long gone (it was closed, or in the background)
      if (e.kind === 'chord') {
        chord = hex(colourOfPitchClass(e.pc))
        if (!reduce) sweep = { t0: t, col: chord }
      } else {
        // the loop's drums: the hits measured in it, arriving in time
        if (e.kind === 'kick') kickAt = t
        if (e.kind === 'snare') snareAt = t
        scene.hit(e.kind, t)
      }
    }
    // how the loop sounds right now (still, with reduced motion: nothing pulses with it)
    const h = reduce ? { bass: 0, mid: 0, high: 0 } : heard(t)
    const follow = 1 - Math.exp(-dt / 0.12)
    E.bass += (h.bass - E.bass) * follow
    E.mid += (h.mid - E.mid) * follow
    E.high += (h.high - E.high) * follow
    // the loop's bars and beats
    const now = groove()
    if (now) {
      const pos = Math.max(0, now.k + (t - now.at) / now.sec) // (the step is scheduled a moment ahead)
      const bar = Math.floor(pos / 16)
      const beatNo = Math.floor(pos / 4)
      if (beatNo !== lastBeatNo) {
        // a beat: the landscape answers a finished phrase on the next one (at most once a bar)
        if (lastBeatNo >= 0 && answerDue && !reduce && beatNo - lastAnswerBeat >= 4) {
          scene.answer(answerDue, t)
          lastAnswerBeat = beatNo
          answerDue = null
        }
        lastBeatNo = beatNo
      }
      if (bar !== lastBar) {
        // on bars 1 and 5 of the loop it moves with the music, unless the chord changes (that sweeps the sky)
        if (lastBar >= 0 && !reduce && bar % 4 === 0 && now.chord === barChord && beatNo !== lastAnswerBeat) scene.bar(t)
        barChord = now.chord
        lastBar = bar
      }
    } else {
      lastBar = -1
      lastBeatNo = -1
      if (answerDue && !reduce) scene.answer(answerDue, t) // (no loop: it answers at once)
      answerDue = null
    }
    // how busy the playing is (it keeps rising up to about five notes a second), how much the jam has
    // built up, and the end of a phrase: a beat and a half of quiet (at least 0.9 s), nothing held
    while (recent.length && t - recent[0]! > 4) recent.shift()
    E.density = Math.min(1, Math.sqrt(recent.length / 20))
    if (t - lastNoteAt > 8) E.build = Math.max(0, E.build - dt / 90)
    if (held.length) quietSince = t
    const gap = Math.max(0.9, now ? now.sec * 6 : 0.9) // (a beat and a half)
    if (phrase.length && !held.length && t - Math.max(quietSince, lastNoteAt) > gap) endPhrase(t)
    const looping = jamming() ? chord : null
    // a long jam brings first light; it goes back to night slowly when the music stops
    daybreak = Math.max(0, Math.min(0.9, daybreak + dt * (held.length || looping ? 1 / 150 : -1 / 90)))
    // the air a phrase stirs: it gathers as the phrase goes on, and settles slowly after it
    const stirred = phrase.length ? Math.min(1, 0.35 + phrase.length / 10) : 0
    air += (stirred - air) * (1 - Math.exp(-dt / (stirred > air ? 0.6 : 4)))
    // the landscape comes alive with the music (in about a second) and settles back to stillness after it (over a few)
    const lively = jamming() || held.length || t - lastNoteAt < 4 ? 1 : 0
    life += (lively - life) * (1 - Math.exp(-dt / (lively > life ? 1 : 4)))
    amb += dt * pace()
    // now and then a shooting star, while the music plays
    if (t > nextMeteor && life > 0.6) {
      meteor(mix(MOON, chord ?? MOON, 0.4))
      nextMeteor = t + rnd(9, 18)
    }
    dawn += (Math.min(0.55, Math.max(tw * 0.3, looping ? 0.16 : 0)) - dawn) * (1 - Math.exp(-dt / 1.2))
    if (tw > 0) tint = [tr / tw, tg / tw, tb / tw]
    if (looping) tint = mix(tint, looping, tw > 0 ? 0.45 : 1)
    px.fill(0)
    if (layers[id]) {
      scene.draw(t, dt, held)
      drawPlaying(t, dt)
      drawStrikes(t, id)
      breathe(t)
    }
    const k = (t - switchedAt) / 0.45
    if (k >= 0 && k < 1) {
      // changing channel: a burst of static and a rolling bar
      const roll = Math.floor(k * H * 1.5) % H
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const n = Math.random()
          put(x, y, [n, n, n * 1.05], (1 - Math.abs(k - 0.5) * 2) * 0.85 * (Math.abs(y - roll) < 4 ? 1.2 : 1))
        }
    }
    const bootA = boot.fading === null ? 1 : 1 - (t - boot.fading) / 0.6
    const reading = osd !== null && t < osd.until
    if (bootA > 0 && !reading) drawBoot(t, bootA)
    if (osd && t < osd.until) {
      // the knob's name, its choice and a dot for each option, inset from the glass's rounded corner
      const fade = Math.min(1, (osd.until - t) / 0.35)
      const volume = osd.kind === 'loopVolume' || osd.kind === 'keysVolume'
      const state = osd.kind === 'loopState'
      const title = { landscape: 'LANDSCAPE', loop: 'LOOP', loopVolume: 'LOOP VOLUME', keysVolume: 'KEYS VOLUME', loopState: 'LOOP' }[osd.kind]
      const names = osd.kind === 'landscape' ? LANDSCAPES.map((l) => l.name) : LOOPS.map((l) => l.name)
      let value = state ? (osd.value ? 'PLAYING' : 'PAUSED') : volume ? `${Math.round(osd.value * 100)}` : names[osd.value]!.toUpperCase()
      while (textWidth(value) > W - 24) value = value.slice(0, -1) // a long song name, cut to the glass
      const marks = volume ? 10 : names.length
      const wide = Math.min(W - 16, Math.max(textWidth(title), textWidth(value), marks * (volume ? 5 : 6)) + 6)
      for (let y = 6; y < 26; y++) for (let x = 8; x < 8 + wide; x++) put(x, y, [0.02, 0.02, 0.04], 0.62 * fade)
      text(title, 11, 9, MOON, 0.55 * fade)
      text(value, 11, 9 + FONT_HEIGHT + 2, MOON, fade)
      if (state) {
        // (no marks: just the word)
      } else if (volume) for (let i = 0; i < 10; i++) for (let x = 0; x < 4; x++) for (let y = 22; y < 24; y++) put(11 + i * 5 + x, y, MOON, fade * (i < Math.round(osd.value * 10) ? 1 : 0.2))
      else for (let i = 0; i < names.length; i++) for (let x = 0; x < 4; x++) put(11 + i * 6 + x, 23, MOON, fade * (i === osd.value ? 1 : 0.3))
    }
    const d = img.data
    for (let i = 0, j = 0; i < W * H; i++, j += 3) {
      d[i * 4] = get(j) * 255
      d[i * 4 + 1] = get(j + 1) * 255
      d[i * 4 + 2] = get(j + 2) * 255
      d[i * 4 + 3] = 255
    }
    g.putImageData(img, 0, 0)
  }

  return {
    start() {
      if (frame) return
      last = screenClock()
      frame = requestAnimationFrame(draw)
    },
    stop() {
      cancelAnimationFrame(frame)
      frame = 0
    },
    setLandscape(i) {
      if (i === index && pending === null) return
      pending = i
      switchedAt = screenClock()
      void loadLandscape(LANDSCAPES[i]!.id)
    },
    readout(kind, value) {
      osd = { kind, value, until: screenClock() + 1.8 }
    },
  }
}
