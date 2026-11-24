import type { SiteContent } from './types'

/** Lists content that still needs real, verified details before publishing. */
export function contentChecklist(content: SiteContent, hasCv: boolean): string[] {
  const items: string[] = []
  if (!content.contact.email) items.push('Contact: add a public email address (contact.email)')
  if (content.contact.links.length === 0) items.push('Contact: add LinkedIn or other profiles (contact.links)')
  content.experience.entries.forEach((entry) => {
    const missing = [!entry.organization && 'organisation', !entry.period && 'dates'].filter(Boolean)
    if (missing.length) items.push(`Experience “${entry.title}”: add ${missing.join(' and ')} (optional)`)
  })
  if (content.bookshelf.books.length === 0) items.push('Bookshelf: add the books you’re reading, work with and love (bookshelf.books)')
  if (content.music.collection.items.length === 0) items.push('Music: add Spotify links to your record collection (music.collection.items)')
  if (content.experience.education.length === 0) items.push('Experience: add education entries (optional)')
  if (!hasCv) items.push('CV: add public/cv/susana-perez-posada-cv.pdf to show the download button (optional)')
  content.work.themes.forEach((theme) => {
    if (!theme.href) items.push(`Work “${theme.title}”: link a case study when one exists (optional)`)
  })
  return items
}
