/**
 * The Pixel Jam Piano's sound: each key a recorded instrument over a soft sustained pad, held
 * notes growing harmonic loops, and a backing loop (the bottom knob) to jam over that starts with
 * the first key; each landscape (the top knob) has its own space and quiet ambience. The rules
 * (colours, loops, tones, grooves) are src/scene/pianoMusic.ts.
 *
 *  - The pads and the ambience are plain Web Audio, ready at once, so the first key always sounds.
 *  - Tone.js (MIT), loaded when the close-up opens, runs the clock (its Transport calls each
 *    sixteenth with its exact audio time), the effects (reverb, a tempo-synced ping-pong echo,
 *    a limiter), the recorded instruments (Samplers, which pitch the nearest recording to each
 *    note), the hand percussion (Players) and the backing band (a synthesized kit, bass, electric
 *    piano, clav and pad). The recordings are CC0, from the Versilian Community Sample Library, in
 *    public/media/piano/samples.
 *  - The screen reads the voices (`voices()`), so the picture follows the sound exactly.
 *
 * It only ever sounds in answer to a key on the close-up (browsers allow sound only after a click,
 * tap or key anyway), and it stops, with the ambience, when the close-up closes. The room's radio
 * dips meanwhile.
 */
import type * as ToneLib from 'tone'
import type { Piano } from '../scene/piano'
import { roomRadio } from './radio'
import {
  FIGURES, INSTRUMENTS, LANDSCAPES, LOOPS, TONES, loopInterval, loopStep, midiOf,
  type Ambience, type BackingLoop, type Instrument, type LoopStep,
} from '../scene/pianoMusic'

/** A note of a loop, for the screen: when it plays (on the screen's clock), its step, and its interval. */
export interface Bead { at: number; n: number; interval: number }
/** A sounding note, held or fading. Times are on the screen's clock (performance.now, in seconds). */
export interface Voice {
  key: string
  midi: number
  freq: number
  start: number
  /** When it was let go (its tail starts then), or null while held. */
  released: number | null
  /** Its tail's time constant (the tail lasts about 4x this). */
  tau: number
  seed: number
  figure: readonly LoopStep[]
  beads: Bead[]
  gone: boolean
  // the sound
  out: GainNode | null
  filter: BiquadFilterNode | null
  sources: AudioScheduledSourceNode[]
  audioStart: number
  peak: () => number
}

const SAMPLES = '/media/piano/samples/'
const VOLUME = 0.5
const MAX_VOICES = 10
const AMBIENCE_LEVEL: Record<Ambience, number> = { water: 0.05, wind: 0.05, breeze: 0.035, waves: 0.07 }

export const screenClock = () => performance.now() / 1000

let ctx: AudioContext | null = null
let T: typeof ToneLib | null = null
let padBus: GainNode | null = null // pads and breath go here
let out: GainNode | null = null // after the effects: ambience and the detent click join here
let noise: AudioBuffer | null = null
let fx: { bus: ToneLib.Gain; dry: ToneLib.Gain; wet: ToneLib.Gain; echoSend: ToneLib.Gain; echo: ToneLib.PingPongDelay; reverb: ToneLib.Reverb } | null = null
const samplers: Partial<Record<Instrument, { sampler: ToneLib.Sampler; panner: ToneLib.Panner }>> = {}
let samplesReady = false
let keysGain: ToneLib.Gain | null = null // the recorded instruments of the keys go here (the pads: padBus)
// The two brass knobs: how loud the loop is, and how loud the keys are (0-1).
let loopVolume = 0.7
let keysVolume = 0.8
const loopLevel = () => loopVolume ** 2 * 2
const keysLevel = () => keysVolume ** 2 * 1.5

const allVoices: Voice[] = []
const held = new Map<string, Voice>()
let landscapeIndex = 0
let loopIndex = 0
let lastBeat = -9
let stepN = 0
let listening = false

const landscape = () => LANDSCAPES[landscapeIndex] ?? LANDSCAPES[0]!
/**
 * A note's pitch, tuned to the loop: the recorded loops aren't all exactly at concert pitch (A = 440
 * Hz), so the keys, their pads and their loops play the same few cents sharp or flat as the loop does.
 */
