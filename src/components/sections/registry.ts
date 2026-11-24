import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { SectionId } from '../../content/types'

const imports: Record<SectionId, () => Promise<{ default: ComponentType }>> = {
  work: () => import('./WorkSection'),
  about: () => import('./AboutSection'),
  experience: () => import('./ExperienceSection'),
  bookshelf: () => import('./BookshelfSection'),
  music: () => import('./MusicSection'),
  contact: () => import('./ContactSection'),
}

/**
 * Sections whose chunk has arrived. `lazy()` suspends on its first render even
 * when the chunk is already here, which flashes the loading fallback, so a
 * section that is ready is rendered as its plain component instead.
 */
const loaded: Partial<Record<SectionId, ComponentType>> = {}

const loaders = Object.fromEntries(
  Object.entries(imports).map(([id, load]) => [
    id,
    () =>
      load().then((module) => {
        loaded[id as SectionId] = module.default
        return module
      }),
  ]),
) as typeof imports

/** Each section's content is its own small chunk, loaded on demand. */
export const SECTION_COMPONENTS = Object.fromEntries(
  Object.entries(loaders).map(([id, load]) => [id, lazy(load)]),
) as Record<SectionId, LazyExoticComponent<ComponentType>>

/** The plain component once its chunk has arrived, otherwise the lazy one. */
export function sectionComponent(id: SectionId): ComponentType | LazyExoticComponent<ComponentType> {
  return loaded[id] ?? SECTION_COMPONENTS[id]
}

export function preloadSections() {
  Object.values(loaders).forEach((load) => void load().catch(() => undefined))
}
