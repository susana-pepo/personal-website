import { describe, expect, it } from 'vitest'
import { content } from '../content/content'
import {
  DEFAULT_WEATHER,
  SNOW_BOX,
  SNOW_LIGHT,
  WEATHERS,
  WEATHER_CHOICES,
  WEATHER_WORDS,
  RAINY_DAY,
  curveTable,
  dullMatrix,
  flakeAlpha,
  isWeather,
  makeFlake,
  makeFlakes,
  mixLight,
  seeded,
  skyMatrix,
  stepFlake,
  windAt,
} from '../scene/weather'
import { TIMES } from '../scene/windowViews'
import { easeInOut } from '../lib/motion'
import { optionForKey } from '../lib/radioGroup'

describe('weathers', () => {
  it('has clear, rain and snow, and starts in the painting’s rain', () => {
    expect(WEATHERS).toEqual(['clear', 'rain', 'snow'])
    expect(DEFAULT_WEATHER).toBe('rain')
    expect(WEATHER_CHOICES).toContain(DEFAULT_WEATHER)
  })

  it('offers only known weathers, in order', () => {
    for (const w of WEATHER_CHOICES) expect(WEATHERS).toContain(w)
    const order = WEATHER_CHOICES.map((w) => WEATHERS.indexOf(w))
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('has a name for the group and every weather', () => {
    expect(content.weather.label.length).toBeGreaterThan(0)
    for (const w of WEATHERS) expect(content.weather[w].length).toBeGreaterThan(0)
  })

  it('describes every weather in words for the scene', () => {
    for (const w of WEATHERS) {
      expect(WEATHER_WORDS[w].evening.length).toBeGreaterThan(0)
      expect(WEATHER_WORDS[w].outside).toMatch(/^Outside, .+\.$/)
    }
    expect(WEATHER_WORDS.rain.outside).toMatch(/rain/)
    expect(WEATHER_WORDS.snow.outside).toMatch(/snow/)
    expect(WEATHER_WORDS.clear.outside).not.toMatch(/rain|snow/)
  })

  it('recognises weather names and nothing else', () => {
    expect(isWeather('snow')).toBe(true)
    expect(isWeather('hail')).toBe(false)
    expect(isWeather(null)).toBe(false)
  })
})

describe('optionForKey', () => {
  const opts = ['a', 'b', 'c'] as const
  it('steps and wraps with the arrows', () => {
    expect(optionForKey(opts, 'a', 'ArrowRight')).toBe('b')
    expect(optionForKey(opts, 'c', 'ArrowDown')).toBe('a')
    expect(optionForKey(opts, 'b', 'ArrowLeft')).toBe('a')
    expect(optionForKey(opts, 'a', 'ArrowUp')).toBe('c')
  })

  it('jumps to the ends with Home and End', () => {
    expect(optionForKey(opts, 'b', 'Home')).toBe('a')
    expect(optionForKey(opts, 'b', 'End')).toBe('c')
  })

  it('ignores other keys, and steps from the start for an unknown current', () => {
    expect(optionForKey(opts, 'b', 'Enter')).toBeNull()
    expect(optionForKey(['x', 'y'], 'z', 'ArrowRight')).toBe('y')
    expect(optionForKey([], 'z', 'Home')).toBeNull()
  })

  it('works for the weather choices', () => {
    expect(optionForKey(WEATHER_CHOICES, 'clear', 'ArrowRight')).toBe(WEATHER_CHOICES[1])
    expect(optionForKey(WEATHERS, 'snow', 'ArrowRight')).toBe('clear')
  })
})

describe('snow', () => {
  it('makes the same flakes from the same seed', () => {
    expect(makeFlakes(5, seeded(7))).toEqual(makeFlakes(5, seeded(7)))
  })

  it('makes near flakes larger and faster than far ones, mostly far', () => {
    const flakes = makeFlakes(400, seeded(3))
    const far = flakes.filter((f) => f.z < 0.3)
    const near = flakes.filter((f) => f.z > 0.7)
    expect(far.length).toBeGreaterThan(near.length * 2)
    const avg = (fs: typeof flakes, k: 'r' | 'vy') => fs.reduce((s, f) => s + f[k], 0) / fs.length
    expect(avg(near, 'r')).toBeGreaterThan(avg(far, 'r') * 2)
    expect(avg(near, 'vy')).toBeGreaterThan(avg(far, 'vy'))
    for (const f of flakes) {
      expect(f.x).toBeGreaterThanOrEqual(0)
      expect(f.x).toBeLessThanOrEqual(SNOW_BOX.width)
      expect(f.presence).toBe(0)
    }
  })

  it('keeps the wind a gentle breeze that never turns against the fall', () => {
    for (let t = 0; t < 2000; t += 0.7) {
      const w = windAt(t)
      expect(w).toBeGreaterThan(0)
      expect(w).toBeLessThan(0.8)
    }
  })

  it('falls, drifts with the wind, and comes back in above the top', () => {
    const rand = seeded(11)
    const f = makeFlake(rand, 10)
    stepFlake(f, 0.5, 0, 1, rand)
    expect(f.y).toBeGreaterThan(10)
    f.y = SNOW_BOX.height + 200
    stepFlake(f, 0.016, 1, 1, rand)
    expect(f.y).toBeLessThan(0)
  })

  it('keeps a flake that drifts out of one side coming back in from the other', () => {
    const rand = seeded(5)
    const f = makeFlake(rand, 100)
    f.x = SNOW_BOX.width + f.r + 25
    stepFlake(f, 0.016, 0, 1, rand)
    expect(f.x).toBeLessThan(0)
  })

  it('fades flakes in when the snow starts and out when it stops, gradually', () => {
    const rand = seeded(9)
    const f = makeFlake(rand)
    f.threshold = 0.5
    stepFlake(f, 0.1, 0, 1, rand)
    expect(f.presence).toBeGreaterThan(0)
    expect(f.presence).toBeLessThan(1)
    for (let i = 0; i < 40; i++) stepFlake(f, 0.1, i * 0.1, 1, rand)
    expect(f.presence).toBe(1)
    // A flake above the intensity is not falling.
    stepFlake(f, 0.1, 5, 0.4, rand)
    expect(f.presence).toBeLessThan(1)
    for (let i = 0; i < 40; i++) stepFlake(f, 0.1, 5 + i * 0.1, 0.4, rand)
    expect(f.presence).toBe(0)
    expect(flakeAlpha(f)).toBe(0)
  })

  it('draws nearer flakes brighter', () => {
    const rand = seeded(1)
    const far = { ...makeFlake(rand), z: 0.05, spin: 0, presence: 1 }
    const near = { ...far, z: 0.95 }
    expect(flakeAlpha(near)).toBeGreaterThan(flakeAlpha(far))
    expect(flakeAlpha(near)).toBeLessThanOrEqual(1)
  })

  it('has a light for every time, and mixes between them', () => {
    for (const t of TIMES) expect(SNOW_LIGHT[t].rgb).toHaveLength(3)
    const half = mixLight(SNOW_LIGHT.dawn, SNOW_LIGHT.night, 0.5)
    expect(half.rgb[2]).toBeCloseTo((SNOW_LIGHT.dawn.rgb[2] + SNOW_LIGHT.night.rgb[2]) / 2)
    expect(mixLight(SNOW_LIGHT.dawn, SNOW_LIGHT.night, 1)).toEqual(SNOW_LIGHT.night)
  })
})

describe('a rainy day’s light', () => {
  const parse = (values: string) => values.split(' ').map(Number)
  const apply = (m: number[], rgb: [number, number, number]) =>
    [0, 1, 2, 3].map((r) => m[r * 5]! * rgb[0] + m[r * 5 + 1]! * rgb[1] + m[r * 5 + 2]! * rgb[2] + m[r * 5 + 3]! * 1 + m[r * 5 + 4]!)

  it('leaves colours as painted when nothing is dulled', () => {
    const m = parse(dullMatrix({ ...RAINY_DAY, saturation: 1, brightness: 1 }))
    expect(m).toHaveLength(20)
    expect(apply(m, [0.2, 0.5, 0.9]).map((v) => +v.toFixed(4))).toEqual([0.2, 0.5, 0.9, 1])
  })

  it('takes colour and sun out of everything but the sky', () => {
    const [r, g, b, a] = apply(parse(dullMatrix(RAINY_DAY)), [0.2, 0.6, 0.2])
    expect(g! - r!).toBeLessThan(0.4) // less green than painted
    expect(g).toBeLessThan(0.6)
    expect(b).toBeGreaterThan(0)
    expect(a).toBe(1)
  })

  it('turns blue sky into a soft grey, and only the sky', () => {
    const sky = parse(skyMatrix(RAINY_DAY))
    const [r, g, b, a] = apply(sky, [55 / 255, 161 / 255, 251 / 255])
    expect(a).toBeGreaterThanOrEqual(1) // fully sky
    expect(Math.max(r!, g!, b!) - Math.min(r!, g!, b!)).toBeLessThan(0.06) // nearly neutral
    expect(apply(sky, [52 / 255, 77 / 255, 48 / 255])[3]).toBeLessThanOrEqual(0) // leaves: not sky
    expect(apply(sky, [240 / 255, 238 / 255, 232 / 255])[3]).toBeLessThanOrEqual(0) // walls and clouds: not sky
  })

  it('rolls off the highlights without crushing the shadows', () => {
    const curve = parse(curveTable(RAINY_DAY))
    expect(curve[0]).toBeGreaterThanOrEqual(0)
    expect(curve.at(-1)).toBeLessThan(1)
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThan(curve[i - 1]!)
  })

  it('eases in and out', () => {
    expect(easeInOut(0)).toBe(0)
    expect(easeInOut(1)).toBe(1)
    expect(easeInOut(0.5)).toBeCloseTo(0.5)
    expect(easeInOut(0.1)).toBeLessThan(0.1)
    expect(easeInOut(2)).toBe(1)
  })
})