const hzOf = (midi: number) => 440 * 2 ** ((midi - 69 + backingLoop().tuning / 100) / 12)
const backingLoop = () => LOOPS[loopIndex] ?? LOOPS[0]!
const tone = () => TONES[backingLoop().tone] ?? TONES[0]!
const atmos = () => landscape().atmos
const tau = () => 0.3 + 0.85 * atmos()
const cutoff = () => 700 + 2300 * atmos()

// ── Setting up ──

function audio(): AudioContext | null {
  if (ctx) return ctx
  const Ctx = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  if (!Ctx) return null
  ctx = new Ctx()
  out = ctx.createGain()
  out.gain.value = VOLUME
  out.connect(ctx.destination)
  padBus = ctx.createGain()
  padBus.gain.value = keysLevel()
  padBus.connect(out) // until Tone's effects are here
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  void import('tone').then(withTone).catch(() => {
    /* no Tone: the pads still play */
  })
  return ctx
}

function withTone(lib: typeof ToneLib) {
  if (T || !ctx || !padBus || !out) return
  T = lib
  T.setContext(ctx)
  const limiter = new T.Limiter(-8).toDestination()
  const post = new T.Gain(VOLUME).connect(limiter)
  const bus = new T.Gain(1)
  const dry = new T.Gain(0.85).connect(post)
  const reverb = new T.Reverb({ decay: 2.2 + 3.5 * atmos(), preDelay: 0.02, wet: 1 }).connect(post)
  const wet = new T.Gain(0.4).connect(reverb)
  const echo = new T.PingPongDelay({ delayTime: '8n.', feedback: 0.3, wet: 1 })
  const echoTone = new T.Filter(1700, 'lowpass')
  echo.connect(echoTone)
  echoTone.connect(reverb)
  echoTone.connect(post)
  const echoSend = new T.Gain(0.15).connect(echo)
  bus.fan(dry, wet, echoSend)
  // the hand-built pads now run through the effects, and the ambience through the limiter
  padBus.disconnect()
  T.connect(padBus, bus)
  out.disconnect()
  out.gain.value = 1
  T.connect(out, post)
  fx = { bus, dry, wet, echoSend, echo, reverb }
  applyLandscape(true)
  // the loop goes straight to the end of the chain: it's a finished recording, it has its own space
  loopsGain = new T.Gain(loopLevel()).connect(post)
  keysGain = new T.Gain(keysLevel()).connect(bus)
  for (const [inst, map] of Object.entries(INSTRUMENTS) as [Instrument, Record<string, string>][]) {
    const panner = new T.Panner(0).connect(keysGain)
    const urls = Object.fromEntries(Object.entries(map).map(([note, file]) => [note, `${file}.m4a`]))
    samplers[inst] = { sampler: new T.Sampler({ urls, baseUrl: SAMPLES, release: 1.4 }).connect(panner), panner }
  }
  deckOf(backingLoop()) // its recording starts on its way now
  void T.loaded().then(() => {
    samplesReady = true
  })
  const transport = T.getTransport()
  transport.bpm.value = backingLoop().bpm
  transport.scheduleRepeat(step, '16n')
  if (listening) {
    transport.start()
    if (held.size || playRequested) startBacking() // a key (or the play light) came while Tone was still on its way
  }
}

function applyLandscape(now = false) {
  if (!fx || !ctx) return
  const v = atmos()
  const k = now ? 0.01 : 0.3
  fx.dry.gain.rampTo(0.85 - 0.3 * v, k)
  fx.wet.gain.rampTo(0.18 + 0.75 * v, k)
  fx.echoSend.gain.rampTo(0.04 + 0.3 * v, k)
  fx.echo.feedback.rampTo(0.18 + 0.37 * v, k)
  if (Math.abs(fx.reverb.decay as number - (2.2 + 3.5 * v)) > 0.3) fx.reverb.decay = 2.2 + 3.5 * v
  for (const vc of held.values()) vc.filter?.frequency.setTargetAtTime(vc.peak(), ctx.currentTime, 0.3)
}

// ── Notes ──

