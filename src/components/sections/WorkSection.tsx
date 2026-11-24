import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { content } from '../../content/content'
import type { WorkPlace, WorkProject, WorkTheme } from '../../content/types'
import { pad } from '../SectionPanel/folio'
import { Topics } from './Topics'
import { arrangeField, leanFor, mapDescription, neighbour, placeLabel, projectsIn } from './work/field'
import { ProjectGrid, projectId } from './work/ProjectGrid'
import './work/work-map.css'
import { prefersReducedMotion } from '../../lib/motion'

/** How long the field takes to lean and unfold before an opened area is scrolled into view. */
const SETTLE_MS = 460


type State = 'rest' | 'open' | 'receded'

/**
 * A map of the work: the four areas of focus sit in the quadrants of two axes
 * taken from the intro (Music to Product, People to Systems). Choosing an area
 * moves the crossing point to give it room and unfolds its summary; the others
 * recede to their numbers and titles. Rights Intelligence, an independent
 * exploration, sits just off the map.
 *
 * Below the map, the things I've made, as drawn tiles. A tile lights its area
 * on the map; an open area links to what was made in it.
 */
export default function WorkSection() {
  const { work } = content
  const { axes } = work.map
  const { areas, outposts } = useMemo(() => arrangeField(work.themes), [work.themes])
  const [open, setOpen] = useState<string | null>(null)
  const [hover, setHover] = useState<WorkPlace | null>(null)
  const [focus, setFocus] = useState<WorkPlace | null>(null)
  const [openProject, setOpenProject] = useState<string | null>(null)
  const [projectHot, setProjectHot] = useState<WorkPlace | null>(null)
  const projects = work.projects.items
  const buttons = useRef(new Map<WorkPlace, HTMLButtonElement>())
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const openPlace = areas.find((a) => a.theme.id === open)?.place
  const hot = hover ?? focus ?? projectHot ?? openPlace

  const toggle = (theme: WorkTheme, el: HTMLElement | null) => {
    window.clearTimeout(timer.current)
    if (open === theme.id) {
      setOpen(null)
      return
    }
    setOpen(theme.id)
    const reduce = prefersReducedMotion()
    timer.current = window.setTimeout(
      () => el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }),
      reduce ? 0 : SETTLE_MS,
    )
  }

  const toggleProject = (project: WorkProject, tile: HTMLElement | null) => {
    window.clearTimeout(timer.current)
    if (openProject === project.id) {
      setOpenProject(null)
      return
    }
    setOpenProject(project.id)
    const reduce = prefersReducedMotion()
    timer.current = window.setTimeout(
      () => tile?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }),
      reduce ? 0 : SETTLE_MS,
    )
  }

  /** From an open area: open the project, bring it into view and move focus to it. */
  const showProject = (project: WorkProject) => {
    window.clearTimeout(timer.current)
    setOpenProject(project.id)
    const tile = document.getElementById(projectId(project))
    tile?.querySelector<HTMLButtonElement>('.wtile__button')?.focus({ preventScroll: true })
    // Scroll once any other open tile has folded away, or the target moves after we arrive.
    const reduce = prefersReducedMotion()
    timer.current = window.setTimeout(
      () => tile?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }),
      reduce ? 0 : SETTLE_MS,
    )
  }

  // Arrows move between the areas' buttons (not from a link inside an open area).
  const onFieldKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target as HTMLElement).closest('.wmap__button')) return
    const place = (event.target as HTMLElement).closest<HTMLElement>('[data-place]')?.dataset.place as
      | WorkPlace
      | undefined
    if (!place) return
    const next = neighbour(place, event.key)
    const target = next && buttons.current.get(next)
    if (!target) return
    event.preventDefault()
    target.focus()
  }

  // Areas recede only when another area takes the room; the outpost doesn't move the field.
  const stateOf = (id: string): State => (open === id ? 'open' : openPlace ? 'receded' : 'rest')

  return (
    <div className="section section--folio">
      <p className="lede">{work.intro}</p>

      <figure className="wmap" aria-labelledby="wmap-label" aria-describedby="wmap-desc">
        <figcaption className="wmap__caption">
          <span id="wmap-label">{work.map.label}</span>
          <span aria-hidden="true">{work.map.hint}</span>
          <span id="wmap-desc" className="visually-hidden">
            {mapDescription(axes)}
          </span>
        </figcaption>

        <div
          className="wmap__field"
          data-lean={leanFor(openPlace)}
          data-hot={hot}
          onKeyDown={onFieldKeyDown}
          onPointerLeave={() => setHover(null)}
        >
          <span className="wmap__axis wmap__axis--v" aria-hidden="true" />
          <span className="wmap__axis wmap__axis--h" aria-hidden="true" />
          <span className="wmap__origin" aria-hidden="true" />
          <span className="wmap__end wmap__end--top" aria-hidden="true">
            {axes.top}
          </span>
          <span className="wmap__end wmap__end--bottom" aria-hidden="true">
            {axes.bottom}
          </span>
          <span className="wmap__end wmap__end--left" aria-hidden="true">
            {axes.left}
          </span>
          <span className="wmap__end wmap__end--right" aria-hidden="true">
            {axes.right}
          </span>

          {areas.map(({ theme, place, n }, k) => {
            const state = stateOf(theme.id)
            return (
              <section
                key={theme.id}
                className="wmap__area"
                data-place={place}
                data-state={state}
                data-lit={projectHot === place ? '' : undefined}
                style={{ '--k': k } as CSSProperties}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(place)}
                onFocus={() => setFocus(place)}
                onBlur={() => setFocus(null)}
              >
                <h3 className="wmap__heading">
                  <button
                    ref={(el) => {
                      if (el) buttons.current.set(place, el)
                      else buttons.current.delete(place)
                    }}
                    type="button"
                    className="wmap__button"
                    aria-expanded={state === 'open'}
                    aria-controls={`work-${theme.id}`}
                    aria-describedby={`work-${theme.id}-place`}
                    onClick={(e) => toggle(theme, e.currentTarget.closest('section'))}
                  >
                    <span className="wmap__n" aria-hidden="true">
                      {pad(n)}
                    </span>
                    <span className="wmap__title">{theme.title}</span>
                  </button>
                </h3>
                <span id={`work-${theme.id}-place`} hidden>
                  {placeLabel(place, axes)}
                </span>
                <Fold id={`work-${theme.id}`} className="wmap__fold--detail" label={theme.title}>
                  <Detail theme={theme} status made={projectsIn(theme.id, projects)} onShow={showProject} />
                </Fold>
                <Fold className="wmap__fold--topics">
                  <Topics label={`Topics in ${theme.title}`} items={theme.topics} />
                </Fold>
              </section>
            )
          })}
        </div>

        {outposts.map(({ theme, n }) => {
          const state = stateOf(theme.id)
          return (
            <section key={theme.id} className="wmap__outpost" data-state={state}>
              <h3 className="wmap__heading">
                <button
                  type="button"
                  className="wmap__button"
                  aria-expanded={state === 'open'}
                  aria-controls={`work-${theme.id}`}
                  onClick={(e) => toggle(theme, e.currentTarget.closest('section'))}
                >
                  <span className="wmap__n" aria-hidden="true">
                    <span className="wmap__ring" />
                    {pad(n)}
                  </span>
                  <span className="wmap__title">{theme.title}</span>
                </button>
              </h3>
              <p className="wmap__meta">
                <span>{theme.kind}</span>
                {theme.status && <span className="entry__status">{theme.status}</span>}
              </p>
              <Fold id={`work-${theme.id}`} className="wmap__fold--detail" label={theme.title}>
                <Detail theme={theme} topics />
              </Fold>
            </section>
          )
        })}
      </figure>

      <ProjectGrid
        label={work.projects.label}
        projects={projects}
        areas={areas}
        open={openProject}
        onToggle={toggleProject}
        onHot={setProjectHot}
      />
    </div>
  )
}

