/**
 * The piano computer's music and its rules, kept free of audio and the DOM so they can be tested:
 * each note's colour, where it acts in a landscape, the harmonic loops a held note grows, the keys'
 * tones, the four landscapes (the top knob) and the six backing loops (the bottom knob). The sound
 * itself is src/audio/pianoEngine.ts; the screen is src/scene/pianoScreen.ts.
 */
import { PIANO_KEYS } from './piano'
import loopData from './piano-loops.json'

/** The keys in pitch order, low to high (C4 ... C5). */
export const KEYS_BY_PITCH = [...PIANO_KEYS].sort((a, b) => a.midi - b.midi).map((k) => k.id)
const KIND = new Map(PIANO_KEYS.map((k) => [k.id, k.kind]))
const MIDI = new Map(PIANO_KEYS.map((k) => [k.id, k.midi]))
export const midiOf = (key: string) => MIDI.get(key) ?? 60
export const isBlack = (key: string) => KIND.get(key) === 'black'

/**
 * Each note's colour: Scriabin's colour keyboard (notes a fifth apart get neighbouring colours,
 * so what sounds good together looks good together), muted to night phosphor tones.
 */
export const NOTE_COLOURS: Readonly<Record<string, string>> = {
  C4: '#F08A6E', 'C#4': '#A88BEB', D4: '#F2C75C', 'D#4': '#E8A9A0', E4: '#7EC8E8', F4: '#D9667F',
  'F#4': '#A9CBF2', G4: '#F5A649', 'G#4': '#C7A6E8', A4: '#9CCB8F', 'A#4': '#EE8FB0', B4: '#6F9BE8', C5: '#F7B39E',
}
/** A pitch class's colour (0 = C), for notes the loops play outside the keyboard. */
export const colourOfPitchClass = (pc: number) => {
  const key = PIANO_KEYS.find((k) => k.midi % 12 === ((pc % 12) + 12) % 12 && k.id !== 'C5')
  return NOTE_COLOURS[key?.id ?? 'C4']!
}

export type Band = 'low' | 'mid' | 'high'
/** Where a note acts in a landscape: low keys on the ground or water, middle ones on the horizon, high ones in the sky. */
export function bandOf(key: string): Band {
  const i = KEYS_BY_PITCH.indexOf(key)
  return i <= 4 ? 'low' : i <= 9 ? 'mid' : 'high'
}
/** How far across the screen a key's things appear (0-1), following the keyboard. */
export const placeOf = (key: string) => 0.1 + (0.8 * Math.max(0, KEYS_BY_PITCH.indexOf(key))) / 12

// ── Harmonic loops ──

/** How long a note is held before its loop starts, and before each further layer of it joins. */
export const LOOP_AFTER = 0.9
export const LAYER_EVERY = 2.2
/** One step of a loop figure: semitones above the note, and the layer (0-2) it belongs to. */
export type LoopStep = readonly [interval: number, layer: number] | null
/** Five figures from a note's own harmonics (octave, fifth, ninth, two octaves...), eight steps each, in eighth notes. */
export const FIGURES: readonly (readonly LoopStep[])[] = [
  [[12, 0], null, [19, 1], null, [24, 0], [19, 2], [14, 1], null],
  [[7, 0], [12, 1], null, [19, 0], null, [12, 2], [24, 1], null],
  [[19, 0], null, [12, 1], [7, 2], [24, 0], null, [14, 1], [12, 2]],
  [[12, 0], [14, 2], [19, 1], null, [12, 0], null, [7, 1], [24, 2]],
  [[24, 0], null, [19, 1], [12, 2], null, [19, 0], null, [16, 2]],
]
/** The layers of a loop that have joined, after a note has been held this long (none before LOOP_AFTER). */
export const layersAfter = (held: number) => (held < LOOP_AFTER ? -1 : Math.min(2, Math.floor((held - LOOP_AFTER) / LAYER_EVERY)))
/** The interval a held note's loop plays on this step, or null (a rest, or a layer not joined yet). */
export function loopInterval(figure: readonly LoopStep[], step: number, held: number): number | null {
  const s = figure[step % figure.length]
  return s && s[1] <= layersAfter(held) ? s[0] : null
}

// ── Tones (each backing loop picks one for the keys) ──

