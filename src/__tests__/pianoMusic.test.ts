import { describe, expect, it } from 'vitest'
import art from '../scene/piano-landscapes.json'
import { PIANO_KNOBS, PIANO_SIZE } from '../scene/piano'
import {
  FIGURES, INSTRUMENTS, KEYS_BY_PITCH, LANDSCAPES, LAYER_EVERY, LOOPS, LOOP_AFTER, LOOP_SOURCE, NOTE_COLOURS, TONES,
  bandOf, colourOfPitchClass, layersAfter, loopInterval, loopStep, loopSteps, placeOf, stepSeconds,
} from '../scene/pianoMusic'
import { textPixels, textWidth } from '../scene/pixelFont'

const FILES = new Set(Object.keys(import.meta.glob('/public/media/piano/**/*.{m4a,png}')).map((p) => p.replace(/^\/public\//, '')))
const publicFile = (path: string) => FILES.has(path)

describe('the piano computer’s music', () => {
  it('gives every key a colour, and every pitch class one too', () => {
    for (const key of KEYS_BY_PITCH) expect(NOTE_COLOURS[key]).toMatch(/^#[0-9A-F]{6}$/i)
    for (let pc = 0; pc < 12; pc++) expect(colourOfPitchClass(pc)).toMatch(/^#/)
    expect(colourOfPitchClass(12)).toBe(NOTE_COLOURS.C4)
  })

  it('places low keys on the ground, middle keys on the horizon and high keys in the sky', () => {
    expect(['C4', 'C#4', 'D4', 'D#4', 'E4'].map(bandOf)).toEqual(['low', 'low', 'low', 'low', 'low'])
    expect(['F4', 'F#4', 'G4', 'G#4', 'A4'].map(bandOf)).toEqual(['mid', 'mid', 'mid', 'mid', 'mid'])
    expect(['A#4', 'B4', 'C5'].map(bandOf)).toEqual(['high', 'high', 'high'])
    expect(placeOf('C4')).toBeLessThan(placeOf('G4'))
    expect(placeOf('C5')).toBeCloseTo(0.9)
  })

  it('starts a held note’s loop after a moment, and fills it in layer by layer', () => {
    expect(layersAfter(LOOP_AFTER - 0.01)).toBe(-1)
    expect(layersAfter(LOOP_AFTER)).toBe(0)
    expect(layersAfter(LOOP_AFTER + LAYER_EVERY)).toBe(1)
    expect(layersAfter(LOOP_AFTER + LAYER_EVERY * 10)).toBe(2)
    const figure = FIGURES[0]!
    expect(loopInterval(figure, 0, 0.2)).toBeNull() // not yet
    expect(loopInterval(figure, 0, LOOP_AFTER)).toBe(12) // a first-layer step
    expect(loopInterval(figure, 2, LOOP_AFTER)).toBeNull() // a second-layer step, not joined yet
    expect(loopInterval(figure, 2, LOOP_AFTER + LAYER_EVERY)).toBe(19)
    expect(loopInterval(figure, 1, 99)).toBeNull() // a rest
  })

  it('keeps every loop figure to eight steps of the note’s own harmonics', () => {
    for (const f of FIGURES) {
      expect(f).toHaveLength(8)
      for (const s of f) if (s) expect([7, 12, 14, 16, 19, 24]).toContain(s[0])
    }
  })

  it('has organic loops to jam over, each crediting its musician, each its own length at its own exact tempo', () => {
    expect(LOOP_SOURCE.name).toBe('Mixkit')
    expect(LOOP_SOURCE.licenceUrl).toMatch(/^https:\/\/mixkit\.co\/license/)
    expect(LOOPS.length).toBeGreaterThanOrEqual(5)
    // both moods, in simple keys (none more than one sharp or flat)
    expect(LOOPS.some((l) => l.key.endsWith('major'))).toBe(true)
    expect(LOOPS.some((l) => l.key.endsWith('minor'))).toBe(true)
    for (const l of LOOPS) expect(['C major', 'G major', 'F major', 'A minor', 'E minor', 'D minor']).toContain(l.key)
    for (const l of LOOPS) {
      expect(publicFile(`media/piano/loops/${l.file}`)).toBe(true)
      expect(l.artist).toBeTruthy()
      expect(l.bpm).toBeGreaterThan(55)
      expect(l.bpm).toBeLessThan(120)
      expect([16, 24, 32]).toContain(l.bars) // whole 8-bar phrases, or 24
      expect((l.bars * 4 * 60) / l.bpm).toBeCloseTo(l.seconds, 2) // its bars of 4/4, exactly
      expect(stepSeconds(l) * loopSteps(l)).toBeCloseTo(l.seconds)
      expect(l.form.split(' ')).toHaveLength(l.bars / 4)
      expect(TONES[l.tone]).toBeTruthy()
      expect(l.chords).toHaveLength(l.bars)
      for (const s of [...l.kick, ...l.snare, ...l.hat]) expect(s >= 0 && s < loopSteps(l)).toBe(true)
    }
  })

  it('brings the keyboard into each loop’s key by at most half an octave', () => {
    for (const l of LOOPS) {
      expect(Math.abs(l.transpose)).toBeLessThanOrEqual(6)
      expect(Math.abs(l.tuning)).toBeLessThan(50) // (more than half a semitone off would be another key)
      const [tonic, mode] = l.key.split(' ')
      const pc = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].indexOf(tonic!)
      const major = mode === 'major' ? pc : (pc + 3) % 12
      expect(((l.transpose % 12) + 12) % 12).toBe(major) // C on the keyboard is the loop's (relative) major tonic
    }
  })

  it('tells the screen each loop’s drum hits and chords, step by step, round and round', () => {
    const l = LOOPS[0]!
    const first = l.kick[0]!
    expect(loopStep(l, first).kick).toBe(true)
    expect(loopStep(l, first + loopSteps(l)).kick).toBe(true)
    expect(loopStep(l, 0).chord).toBe(l.chords[0])
    expect(loopStep(l, 16).chord).toBe(l.chords[1])
    expect(loopStep(l, 1).chord).toBeNull()
  })

  it('spells its name in pixel letters, M and W wider than the rest', () => {
    expect(textWidth('PIANO')).toBe(3 + 3 + 3 + 4 + 3 + 4) // N is four wide
    expect(textWidth('JAM')).toBe(3 + 3 + 5 + 2)
    const px = textPixels('PIXEL JAM PIANO')
    expect(px.length).toBeGreaterThan(60)
    for (const [x, y] of px) expect(x >= 0 && x < textWidth('PIXEL JAM PIANO') && y >= 0 && y < 5).toBe(true)
  })

  it('has a recording for every instrument and percussion hit it plays', () => {
    for (const t of TONES) {
      if (t.strike) expect(INSTRUMENTS[t.strike[0]]).toBeTruthy()
      expect(INSTRUMENTS[t.loop[0]]).toBeTruthy()
    }
    for (const map of Object.values(INSTRUMENTS)) for (const file of Object.values(map)) expect(publicFile(`media/piano/samples/${file}.m4a`)).toBe(true)
  })

  it('has every landscape’s painted layers, at the screen’s size', () => {
    expect(art.size).toEqual([128, 95])
    for (const l of LANDSCAPES) {
      const a = (art as unknown as Record<string, { layers: string[]; horizon: number }>)[l.id]!
      expect(a.layers.length).toBeGreaterThan(5)
      expect(a.horizon).toBeGreaterThan(40)
      for (const file of a.layers) expect(publicFile(`media/piano/landscapes/${l.id}/${file}`)).toBe(true)
    }
  })

  it('knows where its two knobs are, on the right of the close-up', () => {
    expect(PIANO_KNOBS).toHaveLength(2)
    const [top, bottom] = PIANO_KNOBS
    expect(top!.cy).toBeLessThan(bottom!.cy)
    for (const k of PIANO_KNOBS) {
      expect(k.cx).toBeGreaterThan(PIANO_SIZE[0] * 0.7)
      expect(k.outer).toBeLessThan(k.r)
    }
  })
})
