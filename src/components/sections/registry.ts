import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { SectionId } from '../../content/types'

const loaders: Record<SectionId, () => Promise<{ default: ComponentType }>> = {
  work: () => import('./WorkSection'),
  about: () => import('./AboutSection'),
  experience: () => import('./ExperienceSection'),
  bookshelf: () => import('./BookshelfSection'),
  music: () => import('./MusicSection'),
  contact: () => import('./ContactSection'),
}

/** Each section's content is its own small chunk, loaded on demand. */
export const SECTION_COMPONENTS = Object.fromEntries(
  Object.entries(loaders).map(([id, load]) => [id, lazy(load)]),
) as Record<SectionId, LazyExoticComponent<ComponentType>>

export function preloadSections() {
  Object.values(loaders).forEach((load) => void load().catch(() => undefined))
}
