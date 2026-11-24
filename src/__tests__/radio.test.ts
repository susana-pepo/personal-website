import { describe, expect, it } from 'vitest'
import { clock, FOCUS_SECONDS, focusLeft, nextIndex, rainAudible, rainStarts, readPrefs } from '../audio/radio'
import { PLAYLIST } from '../audio/playlist'

describe('room radio', () => {
  it('moves to the next track and wraps round', () => {
    expect(nextIndex(0, 5)).toBe(1)
    expect(nextIndex(4, 5)).toBe(0)
    expect(nextIndex(0, 0)).toBe(0)
  })

  it('plays rain only while the radio is on, the switch is on and it rains', () => {
    expect(rainAudible({ status: 'playing', rainOn: true, raining: true })).toBe(true)
    expect(rainAudible({ status: 'loading', rainOn: true, raining: true })).toBe(true)
    expect(rainAudible({ status: 'paused', rainOn: true, raining: true })).toBe(false)
    expect(rainAudible({ status: 'idle', rainOn: true, raining: true })).toBe(false)
    expect(rainAudible({ status: 'done', rainOn: true, raining: true })).toBe(false)
    expect(rainAudible({ status: 'playing', rainOn: false, raining: true })).toBe(false)
    expect(rainAudible({ status: 'playing', rainOn: true, raining: false })).toBe(false)
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
    expect(readPrefs(null, 5)).toEqual({ rainOn: true, index: 0 })
    expect(readPrefs('{"rainOn":false,"index":3}', 5)).toEqual({ rainOn: false, index: 3 })
    expect(readPrefs('{"index":9}', 5)).toEqual({ rainOn: true, index: 0 })
    expect(readPrefs('{"index":1.5}', 5)).toEqual({ rainOn: true, index: 0 })
    expect(readPrefs('not json', 5)).toEqual({ rainOn: true, index: 0 })
  })

  it('overlaps each copy of the rain with the next by the crossfade', () => {
    expect(rainStarts(10, 21, 3, 3)).toEqual([10, 28, 46])
  })

  it('has a playable list of tracks', () => {
    expect(PLAYLIST.length).toBeGreaterThan(0)
    for (const t of PLAYLIST) {
      expect(t.src).toMatch(/^\/media\/audio\/radio\/[a-z0-9-]+\.m4a$/)
      expect(t.duration).toBeGreaterThan(60)
    }
  })
})
