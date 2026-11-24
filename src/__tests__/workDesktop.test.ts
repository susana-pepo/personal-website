import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import WorkSection from '../components/sections/WorkSection'
import { MOVE, placeOver, rowIndexForKey, wheelGoesToPage } from '../components/sections/work/desktop'
import { ProjectPage, projectRowId } from '../components/sections/work/ProjectPage'
import { content } from '../content/content'

const { projects } = content.work
const noop = () => {}
const esc = (s: string) => s.replace(/&/g, '&amp;')

describe('the tablet at rest: the projects as rows', () => {
  const html = renderToStaticMarkup(createElement(WorkSection))

  it('lists every project as one row in a labelled list, in order', () => {
    expect(html).toContain(`<ul class="wdesk__rows" role="list" aria-label="${projects.label}">`)
    const rows = html.match(/<li id="([^"]+)" class="wdesk__row wtile"/g) ?? []
    expect(rows).toHaveLength(projects.items.length)
    projects.items.forEach((project, k) => {
      expect(rows[k]).toContain(`id="${projectRowId(project.id)}"`)
    })
  })

  it('makes each row one button named by the title, with the drawing, the name and the line', () => {
    const buttons = html.match(/<button type="button" class="wdesk__open"[\s\S]*?<\/button>/g) ?? []
    expect(buttons).toHaveLength(projects.items.length)
    projects.items.forEach((project, k) => {
      const id = projectRowId(project.id)
      const button = buttons[k]!
      expect(button).toContain(`aria-labelledby="${id}-name"`)
      expect(button).toContain(`aria-describedby="${id}-line"`)
      expect(button).toContain('class="wthumb"')
      expect(button).toContain(`<span id="${id}-name" class="wdesk__name">${esc(project.title)}</span>`)
      expect(button).toContain(`<span id="${id}-line" class="wdesk__line">${esc(project.line)}</span>`)
      // The drawing comes first, then the words.
      expect(button.indexOf('class="wthumb"')).toBeLessThan(button.indexOf('class="wdesk__name"'))
    })
  })

  it('shows no summaries and no open page until a row is chosen', () => {
    for (const project of projects.items) expect(html).not.toContain(esc(project.summary))
    expect(html).not.toContain('wdesk__page')
    expect(html).not.toContain('Put it back')
  })
})

describe('one project on the screen', () => {
  const page = (k: number) =>
    renderToStaticMarkup(createElement(ProjectPage, { project: projects.items[k]!, onPutBack: noop }))

  it('is a region named by the project’s title, which can take focus', () => {
    projects.items.forEach((project, k) => {
      const html = page(k)
      const id = `${projectRowId(project.id)}-title`
      expect(html).toMatch(
        new RegExp(`^<section id="${projectRowId(project.id)}-page" class="wdesk__page" aria-labelledby="${id}">`),
      )
      expect(html).toContain(`<h3 id="${id}" class="wdesk__title" tabindex="-1">${esc(project.title)}</h3>`)
    })
  })

  it('starts with “Put it back”, then the drawing, then the words', () => {
    const html = page(0)
    const back = html.indexOf('Put it back')
    const drawing = html.indexOf('class="wthumb"')
    const title = html.indexOf('class="wdesk__title"')
    expect(back).toBeGreaterThan(0)
    expect(back).toBeLessThan(drawing)
    expect(drawing).toBeLessThan(title)
  })

  it('shows the summary, the topics and the link, which opens in a new tab', () => {
    projects.items.forEach((project, k) => {
      const html = page(k)
      expect(html).toContain(`<p class="wdesk__summary">${esc(project.summary)}</p>`)
      if (project.topics) for (const topic of project.topics) expect(html).toContain(`<li>${esc(topic)}</li>`)
      if (project.href) {
        expect(html).toContain(`href="${project.href}" target="_blank" rel="noopener noreferrer"`)
        expect(html).toContain(`${esc(project.linkLabel ?? project.title)}<span aria-hidden="true"> ↗</span>`)
        expect(html).toContain('(opens in a new tab)')
      } else {
        expect(html).not.toContain('<a ')
      }
    })
  })

  it('has one button, “Put it back”, and no way to step to another project', () => {
    const html = page(2)
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).not.toMatch(/Previous|Next|of 5/)
  })
})

