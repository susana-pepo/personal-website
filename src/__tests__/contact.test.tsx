import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ContactSection from '../components/sections/ContactSection'
import { content } from '../content/content'

const { contact } = content

describe('contact', () => {
  const html = renderToStaticMarkup(<ContactSection />)
  // What a reader sees: the markup without hidden text and without link targets.
  const visible = html.replace(/<span class="visually-hidden">[^<]*<\/span>/g, '').replace(/href="[^"]*"/g, '')

  it('opens on the intro, like the other sections', () => {
    expect(html).toContain(`<p class="lede cup__intro">${contact.intro}</p>`)
  })

  it('makes “Let’s chat” the email itself, with the subject filled in', () => {
    const subject = encodeURIComponent(contact.cta)
    expect(html).toContain(`class="cup__invite" href="mailto:${contact.email}?subject=${subject}"`)
    expect(visible).toContain(contact.cta)
  })

  it('never prints the email address or the profile URL', () => {
    expect(visible).not.toContain(contact.email)
    for (const link of contact.links) expect(visible).not.toContain(link.display)
  })

  it('offers LinkedIn as one plain link, opening in a new tab, and nothing else', () => {
    const links = html.match(/<a [^>]*class="cup__link text-link"[^>]*>/g) ?? []
    expect(links).toHaveLength(1)
    expect(links[0]).toContain('href="https://www.linkedin.com/in/')
    expect(links[0]).toContain('target="_blank"')
    expect(visible).toContain('Or find me on LinkedIn')
    expect(html.toLowerCase()).not.toContain('instagram')
  })

  it('shows the room’s own coffee beside “Let’s chat”, hidden from assistive tech, with no icons', () => {
    expect(html).toMatch(/class="cup__mug"[^>]*aria-hidden="true"/)
    expect(html).toContain('class="cup__art"')
    expect(html).toContain('/media/scene/coffee/')
    expect(html).not.toContain('social-icon')
  })
})