function noteOn(key: string) {
  const c = audio()
  const t0 = screenClock()
  if (held.has(key)) release(held.get(key)!)
  const midi = midiOf(key) + backingLoop().transpose // the white keys play the loop's scale
  const freq = hzOf(midi)
  const vc: Voice = {
    key, midi, freq, start: t0, released: null, tau: tau(), seed: Math.random() * 6.28,
    figure: FIGURES[Math.floor(Math.random() * FIGURES.length)]!, beads: [], gone: false,
    out: null, filter: null, sources: [], audioStart: 0, peak: () => cutoff() * Math.min(1.5, 0.75 + freq / 900),
  }
  allVoices.push(vc)
  held.set(key, vc)
  startBacking()
  const sounding = allVoices.filter((v) => !v.gone && v.out)
  if (sounding.length >= MAX_VOICES) release(sounding[0]!, 0.08)
  if (!c || !padBus || !noise) return
  if (c.state === 'suspended') void c.resume()
  void T?.start()
  const t = c.currentTime
  vc.audioStart = t
  const T0 = tone()
  // a recorded instrument for the strike, when the recordings are in; the pad sits softer under it
  const sampled = !!(T0.strike && playSample(T0.strike[0], midi + T0.strike[1], t, T0.strike[2], (Math.max(0, midi - 60) / 12 - 0.5) * 0.6))
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.5, t + 0.35)
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = 0.7
  filter.frequency.setValueAtTime(240, t)
  filter.frequency.setTargetAtTime(vc.peak(), t, 0.45)
  filter.frequency.setTargetAtTime(vc.peak() * 1.6, t + 2.5, 4) // held, it slowly opens up
  const lfo = c.createOscillator()
  lfo.frequency.value = 0.17 + Math.random() * 0.08
  const wobble = c.createGain()
  wobble.gain.value = 4
  lfo.connect(wobble)
  const sweep = c.createGain()
  sweep.gain.value = vc.peak() * 0.12
  lfo.connect(sweep).connect(filter.frequency)
  for (const [type, ratio, detune, level] of T0.pad) {
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = freq * ratio
    o.detune.value = detune
    wobble.connect(o.detune)
    const g = c.createGain()
    g.gain.value = level * (sampled ? 0.55 : 1)
    o.connect(g).connect(filter)
    o.start(t)
    vc.sources.push(o)
  }
  const sub = c.createOscillator() // ...and deepens: an octave below swells in
  sub.frequency.value = freq / 2
  const subGain = c.createGain()
  subGain.gain.setValueAtTime(0, t)
  subGain.gain.setTargetAtTime(0.22, t + 1.2, 1.6)
  sub.connect(subGain).connect(filter)
  sub.start(t)
  const breath = c.createBufferSource()
  breath.buffer = noise
  breath.loop = true
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = Math.min(9000, freq * 3)
  band.Q.value = T0.airQ
  const breathGain = c.createGain()
  breathGain.gain.value = T0.air
  breath.connect(band).connect(breathGain).connect(gain)
  breath.start(t, Math.random())
  lfo.start(t)
  vc.sources.push(sub, breath, lfo)
  filter.connect(gain).connect(padBus)
  vc.out = gain
  vc.filter = filter
}

function release(vc: Voice, fast?: number) {
  if (vc.released !== null) return
  if (held.get(vc.key) === vc) held.delete(vc.key)
  const t0 = screenClock()
  vc.tau = fast ?? tau()
  if (!ctx || !vc.out) {
    vc.released = t0
    return
  }
  const t = ctx.currentTime
  const at = Math.max(t, vc.audioStart + (fast ? 0 : 0.5)) // a tap still blooms for half a second
  vc.released = t0 + (at - t)
  vc.out.gain.cancelScheduledValues(at)
  vc.out.gain.setTargetAtTime(0, at, vc.tau)
  for (const s of vc.sources) {
    try {
      s.stop(at + vc.tau * 7)
    } catch {
      /* already stopping */
    }
  }
  const first = vc.sources[0]
  const out = vc.out
  if (first) first.onended = () => out.disconnect()
}

function playSample(inst: Instrument, midi: number, at: number, level: number, pan = 0) {
  const s = samplers[inst]
  if (!T || !samplesReady || !s || !s.sampler.loaded) return false
  s.panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), at)
  s.sampler.triggerAttackRelease(hzOf(midi), 2.4, at, Math.min(1, level * 1.6))
  return true
}

