import { afterEach, describe, expect, it, vi } from 'vitest'
import { animationMs, cssTimeMs, easeOut, transitionMs } from '../lib/motion'

const el = {} as Element
const styled = (style: Partial<CSSStyleDeclaration>) => vi.stubGlobal('getComputedStyle', () => style)

afterEach(() => vi.unstubAllGlobals())

describe('cssTimeMs', () => {
  it('reads seconds and milliseconds', () => {
    expect(cssTimeMs('0.46s', 1)).toBe(460)
    expect(cssTimeMs(' 260ms ', 1)).toBe(260)
    expect(cssTimeMs('0s', 1)).toBe(0)
  })

  it('falls back on anything else', () => {
    expect(cssTimeMs('', 99)).toBe(99)
    expect(cssTimeMs('fast', 99)).toBe(99)
    expect(cssTimeMs('12', 99)).toBe(99)
  })
})

describe('transitionMs', () => {
  it('adds the delay to the named property', () => {
    styled({ transitionProperty: 'opacity, grid-template-rows', transitionDuration: '0.2s, 0.46s', transitionDelay: '0s, 40ms' })
    expect(transitionMs(el, 'grid-template-rows', 1)).toBe(500)
  })

  it('repeats a shorter list of times, as CSS does', () => {
    styled({ transitionProperty: 'opacity, transform', transitionDuration: '0.3s', transitionDelay: '0s' })
    expect(transitionMs(el, 'transform', 1)).toBe(300)
  })

  it('counts `all`, and the last entry wins', () => {
    styled({ transitionProperty: 'all, transform', transitionDuration: '0.2s, 0.5s', transitionDelay: '0s' })
    expect(transitionMs(el, 'transform', 1)).toBe(500)
    expect(transitionMs(el, 'opacity', 1)).toBe(200)
  })

  it('is 0 when the property does not transition (reduced motion: transition none)', () => {
    styled({ transitionProperty: 'none', transitionDuration: '0s', transitionDelay: '0s' })
    expect(transitionMs(el, 'grid-template-rows', 420)).toBe(0)
  })

  it('falls back without an element or computed styles', () => {
    expect(transitionMs(null, 'opacity', 420)).toBe(420)
  })
})

describe('animationMs', () => {
  it('is when the last animation ends, delays included, ignoring none', () => {
    styled({ animationName: 'folio-leave-fade, folio-leave-slide, none', animationDuration: '0.18s, 0.26s, 5s', animationDelay: '0s, 20ms, 0s' })
    expect(animationMs(el, 1)).toBe(280)
  })
})

describe('easeOut', () => {
  it('starts at 0, ends at 1 and rises fast first', () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBeCloseTo(1)
    expect(easeOut(0.25)).toBeGreaterThan(0.5)
  })
})
