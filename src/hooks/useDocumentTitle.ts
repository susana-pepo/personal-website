import { useEffect } from 'react'
import { content } from '../content/content'
import type { SectionId } from '../content/types'

const BASE_TITLE = `${content.profile.fullName} — ${content.profile.disciplines.join(' · ')}`

export function useDocumentTitle(section: SectionId | null) {
  useEffect(() => {
    document.title = section ? `${content.sections[section].title} — ${content.profile.fullName}` : BASE_TITLE
  }, [section])
}
