import { describe, expect, it } from 'vitest'
import { content } from '../content/content'
import { contentChecklist } from '../content/checklist'
import { SECTION_IDS } from '../content/types'

describe('content', () => {
  it('describes every section', () => {
    for (const id of SECTION_IDS) {
      const meta = content.sections[id]
      expect(meta.id).toBe(id)
      expect(meta.title.length).toBeGreaterThan(0)
      expect(meta.roomLabel.length).toBeGreaterThan(0)
    }
  })

  it('never publishes placeholder contact details', () => {
    expect(content.contact.email).not.toMatch(/example\.|todo|xxx/i)
    for (const link of content.contact.links) {
      expect(link.href).toMatch(/^https:\/\//)
      expect(link.href).not.toMatch(/example\.|…|\.\.\./)
    }
  })

  it('marks Rights Intelligence as an exploration still at the research stage', () => {
    const ri = content.work.projects.items.find((p) => p.id === 'rights-intelligence')
    expect(ri?.line).toMatch(/exploring/i)
    expect(ri?.summary).toMatch(/research stage/i)
  })

  it('links only live work, over https, and ties projects to real areas', () => {
    const areas = new Set(content.work.themes.filter((t) => t.place).map((t) => t.id))
    for (const project of content.work.projects.items) {
      if (project.href) {
        expect(project.href).toMatch(/^https:\/\//)
        expect(project.status).toBe('Live')
        expect(project.linkLabel).toBeTruthy()
      }
      if (project.area) expect(areas.has(project.area)).toBe(true)
    }
  })

  it('lists missing contact details in the checklist', () => {
    const items = contentChecklist({ ...content, contact: { ...content.contact, email: '', links: [] } }, false)
    expect(items.some((i) => i.includes('contact.email'))).toBe(true)
    expect(items.some((i) => i.startsWith('CV'))).toBe(true)
  })
})