/** Each sixteenth (called by Tone's Transport with the exact audio time). */
function step(time: number) {
  if (!ctx) return
  const at = screenClock() + (time - ctx.currentTime)
  if (stepN % 2 === 0) {
    // a held note's own loop moves in eighths
    const e = stepN / 2
    for (const vc of held.values()) {
      const interval = loopInterval(vc.figure, e, at - vc.start)
      if (interval === null || Math.random() < 0.08) continue // now and then a step rests
      const iv = interval + (Math.random() < 0.1 ? 12 : 0)
      vc.beads.push({ at, n: e, interval: iv })
      lastBeat = at
      const [inst, up, level] = tone().loop
      let m = vc.midi + iv + up
      while (m > 96) m -= 12
      const lv = (e % 4 === 0 ? 1 : 0.7) * level * (0.8 + Math.random() * 0.4) * (backing.on ? 0.55 : 1)
      playSample(inst, m, time, lv, (e % 2 ? 0.45 : -0.45) * (0.5 + Math.random() * 0.5))
    }
  }
  backingStep(time, at)
  stepN++
}

// ── The backing loop ──
// A recorded loop (src/scene/piano-loops.json) plays on a Tone.js Player, started on a beat after
// the first key, with the Transport set to its exact tempo so the held notes' loops and the screen
// keep its time. A new loop comes in on the next bar line. Once started it keeps going, through any
// pause in the playing, until the close-up closes (the LOOP knob turns it down).

/** A drum hit or a chord change of the backing loop, for the screen (on its clock). */
export type BackingEvent = { at: number; kind: 'kick' | 'snare' | 'hat' } | { at: number; kind: 'chord'; pc: number }
const events: BackingEvent[] = []
const LOOP_FILES = '/media/piano/loops/'
type Deck = { player: ToneLib.Player; fader: ToneLib.Gain; loop: BackingLoop }
const decks = new Map<string, Deck>()
let loopsGain: ToneLib.Gain | null = null
const backing: { on: boolean; from: number; next: number | null; deck: Deck | null; starting: boolean } = {
  on: false, from: Infinity, next: null, deck: null, starting: false,
}

/** A loop's player, made (and its recording fetched) the first time it's needed. */
function deckOf(loop: BackingLoop): Deck | null {
  if (!T || !loopsGain) return null
  let d = decks.get(loop.id)
  if (!d) {
    const fader = new T.Gain(0).connect(loopsGain)
    const player = new T.Player({ url: LOOP_FILES + loop.file, loop: true }).connect(fader)
    d = { player, fader, loop }
    decks.set(loop.id, d)
  }
  return d
}

function play(deck: Deck, time: number) {
  const { player, fader, loop } = deck
  // (an encoder may leave a few milliseconds of silence before the music: skip them)
  const length = player.buffer.duration
  const lead = Math.max(0, Math.min(0.1, length - loop.seconds))
  player.loopStart = lead
  player.loopEnd = Math.min(length, lead + loop.seconds)
  player.start(time, lead)
  fader.gain.cancelScheduledValues(time)
  fader.gain.setValueAtTime(0, time)
  fader.gain.linearRampToValueAtTime(1, time + 0.03)
}
function fadeOut(deck: Deck, time: number, over: number) {
  deck.fader.gain.cancelScheduledValues(time)
  deck.fader.gain.setValueAtTime(deck.fader.gain.getValueAtTime(time), time)
  deck.fader.gain.linearRampToValueAtTime(0, time + over)
  deck.player.stop(time + over + 0.02)
}

// The orange light: the loop's play/pause. Until it's pressed, the loop starts with the first key;
// paused, it stays quiet (keys and all) until it's pressed again.
let paused = false
const loopListeners = new Set<() => void>()
const told = () => loopListeners.forEach((l) => l())

function startBacking() {
  if (backing.on || paused) return
  if (!deckOf(backingLoop())) return
  backing.on = true
  backing.starting = true
  told()
  backing.deck = null
  backing.from = Math.ceil((stepN + 1) / 4) * 4 // on the next beat
}

function stopBacking() {
  if (backing.deck && T) fadeOut(backing.deck, T.now(), 0.4)
  backing.on = false
  backing.starting = false
  backing.next = null
  backing.deck = null
  backing.from = Infinity
  told()
}

