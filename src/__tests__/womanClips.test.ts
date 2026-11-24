import { describe, expect, it } from 'vitest'
import { HOME_CLIP, WOMAN_BREATH, WOMAN_CLIPS, nextClip, restAfter, stillRest, type WomanClip } from '../scene/womanClips'

const clip = (name: string): WomanClip => ({ name, src: `/media/scene/woman/woman-${name}.webp`, ms: 6333 })
const ALL = ['writing', 'calm', 'page'].map(clip)
const randoms = Array.from({ length: 200 }, (_, i) => (i + 0.5) / 200)

describe('the woman clips', () => {
  it('starts every visit with the writing clip, whose first frame is the still', () => {
    expect(HOME_CLIP.name).toBe('writing')
    for (const c of WOMAN_CLIPS) {
      expect(c.src).toBe(`/media/scene/woman/woman-${c.name}.webp`)
      expect(c.ms).toBeGreaterThan(5000)
    }
  })

  it('never turns the page twice running', () => {
    for (const r of randoms) expect(nextClip(ALL, ['writing', 'page'], r).name).not.toBe('page')
  })

  it('never plays a clip three times running when another is ready', () => {
    for (const r of randoms) expect(nextClip(ALL, ['calm', 'calm'], r).name).not.toBe('calm')
    for (const r of randoms) expect(nextClip(ALL, ['writing', 'writing'], r).name).not.toBe('writing')
  })

  it('plays the only clip it has, again and again', () => {
    for (const r of randoms) expect(nextClip([clip('writing')], ['writing', 'writing'], r).name).toBe('writing')
  })

  it('picks every clip sometimes, the page turn least', () => {
    const count: Record<string, number> = {}
    for (const r of randoms) {
      const name = nextClip(ALL, ['writing'], r).name
      count[name] = (count[name] ?? 0) + 1
    }
    expect(count.writing).toBeGreaterThan(0)
    expect(count.calm).toBeGreaterThan(0)
    expect(count.page).toBeGreaterThan(0)
    expect(count.page).toBeLessThan(count.writing!)
  })

  it('breathes once or twice between clips, always twice after turning a page', () => {
    const counts = new Set(randoms.map((r) => restAfter('writing', r).breaths))
    expect(counts).toEqual(new Set([1, 2]))
    for (const r of randoms) {
      expect(restAfter('page', r).breaths).toBe(2)
      const { settleMs, afterMs } = restAfter('calm', r)
      expect(settleMs).toBeGreaterThanOrEqual(250)
      expect(settleMs).toBeLessThanOrEqual(600)
      expect(afterMs).toBeGreaterThanOrEqual(150)
      expect(afterMs).toBeLessThanOrEqual(400)
    }
  })

  it('has a breath clip of one calm breath', () => {
    expect(WOMAN_BREATH.src).toBe('/media/scene/woman/woman-breath.webp')
    expect(WOMAN_BREATH.ms).toBeGreaterThan(3500)
    expect(WOMAN_BREATH.ms).toBeLessThan(6000)
  })

  it('rests briefly and still when her breath has not arrived, longer after a page turn', () => {
    for (const r of [-1, 0, 0.3, 1, 2]) {
      expect(stillRest('writing', r)).toBeGreaterThanOrEqual(600)
      expect(stillRest('writing', r)).toBeLessThanOrEqual(1900)
      expect(stillRest('page', r)).toBeGreaterThanOrEqual(1500)
    }
  })
})
