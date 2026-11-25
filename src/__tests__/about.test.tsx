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
    const text = [meta.title, about.intro, ...about.paragraphs, about.closing ?? ''].join(' ')
    expect(text).not.toMatch(/'/)
    expect(text).not.toMatch(/[—–]/)
    expect(text).not.toMatch(/\bcozy\b|\bcolor\b/i)
  })

  it('renders the intro, then the prose, then any closing, without repeating the greeting', () => {
    const html = renderToStaticMarkup(<AboutSection />)
    const intro = html.indexOf(about.intro)
    const firstParagraph = html.indexOf(about.paragraphs[0] ?? 'missing')
    const lastParagraph = html.indexOf(about.paragraphs.at(-1) ?? 'missing')
    expect(intro).toBeGreaterThan(-1)
    expect(firstParagraph).toBeGreaterThan(intro)
    if (about.closing) {
      expect(html.indexOf('class="about-closing"')).toBeGreaterThan(lastParagraph)
    } else {
      expect(html).not.toContain('about-closing')
    }
    expect(html).not.toContain('Hi there')
    expect(html).not.toContain('<dl')
  })
})