function backingStep(time: number, at: number) {
  if (!backing.on || !T || stepN < backing.from) return
  const transport = T.getTransport()
  if (backing.starting) {
    const deck = deckOf(backingLoop())
    if (!deck?.player.loaded) {
      backing.from = stepN + 4 // still on its way: try again on the next beat
      return
    }
    backing.starting = false
    backing.deck = deck
    backing.from = stepN
    play(deck, time)
  }
  // a new loop comes in on the bar line (once its recording is here)
  if (backing.next !== null && (stepN - backing.from) % 16 === 0) {
    const nextLoop = LOOPS[backing.next]!
    const deck = deckOf(nextLoop)
    if (deck?.player.loaded) {
      if (backing.deck) fadeOut(backing.deck, time, 0.05)
      loopIndex = backing.next
      backing.next = null
      backing.from = stepN
      backing.deck = deck
      transport.bpm.setValueAtTime(nextLoop.bpm, time)
      play(deck, time)
    }
  }
  const L = backing.deck?.loop
  if (!L) return
  const k = stepN - backing.from
  const hit = loopStep(L, k)
  if (hit.chord !== null) events.push({ at, kind: 'chord', pc: hit.chord })
  if (hit.kick) events.push({ at, kind: 'kick' })
  if (hit.snare) events.push({ at, kind: 'snare' })
  if (hit.hat) events.push({ at, kind: 'hat' })
}

// ── Ambience: each landscape's quiet bed, made from shaped noise ──

let bed: { kind: Ambience; gain: GainNode; stop: () => void } | null = null
function setAmbience(kind: Ambience | null) {
  if (!ctx || !out || !noise) return
  if (bed && bed.kind === kind) return
  if (bed) {
    const old = bed
    old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5)
    window.setTimeout(old.stop, 3000)
    bed = null
  }
  if (!kind) return
  const c = ctx
  const t = c.currentTime
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, t)
  gain.gain.setTargetAtTime(AMBIENCE_LEVEL[kind], t + 0.2, 1.4)
  gain.connect(out)
  const sources: AudioScheduledSourceNode[] = []
  const src = c.createBufferSource()
  src.buffer = noise
  src.loop = true
  sources.push(src)
  const swell = (rate: number, depth: number, target: AudioParam) => {
    const l = c.createOscillator()
    l.frequency.value = rate
    const d = c.createGain()
    d.gain.value = depth
    l.connect(d).connect(target)
    sources.push(l)
  }
  const filter = (type: BiquadFilterType, f: number, q: number) => {
    const b = c.createBiquadFilter()
    b.type = type
    b.frequency.value = f
    b.Q.value = q
    return b
  }
  const g = c.createGain()
  if (kind === 'waves') {
    const lp = filter('lowpass', 650, 0.4)
    g.gain.value = 0.55
    src.connect(lp).connect(g).connect(gain)
    swell(0.11, 0.45, g.gain)
    swell(0.07, 250, lp.frequency)
  } else if (kind === 'wind') {
    const bp = filter('bandpass', 480, 0.9)
    g.gain.value = 0.6
    src.connect(bp).connect(g).connect(gain)
    swell(0.06, 280, bp.frequency)
    swell(0.13, 0.35, g.gain)
  } else if (kind === 'breeze') {
    g.gain.value = 0.5
    src.connect(filter('highpass', 700, 0.5)).connect(filter('lowpass', 2600, 0.5)).connect(g).connect(gain)
    swell(0.09, 0.35, g.gain)
  } else {
    g.gain.value = 0.35 // water lapping softly
    src.connect(filter('lowpass', 380, 0.4)).connect(g).connect(gain)
    swell(0.2, 0.2, g.gain)
  }
  for (const s of sources) s.start(t)
  bed = {
    kind,
    gain,
    stop: () => {
      for (const s of sources) {
        try {
          s.stop()
        } catch {
          /* stopped */
        }
      }
      gain.disconnect()
    },
  }
}