export interface Tone {
  name: string
  /** The sustained body: [wave, ratio to the note, detune in cents, level]. */
  pad: readonly (readonly [OscillatorType, number, number, number])[]
  /** Breath: filtered noise around the note (level, filter Q). */
  air: number
  airQ: number
  /** The recorded instrument at the strike: [instrument, semitones up, level], or none. */
  strike: readonly [Instrument, number, number] | null
  /** The recorded instrument the loops play: [instrument, semitones up, level]. */
  loop: readonly [Instrument, number, number]
}
export type Instrument = 'chime' | 'glock' | 'kalimba' | 'vibes' | 'marimba'
export const TONES: readonly Tone[] = [
  { name: 'Glass', pad: [['sine', 1, 0, 0.22], ['triangle', 0.5, 0, 0.18], ['sine', 2, 3, 0.05]], air: 0.04, airQ: 6, strike: ['chime', 0, 0.55], loop: ['chime', 12, 0.5] },
  { name: 'Warm', pad: [['sawtooth', 1, -7, 0.15], ['sawtooth', 1, 7, 0.15], ['triangle', 0.5, 0, 0.24], ['sine', 1, 0, 0.22]], air: 0.07, airQ: 6, strike: ['vibes', 0, 0.5], loop: ['marimba', 0, 0.55] },
  { name: 'Music box', pad: [['sine', 1, 0, 0.1]], air: 0.02, airQ: 6, strike: ['glock', 12, 0.45], loop: ['kalimba', 12, 0.55] },
  { name: 'Air', pad: [['sine', 1, 0, 0.16], ['sine', 2, 4, 0.05]], air: 0.24, airQ: 2.5, strike: ['chime', 0, 0.45], loop: ['chime', 12, 0.3] },
]
/** Each instrument's recordings and the note each was played at (public/media/piano/samples). */
export const INSTRUMENTS: Readonly<Record<Instrument, Readonly<Record<string, string>>>> = {
  chime: { C4: 'chime_C4', C5: 'chime_C5' },
  glock: { C5: 'glock_C5', C6: 'glock_C6' },
  kalimba: { A4: 'kalimba_A4' },
  vibes: { A4: 'vibes_A4' },
  marimba: { C4: 'marimba_C4' },
}

// ── Landscapes (the top knob) ──

export type LandscapeId = 'lake' | 'peaks' | 'dunes' | 'sea'
export type Ambience = 'water' | 'wind' | 'breeze' | 'waves'
export interface Landscape {
  id: LandscapeId
  name: string
  /** How much space the sound has here (reverb and echo, 0-1). */
  atmos: number
  ambience: Ambience
}
export const LANDSCAPES: readonly Landscape[] = [
  { id: 'lake', name: 'Lake', atmos: 0.6, ambience: 'water' },
  { id: 'peaks', name: 'Peaks', atmos: 0.8, ambience: 'wind' },
  { id: 'dunes', name: 'Dunes', atmos: 0.5, ambience: 'breeze' },
  { id: 'sea', name: 'Sea', atmos: 0.7, ambience: 'waves' },
]

// ── Backing loops (chosen on the Loop dial) ──
//
// Recorded backing tracks to jam over, from Mixkit (mixkit.co, free under the Mixkit License; the
// close-up credits each one's musician as it plays), all at concert pitch and mostly groove and chords,
// so there's room to play over them. Each is an organic loop: one stretch of the track played straight
// through, 16 or 24 bars in its own form (a vamp, two phrases taking turns, a progression with a
// contrasting middle...), cut where its end leads back into its start like any other bar line, by
// scripts/piano-loops/form.py, which also measured each one's tempo, key, chords and drum hits
// (piano-loops.json). The keyboard follows the loop's key (its white keys play the loop's scale, so
// whatever you play fits) and its tuning (within a few cents of A = 440 Hz).


export interface BackingLoop {
  id: string
  /** The track it was cut from, and who made it (for its credit). */
  name: string
  artist: string
  /** Its recording, in public/media/piano/loops. */
  file: string
  /** Its tempo, exactly: `bars` bars of 4/4 in `seconds`. */
  bpm: number
  bars: number
  seconds: number
  key: string
  /** Semitones that bring the keyboard's C major to the loop's key (its relative major). */
  transpose: number
  /** How far the recording sits from concert pitch (A = 440 Hz), in cents: the keys play that far off too. */
  tuning: number
  /** Which of TONES the keys take on over it. */
  tone: number
  /** Each bar's chord root (pitch class), for the screen's colour. */
  chords: number[]
  /** Its form, phrase by phrase (four bars each): 'A A A A', 'A B A B'... */
  form: string
  /** Its drum hits, on its sixteenths (16 a bar), for the screen. */
  kick: number[]
  snare: number[]
  hat: number[]
}
export const LOOPS: readonly BackingLoop[] = loopData.loops
export const LOOP_SOURCE = loopData.source

/** How many sixteenths a loop lasts before it comes round again. */
export const loopSteps = (loop: BackingLoop) => loop.bars * 16
/** One sixteenth of a loop, in seconds. */
export const stepSeconds = (loop: BackingLoop) => loop.seconds / loopSteps(loop)
/** What a loop does on one of its sixteenths (counted from its start, round and round): its drum hits, and its chord at a bar line. */
export function loopStep(loop: BackingLoop, step: number) {
  const n = loopSteps(loop)
  const s = ((step % n) + n) % n
  return {
    kick: loop.kick.includes(s),
    snare: loop.snare.includes(s),
    hat: loop.hat.includes(s),
    chord: s % 16 === 0 ? (loop.chords[s / 16] ?? null) : null,
  }
}
