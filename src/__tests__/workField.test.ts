import { describe, expect, it } from 'vitest'
import { content } from '../content/content'
import type { WorkTheme } from '../content/types'
import {
  arrangeField,
  leanFor,
  mapDescription,
  neighbour,
  placeLabel,
  projectPlace,
  projectsIn,
} from '../components/sections/work/field'
import type { WorkProject } from '../content/types'

const theme = (id: string, place?: WorkTheme['place']): WorkTheme => ({
  id,
  title: id,
  kind: 'Area of focus',
  summary: '',
  topics: [],
  place,
})

const axes = { top: 'Music', bottom: 'Product', left: 'People', right: 'Systems' }

describe('arrangeField', () => {
  it('puts placed themes on the map and keeps content numbering', () => {
    const { areas, outposts } = arrangeField([theme('a', 'top-left'), theme('b'), theme('c', 'bottom-right')])
    expect(areas.map((a) => [a.theme.id, a.place, a.n])).toEqual([
      ['a', 'top-left', 1],
      ['c', 'bottom-right', 3],
    ])
    expect(outposts.map((o) => [o.theme.id, o.n])).toEqual([['b', 2]])
  })

  it('sends a second theme in a taken quadrant off the map', () => {
    const { areas, outposts } = arrangeField([theme('a', 'top-left'), theme('b', 'top-left')])
    expect(areas).toHaveLength(1)
    expect(outposts.map((o) => o.theme.id)).toEqual(['b'])
  })

  it('maps the four areas of focus, with nothing off the map', () => {
    const { areas, outposts } = arrangeField(content.work.themes)
    expect(new Set(areas.map((a) => a.place)).size).toBe(4)
    expect(outposts).toEqual([])
  })
})

describe('leanFor', () => {
  it('leans toward the open column', () => {
    expect(leanFor('top-left')).toBe('left')
    expect(leanFor('bottom-right')).toBe('right')
    expect(leanFor(null)).toBeUndefined()
  })
})

describe('placeLabel and mapDescription', () => {
  it('names a quadrant by its two axis words', () => {
    expect(placeLabel('top-left', axes)).toBe('Music, People')
    expect(placeLabel('bottom-right', axes)).toBe('Product, Systems')
  })

  it('describes both axes in one sentence', () => {
    expect(mapDescription(axes)).toBe('Arranged on two axes: Music to Product, and People to Systems.')
  })
})

describe('neighbour', () => {
  it('moves across and down the map', () => {
    expect(neighbour('top-left', 'ArrowRight')).toBe('top-right')
    expect(neighbour('top-right', 'ArrowDown')).toBe('bottom-right')
    expect(neighbour('bottom-right', 'ArrowLeft')).toBe('bottom-left')
    expect(neighbour('bottom-left', 'ArrowUp')).toBe('top-left')
  })

  it('stops at the edges and ignores other keys', () => {
    expect(neighbour('top-left', 'ArrowLeft')).toBeNull()
    expect(neighbour('top-left', 'ArrowUp')).toBeNull()
    expect(neighbour('bottom-right', 'ArrowDown')).toBeNull()
    expect(neighbour('top-left', 'Enter')).toBeNull()
  })
})

const project = (id: string, area?: string): WorkProject => ({
  id,
  title: id,
  line: '',
  summary: '',
  status: 'Personal',
  area,
  thumb: 'plan',
})

describe('projects on the map', () => {
  const { areas } = arrangeField([theme('a', 'top-left'), theme('b', 'bottom-right'), theme('c')])

  it('finds the place of a project through its area', () => {
    expect(projectPlace(project('x', 'b'), areas)).toBe('bottom-right')
    expect(projectPlace(project('y'), areas)).toBeUndefined()
    expect(projectPlace(project('z', 'c'), areas)).toBeUndefined()
  })

  it('lists the projects made in an area, in order', () => {
    const list = [project('one', 'a'), project('two', 'b'), project('three', 'a')]
    expect(projectsIn('a', list).map((p) => p.id)).toEqual(['one', 'three'])
    expect(projectsIn('nowhere', list)).toEqual([])
  })

  it('places every live project in the content on the map', () => {
    const real = arrangeField(content.work.themes).areas
    for (const p of content.work.projects.items.filter((p) => p.area)) {
      expect(projectPlace(p, real)).toBeDefined()
    }
  })
})
