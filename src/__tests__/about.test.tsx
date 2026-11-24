import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AboutSection from '../components/sections/AboutSection'
import { content } from '../content/content'

const { about } = content
const meta = content.sections.about

describe('about', () => {
  it('greets in the panel heading, then opens on the sentence the page hangs on', () => {
    expect(meta.title).toBe('Hi there, I’m Susana')
    expect(about.intro).toMatch(/music/i)
  })

  it('keeps to the house style: curly apostrophes, no dashes, British spelling', () => {
    const text = [meta.title, about.intro, ...about.paragraphs, about.closing].join(' ')
    expect(text).not.toMatch(/'/)
    expect(text).not.toMatch(/[—–]/)
    expect(text).not.toMatch(/\bcozy\b|\bcolor\b/i)
  })

  it('renders the intro, the prose and the closing in order, without repeating the greeting', () => {
    const html = renderToStaticMarkup(<AboutSection />)
    const intro = html.indexOf(about.intro)
    const firstParagraph = html.indexOf(about.paragraphs[0] ?? 'missing')
    const closing = html.indexOf('class="about-closing"')
    expect(intro).toBeGreaterThan(-1)
    expect(firstParagraph).toBeGreaterThan(intro)
    expect(closing).toBeGreaterThan(firstParagraph)
    expect(html).not.toContain('Hi there')
    expect(html).not.toContain('<dl')
  })
})
