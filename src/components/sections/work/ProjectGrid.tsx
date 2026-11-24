import type { CSSProperties } from 'react'
import type { WorkPlace, WorkProject } from '../../../content/types'
import { Topics } from '../Topics'
import { projectPlace, type MapArea } from './field'
import { WorkThumb } from './thumbs/WorkThumb'
import './project-grid.css'

export const projectId = (project: WorkProject) => `project-${project.id}`

interface ProjectGridProps {
  label: string
  projects: readonly WorkProject[]
  areas: readonly MapArea[]
  open: string | null
  onToggle: (project: WorkProject, tile: HTMLElement | null) => void
  /** The map quadrant to light while a tile is hovered or focused, or null. */
  onHot: (place: WorkPlace | null) => void
}

/** Statuses that mean "you can see this now" or "still moving" carry the spot dot. */
const MARKED = /^(live|.*in progress)$/i

/**
 * Things I've made, as drawn tiles. Each title is a disclosure button; the
 * whole tile is its target while folded. Hovering or focusing a tile lights its
 * area on the map above.
 */
export function ProjectGrid({ label, projects, areas, open, onToggle, onHot }: ProjectGridProps) {
  if (projects.length === 0) return null
  const areaTitle = (project: WorkProject) => areas.find((a) => a.theme.id === project.area)?.theme.title

  return (
    <section className="wgrid" aria-labelledby="wgrid-label">
      <h3 id="wgrid-label" className="wgrid__label">
        {label}
      </h3>
      <ul className="wgrid__list" role="list" onPointerLeave={() => onHot(null)}>
        {projects.map((project, k) => {
          const isOpen = open === project.id
          const place = projectPlace(project, areas) ?? null
          const area = areaTitle(project)
          const detailId = `${projectId(project)}-detail`
          return (
            <li
              key={project.id}
              id={projectId(project)}
              className="wtile"
              data-state={isOpen ? 'open' : 'rest'}
              style={{ '--k': k } as CSSProperties}
              onPointerEnter={(e) => e.pointerType === 'mouse' && onHot(place)}
              onFocus={() => onHot(place)}
              onBlur={() => onHot(null)}
            >
              <WorkThumb kind={project.thumb} />
              <div className="wtile__caption">
                <h4 className="wtile__heading">
                  <button
                    type="button"
                    className="wtile__button"
                    aria-expanded={isOpen}
                    aria-controls={detailId}
                    onClick={(e) => onToggle(project, e.currentTarget.closest('li'))}
                  >
                    {project.title}
                  </button>
                </h4>
                <p className="wtile__line">{project.line}</p>
                <p className="wtile__meta">
                  <span className={MARKED.test(project.status) ? 'entry__status' : undefined}>{project.status}</span>
                  {area && <span>{area}</span>}
                </p>
              </div>
              <div id={detailId} className="wmap__fold wmap__fold--detail" role="region" aria-label={project.title}>
                <div className="wmap__fold-inner">
                  <p className="wmap__summary">{project.summary}</p>
                  {project.topics && <Topics label={`Topics in ${project.title}`} items={project.topics} />}
                  {project.href && (
                    <p className="wtile__link">
                      <a className="text-link" href={project.href} target="_blank" rel="noopener noreferrer">
                        {project.linkLabel ?? project.title}
                        <span className="visually-hidden"> (opens in a new tab)</span>
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