/** A small detent click, for the knobs. */
function click() {
  if (!ctx || !out || !noise || ctx.state !== 'running') return
  const t = ctx.currentTime
  const s = ctx.createBufferSource()
  s.buffer = noise
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2500
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.25, t)
  g.gain.setTargetAtTime(0, t, 0.006)
  s.connect(hp).connect(g).connect(out)
  s.start(t, Math.random())
  s.stop(t + 0.05)
}

// ── For the close-up and the screen ──

/** Every sounding note, held or fading (the screen draws from these). Gone ones are dropped here. */
export function voices(): readonly Voice[] {
  const t = screenClock()
  for (let i = allVoices.length - 1; i >= 0; i--) {
    const v = allVoices[i]!
    if (v.released !== null && t - v.released > v.tau * 8) {
      v.gone = true
      allVoices.splice(i, 1)
    }
  }
  return allVoices
}
/** When the last loop note played (the screen's fireflies flash on it). */
export const beat = () => lastBeat
/** The backing loop's drum hits and chord changes since the last call (on the screen's clock; often a moment ahead). */
export const backingEvents = () => events.splice(0)
/** Whether a backing loop is playing. */
export const jamming = () => backing.on
let playRequested = false
/** Hear when the loop starts or stops (the orange light shows it). */
export function onLoopChange(listener: () => void) {
  loopListeners.add(listener)
  return () => void loopListeners.delete(listener)
}
/** Whether the loop is on: playing, or about to start with the next key (the orange light is lit). */
export const loopOn = () => !paused
/** The orange light pressed: pause the loop (lit: it goes off), or play it again (off: it lights). */
export function toggleLoop() {
  if (!paused) {
    paused = true
    playRequested = false
    stopBacking()
    told()
    return
  }
  paused = false
  told()
  playRequested = true
  const c = audio()
  if (c?.state === 'suspended') void c.resume()
  void T?.start()
  startBacking()
}

export const settings = () => ({ landscape: landscapeIndex, loop: backing.next ?? loopIndex, loopVolume, keysVolume })
export function setLandscape(index: number) {
  if (index === landscapeIndex) return
  landscapeIndex = index
  applyLandscape()
  if (listening && held.size + allVoices.length > 0) setAmbience(landscape().ambience)
  click()
}
/** Choose the backing loop: at once if none is playing, else on the next bar line. */
export function setLoop(index: number) {
  if (index === (backing.next ?? loopIndex)) return
  const loop = LOOPS[index]
  if (!loop) return
  deckOf(loop) // fetch it now, so it's here by the bar line
  if (backing.on && !backing.starting) {
    backing.next = index === loopIndex ? null : index
    return
  }
  loopIndex = index
  T?.getTransport().bpm.setValueAtTime(loop.bpm, T.now())
}
/** Turn one of the brass knobs: the loop's volume or the keys' (0-1). */
export function setVolume(which: 'loop' | 'keys', v: number) {
  const level = Math.max(0, Math.min(1, v))
  if (which === 'loop') loopVolume = level
  else keysVolume = level
  if (ctx && padBus) padBus.gain.setTargetAtTime(keysLevel(), ctx.currentTime, 0.03)
  keysGain?.gain.rampTo(keysLevel(), 0.05)
  loopsGain?.gain.rampTo(loopLevel(), 0.05)
  click()
}

/**
 * Let the piano be heard while its close-up is open: each note struck sounds, and stops when its
 * key comes up; the ambience fades in after the first key. Returns a way to stop (the close-up
 * closing): everything fades out and the radio comes back up.
 */
export function listenTo(piano: Piano): () => void {
  listening = true
  audio()
  if (T) T.getTransport().start()
  const radio = roomRadio()
  radio.duck(true)
  let down = new Set(piano.keys())
  const offNote = piano.onNote((key) => {
    noteOn(key)
    setAmbience(landscape().ambience)
  })
  const offKeys = piano.subscribe(() => {
    const now = piano.keys()
    for (const key of down) if (!now.has(key)) {
      const vc = held.get(key)
      if (vc) release(vc)
    }
    down = new Set(now)
  })
  return () => {
    listening = false
    offNote()
    offKeys()
    for (const vc of [...held.values()]) release(vc)
    setAmbience(null)
    stopBacking()
    paused = false // (next time it's opened, the first key starts the loop again)
    playRequested = false
    if (T) T.getTransport().stop()
    radio.duck(false)
  }
}
