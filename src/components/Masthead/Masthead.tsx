import { content } from '../../content/content'
import type { SectionId } from '../../content/types'
import { hrefFor } from '../../lib/router'
import './Masthead.css'

interface MastheadProps {
  /** The section open now (its link is marked). */
  current: SectionId | null
  /** Where the room puts its scene control (time of day and weather): the masthead's far right. */
  sceneSlotRef?: (el: HTMLDivElement | null) => void
}

/**
 * The editorial masthead: a slim header above the room. Susana's name (bold)
 * with her disciplines in small spaced capitals beneath, the menu alongside
 * (About · Work · Contact: one clear way in, besides the room's objects), and
 * the scene control (time of day and weather, drawn here by the room) at the
 * far right.
 */
export function Masthead({ current, sceneSlotRef }: MastheadProps) {
  const disciplines = content.profile.disciplines.join(', ').replace(/, ([^,]*)$/, ' & $1')
  return (
    <header className="masthead">
      <div className="masthead__id">
        <h1 className="masthead__name">{content.profile.displayName}</h1>
        <p className="masthead__disciplines">{disciplines}</p>
      </div>

      <nav className="masthead__nav" aria-label={content.nav.label}>
        <ul className="masthead__links">
          {content.nav.items.map((id) => (
            <li key={id} className="masthead__item">
              <a className="masthead__link" href={hrefFor(id)} aria-current={id === current ? 'page' : undefined}>
                {content.sections[id].navLabel}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div ref={sceneSlotRef} className="masthead__scene" />
    </header>
  )
}
