import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ContactSection from '../components/sections/ContactSection'
import { content } from '../content/content'

const { contact } = content

describe('contact note', () => {
  const html = renderToStaticMarkup(<ContactSection />)

  it('heads the note with “Let’s chat” and offers exactly two equal actions', () => {
    expect(html).toContain(`<h3 class="note__title">${contact.cta}</h3>`)
    expect(html.match(/class="note__act"/g)).toHaveLength(2)
    expect(html).toContain('Send me an email')
    expect(html).toContain('Connect on LinkedIn')
  })

  it('opens an email with the subject filled in, and never prints the address or profile URL', () => {
    expect(html).toContain(`href="mailto:${contact.email}?subject=`)
    const visible = html.replace(/<span class="visually-hidden">[^<]*<\/span>/g, '').replace(/href="[^"]*"/g, '')
    expect(visible).not.toContain(contact.email)
    for (const link of contact.links) expect(visible).not.toContain(link.display)
  })
})