describe('rowIndexForKey', () => {
  it('moves to the next row with Down or Right and stops at the last', () => {
    expect(rowIndexForKey(0, 'ArrowDown', 5)).toBe(1)
    expect(rowIndexForKey(2, 'ArrowRight', 5)).toBe(3)
    expect(rowIndexForKey(4, 'ArrowDown', 5)).toBe(4)
  })

  it('moves to the row before with Up or Left and stops at the first', () => {
    expect(rowIndexForKey(3, 'ArrowUp', 5)).toBe(2)
    expect(rowIndexForKey(1, 'ArrowLeft', 5)).toBe(0)
    expect(rowIndexForKey(0, 'ArrowUp', 5)).toBe(0)
  })

  it('jumps with Home and End and ignores other keys', () => {
    expect(rowIndexForKey(2, 'Home', 5)).toBe(0)
    expect(rowIndexForKey(2, 'End', 5)).toBe(4)
    expect(rowIndexForKey(2, 'Enter', 5)).toBeNull()
    expect(rowIndexForKey(2, ' ', 5)).toBeNull()
  })

  it('returns null with no rows or no row focused', () => {
    expect(rowIndexForKey(0, 'ArrowDown', 0)).toBeNull()
    expect(rowIndexForKey(-1, 'ArrowDown', 5)).toBeNull()
  })
})

describe('placeOver', () => {
  const home = { left: 100, top: 50, width: 280, height: 210 }

  it('moves and scales the page’s drawing onto its row, from the top-left corner', () => {
    const row = { left: 20, top: 300, width: 210, height: 157.5 }
    expect(placeOver(home, row)).toBe('translate(-80px, 250px) scale(0.75)')
  })

  it('leaves a drawing already in place untouched', () => {
    expect(placeOver(home, { ...home })).toBe('none')
  })

  it('gives none for a box with no width, so a hidden row never collapses the drawing', () => {
    expect(placeOver(home, { left: 0, top: 0, width: 0, height: 0 })).toBe('none')
    expect(placeOver({ ...home, width: 0 }, home)).toBe('none')
  })

  it('rounds to whole hundredths of a pixel', () => {
    expect(placeOver(home, { left: 100.123, top: 50.456, width: 280, height: 210 })).toBe(
      'translate(0.12px, 0.46px) scale(1)',
    )
  })
})

describe('wheelGoesToPage', () => {
  const atEnd = { scrollTop: 532.4, scrollHeight: 995, clientHeight: 462.6 }
  const middle = { scrollTop: 200, scrollHeight: 995, clientHeight: 462.6 }

  it('passes a fresh downward gesture to the page when the screen is at its end, even a fraction short', () => {
    expect(wheelGoesToPage(atEnd, 40, true, false)).toBe(true)
    expect(wheelGoesToPage({ ...atEnd, scrollTop: 531.6 }, 40, true, false)).toBe(true)
  })

  it('keeps a fresh gesture on the screen while it can still scroll', () => {
    expect(wheelGoesToPage(middle, 40, true, false)).toBe(false)
    expect(wheelGoesToPage({ ...atEnd, scrollTop: 500 }, 40, true, false)).toBe(false)
  })

  it('keeps a gesture where it started: one that reaches the end part-way stays on the screen', () => {
    expect(wheelGoesToPage(atEnd, 40, false, false)).toBe(false)
    expect(wheelGoesToPage(middle, 40, false, true)).toBe(true)
  })

  it('leaves upward scrolling to the browser', () => {
    expect(wheelGoesToPage({ ...middle, scrollTop: 0 }, -40, true, false)).toBe(false)
    expect(wheelGoesToPage(atEnd, -40, false, true)).toBe(false)
  })
})

describe('the move between the rows and a page', () => {
  it('lets the other rows go before the drawing lands and the words arrive after it has mostly landed', () => {
    expect(MOVE.rowsOut).toBeLessThan(MOVE.travel / 2)
    expect(MOVE.wordsIn.delay).toBeGreaterThanOrEqual(MOVE.rowsOut)
    expect(MOVE.travel).toBeGreaterThanOrEqual(420)
    expect(MOVE.travel).toBeLessThanOrEqual(520)
  })

  it('takes the words away first on the way back', () => {
    expect(MOVE.wordsOut).toBeLessThan(MOVE.back)
    expect(MOVE.fade).toBeLessThan(MOVE.travel)
  })
})
