import type { Ref } from 'react'
import type { WorkProject } from '../../../content/types'
import { Topics } from '../Topics'
import { WorkThumb } from './thumbs/WorkThumb'

/** The id of a project's row on the screen; its page and title take theirs from it. */
export const projectRowId = (id: string) => `project-${id}`

interface ProjectPageProps {
  project: WorkProject
  onPutBack: () => void
  ref?: Ref<HTMLElement>
  titleRef?: Ref<HTMLHeadingElement>
  /** Once the page has arrived, the drawing plays its one small motion. */
  playing?: boolean
  /** While the page leaves, it can no longer be used. */
  inert?: boolean
}

/**
 * One project filling the tablet's screen, in one column: "Put it back", then
 * the drawing (sized so that it and the words fit the screen together on a
 * laptop or tablet), then the title, summary, topics and link. The
 * page is a region named by its title, and the title takes focus when the page
 * opens (the tablet moves it there). A long page scrolls inside the screen.
 * The parts marked data-fade arrive after the drawing and leave before it.
 */
export function ProjectPage({ project, onPutBack, ref, titleRef, playing, inert }: ProjectPageProps) {
  const id = projectRowId(project.id)
  return (
    <section
      ref={ref}
      id={`${id}-page`}
      className="wdesk__page"
      aria-labelledby={`${id}-title`}
      inert={inert || undefined}
    >
      <div className="wdesk__col">
        <button type="button" className="wdesk__back" data-fade="" onClick={onPutBack}>
          <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
            <path
              d="M9 2.5 4.5 7 9 11.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Put it back
        </button>
        <div className="wdesk__pic wtile" data-play={playing ? '' : undefined}>
          <WorkThumb kind={project.thumb} />
        </div>
        <div className="wdesk__words" data-fade="">
          <h3 ref={titleRef} id={`${id}-title`} className="wdesk__title" tabIndex={-1}>
            {project.title}
          </h3>
          <p className="wdesk__summary">{project.summary}</p>
          {project.topics && <Topics label={`Topics in ${project.title}`} items={project.topics} />}
          {project.href && (
            <p className="wdesk__link">
              <a className="text-link" href={project.href} target="_blank" rel="noopener noreferrer">
                {project.linkLabel ?? project.title}
                <span aria-hidden="true"> ↗</span>
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
