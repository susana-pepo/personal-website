import { describe, expect, it } from 'vitest'
import { RAIN, RAIN_LIGHT, leanAt, makeRain, mixRainLight, stepStreak, streakAlpha } from '../scene/rain'
import { seeded } from '../scene/weather'

const W = 957
const H = 695

describe('rain', () => {
  it('has many fine far streaks and a few near ones, drawn far first', () => {
    const streaks = makeRain(seeded(1), W, H)
    expect(streaks).toHaveLength(RAIN.far + RAIN.mid + RAIN.near)
    for (let i = 1; i < streaks.length; i++) expect(streaks[i]!.z).toBeGreaterThanOrEqual(streaks[i - 1]!.z)
    const far = streaks.filter((s) => s.z < 0.3)
    const near = streaks.filter((s) => s.z >= 0.7)
    const avg = (list: typeof streaks, key: 'length' | 'speed' | 'width') => list.reduce((a, s) => a + s[key], 0) / list.length
    expect(avg(near, 'length')).toBeGreaterThan(avg(far, 'length'))
    expect(avg(near, 'speed')).toBeGreaterThan(avg(far, 'speed'))
    expect(avg(near, 'width')).toBeGreaterThan(avg(far, 'width'))
  })

  it('falls calmly: no streak crosses the window in under half a second', () => {
    for (const s of makeRain(seeded(2), W, H)) expect(H / s.speed).toBeGreaterThan(0.5)
  })

  it('leans gently, and the wind only swings it a little', () => {
    for (let t = 0; t < 600; t += 0.37) {
      const lean = leanAt(t)
      expect(lean).toBeGreaterThan(RAIN.lean - RAIN.gust - 1e-9)
      expect(lean).toBeLessThan(RAIN.lean + RAIN.gust + 1e-9)
    }
  })

  it('falls down and along the lean, and starts again above the window', () => {
    const rand = seeded(3)
    const [s] = makeRain(rand, W, H)
    const y = s!.y
    stepStreak(s!, 0.1, 0.2, 1, rand, W, H)
    expect(s!.y).toBeGreaterThan(y)
    s!.y = H + s!.length + 1
    stepStreak(s!, 0.016, 0.2, 1, rand, W, H)
    expect(s!.y).toBeLessThan(0)
  })

  it('sets in and eases off gradually', () => {
    const rand = seeded(4)
    const [s] = makeRain(rand, W, H)
    s!.threshold = 0.5
    stepStreak(s!, 0.2, 0.2, 1, rand, W, H)
    expect(s!.presence).toBeGreaterThan(0)
    expect(s!.presence).toBeLessThan(1)
    for (let i = 0; i < 20; i++) stepStreak(s!, 0.1, 0.2, 1, rand, W, H)
    expect(s!.presence).toBe(1)
    for (let i = 0; i < 20; i++) stepStreak(s!, 0.1, 0.2, 0, rand, W, H)
    expect(s!.presence).toBe(0)
    expect(streakAlpha(s!)).toBe(0)
  })

  it('takes the colour of each light, and mixes between them', () => {
    for (const light of Object.values(RAIN_LIGHT)) expect(light.alpha).toBeGreaterThanOrEqual(0.75) // never faint
    expect(mixRainLight(RAIN_LIGHT.dawn, RAIN_LIGHT.night, 1)).toEqual(RAIN_LIGHT.night)
  })
})
