import { describe, expect, it } from 'vitest'
import {
  clock,
  DEFAULT_PREFS,
  FOCUS_SECONDS,
  focusLeft,
  nextIndex,
  rainAudible,
  rainLevelOf,
  rainStarts,
  readPrefs,
  WINDOW_RAIN,
} from '../audio/radio'
import { STATIONS, stationById } from '../audio/playlist'
import { beatFrequencies, brownNoise } from '../audio/binaural'

describe('room radio', () => {
  it('moves to the next track and wraps round', () => {
    expect(nextIndex(0, 5)).toBe(1)
    expect(nextIndex(4, 5)).toBe(0)
    expect(nextIndex(0, 0)).toBe(0)
  })

  it('follows the window for rain until the visitor sets a level', () => {
    expect(rainLevelOf({ rainLevel: null, raining: true })).toBe(WINDOW_RAIN)
    expect(rainLevelOf({ rainLevel: null, raining: false })).toBe(0)
    expect(rainLevelOf({ rainLevel: 0.3, raining: false })).toBe(0.3)
    expect(rainLevelOf({ rainLevel: 0, raining: true })).toBe(0)
  })

  it('plays rain only while the radio is on and the rain is above zero', () => {
    expect(rainAudible({ status: 'playing', rainLevel: null, raining: true })).toBe(true)
    expect(rainAudible({ status: 'loading', rainLevel: 0.5, raining: false })).toBe(true)
    expect(rainAudible({ status: 'paused', rainLevel: 0.5, raining: true })).toBe(false)
    expect(rainAudible({ status: 'idle', rainLevel: 0.5, raining: true })).toBe(false)
    expect(rainAudible({ status: 'done', rainLevel: 0.5, raining: true })).toBe(false)
    expect(rainAudible({ status: 'playing', rainLevel: 0, raining: true })).toBe(false)
    expect(rainAudible({ status: 'playing', rainLevel: null, raining: false })).toBe(false)
  })

  it('counts a 25-minute focus session down to zero', () => {
    expect(FOCUS_SECONDS).toBe(1500)
    expect(clock(focusLeft(0))).toBe('25:00')
    expect(clock(focusLeft(378))).toBe('18:42')
    expect(focusLeft(FOCUS_SECONDS + 30)).toBe(0)
    expect(focusLeft(-5)).toBe(FOCUS_SECONDS)
  })

  it('formats the clock', () => {
    expect(clock(0)).toBe('0:00')
    expect(clock(65.9)).toBe('1:05')
    expect(clock(223)).toBe('3:43')
    expect(clock(Number.NaN)).toBe('0:00')
    expect(clock(-4)).toBe('0:00')
  })

  it('reads saved preferences defensively', () => {
    expect(readPrefs(null)).toEqual(DEFAULT_PREFS)
    expect(readPrefs('not json')).toEqual(DEFAULT_PREFS)
    expect(readPrefs('{"station":"classical","index":3,"musicLevel":0.4,"rainLevel":0.2}')).toEqual({
      station: 'classical',
      index: 3,
      musicLevel: 0.4,
      rainLevel: 0.2,
    })
    // an unknown station, an index past the end, levels out of range
    expect(readPrefs('{"station":"jazz","index":9,"musicLevel":3,"rainLevel":-1}')).toEqual(DEFAULT_PREFS)
    // binaural has no tracks, so no index
    expect(readPrefs('{"station":"binaural","index":2}').index).toBe(0)
    // the earlier on/off rain switch
    expect(readPrefs('{"rainOn":false,"index":1}')).toEqual({ ...DEFAULT_PREFS, index: 1, rainLevel: 0 })
  })

  it('overlaps each copy of the rain with the next by the crossfade', () => {
    expect(rainStarts(10, 21, 3, 3)).toEqual([10, 28, 46])
  })

  it('has three stations, each with a Spotify playlist, and playable files', () => {
    expect(STATIONS.map((s) => s.id)).toEqual(['lofi', 'binaural', 'classical'])
    expect(stationById('classical').tracks.length).toBeGreaterThan(5)
    expect(stationById('binaural').tracks).toHaveLength(0)
    for (const station of STATIONS) {
      expect(station.spotify.url).toMatch(/^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]{22}$/)
      for (const t of station.tracks) {
        expect(t.src).toMatch(/^\/media\/audio\/(radio|classical)\/[a-z0-9-]+\.m4a$/)
        expect(t.duration).toBeGreaterThan(60)
      }
    }
  })

  it('makes the binaural tones a few hertz apart, over a gentle noise bed', () => {
    expect(beatFrequencies(200, 10)).toEqual({ left: 200, right: 210 })
    let seed = 1
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const noise = brownNoise(48000, random)
    expect(noise).toHaveLength(48000)
    expect(Math.max(...noise)).toBeLessThanOrEqual(1)
    expect(Math.min(...noise)).toBeGreaterThanOrEqual(-1)
  })
})
