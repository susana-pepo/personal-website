import { describe, expect, it } from 'vitest'
import { content } from '../content/content'
import { spineTitle, startYear, yearsOf } from '../components/sections/experience/years'

describe('Experience as a CV', () => {
  it('shortens a period to its years for the book spines', () => {
    expect(yearsOf('August 2023 to October 2026')).toBe('2023 to 2026')
    expect(yearsOf('April 2022 to October 2022')).toBe('2022')
    expect(yearsOf('')).toBe('')
    expect(startYear('October 2022 to July 2023')).toBe('2022')
  })

  it('puts the short form of each job title on its spine', () => {
    expect(spineTitle('Product Owner, Learning Experience & Content')).toBe('Product Owner')
    expect(spineTitle('Education Content Manager & License Manager')).toBe('Education Content Manager')
    expect(spineTitle('Educational Content Creator')).toBe('Educational Content Creator')
  })

  it('sets out each employer with its own roles, newest first', () => {
    const { employers } = content.experience
    expect(employers.length).toBeGreaterThan(0)
    const starts = employers.map((e) => Number(startYear(e.period)))
    expect(starts, 'newest first').toEqual([...starts].sort((a, b) => b - a))
    for (const employer of employers) {
      expect(employer.name && employer.location && employer.period).toBeTruthy()
      expect(employer.roles.length).toBeGreaterThan(0)
      const roleStarts = employer.roles.map((r) => Number(startYear(r.period)))
      expect(roleStarts, `${employer.name}: latest role first`).toEqual([...roleStarts].sort((a, b) => b - a))
    }
  })

  it('keeps every degree in the one Education book, newest first', () => {
    const { education, educationTitle } = content.experience
    expect(educationTitle).toBeTruthy()
    expect(education.map((e) => e.spineNote)).toEqual(['MA', 'BA'])
    for (const entry of education) expect(entry.qualification && entry.institution && entry.period).toBeTruthy()
  })

  it('lists every role with a chapter, a title, dates and what was done', () => {
    const roles = content.experience.employers.flatMap((e) => e.roles)
    expect(roles.length).toBeGreaterThan(0)
    for (const role of roles) {
      expect(role.stage && role.title && role.period).toBeTruthy()
      expect(role.points.length).toBeGreaterThan(0)
      expect(role.points.length, 'kept short').toBeLessThanOrEqual(3)
      expect(role.skills.length).toBeGreaterThan(0)
    }
    expect(new Set(roles.map((r) => r.id)).size).toBe(roles.length)
  })

  it('keeps to the house style and leaves the unverified figures out', () => {
    const { intro, employers, languages, tools } = content.experience
    const roles = employers.flatMap((e) => e.roles)
    const text = [intro, ...employers.map((e) => e.period), ...languages, ...tools, ...roles.flatMap((r) => [r.stage, r.period, ...r.points, ...r.skills])].join(' ')
    expect(text).not.toMatch(/[—–]/)
    expect(text).not.toMatch(/'/)
    // Figures: checked on the CV text only (language levels like "C1+" are not figures).
    const cv = [intro, ...roles.flatMap((r) => [r.stage, ...r.points, ...r.skills])].join(' ')
    expect(cv).not.toMatch(/\d+\s?%|\d+\+|percentage points/)
  })
})