/** A block that unfolds to its natural height. Hidden from everyone while folded. */
function Fold({ id, className, label, children }: { id?: string; className: string; label?: string; children: ReactNode }) {
  return (
    <div id={id} className={`wmap__fold ${className}`} role={label ? 'region' : undefined} aria-label={label}>
      <div className="wmap__fold-inner">{children}</div>
    </div>
  )
}

/** An area's or outpost's unfolded text. `status`: show the theme's status here (outposts show it beside their kind instead). */
function Detail({
  theme,
  topics = false,
  status = false,
  made = [],
  onShow,
}: {
  theme: WorkTheme
  topics?: boolean
  status?: boolean
  made?: WorkProject[]
  onShow?: (project: WorkProject) => void
}) {
  return (
    <>
      {status && theme.status && (
        <p className="wmap__meta">
          <span className="entry__status">{theme.status}</span>
        </p>
      )}
      <p className="wmap__summary">{theme.summary}</p>
      {topics && <Topics label={`Topics in ${theme.title}`} items={theme.topics} />}
      {made.length > 0 && onShow && (
        <p className="wmap__made">
          <span>Made here</span>
          {made.map((project) => (
            <button key={project.id} type="button" className="text-link wmap__made-link" onClick={() => onShow(project)}>
              {project.title}
            </button>
          ))}
        </p>
      )}
      {theme.href && (
        <p className="wmap__link">
          <a className="text-link" href={theme.href} aria-label={`Read more: ${theme.title}`}>
            Read more
          </a>
        </p>
      )}
    </>
  )
}
