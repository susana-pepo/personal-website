import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import type { WorkProject } from '../../../content/types'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { Topics } from '../Topics'
import { VISIBLE_FILES, clampStart, columnsFrom, fileIndexForKey, selectionInView, startToShow } from './desktop'
import { TabletFrame } from './TabletFrame'
import { ProjectWindow } from './ProjectWindow'
import { WorkThumb } from './thumbs/WorkThumb'
import './desktop.css'

/** Below this tablet width (the same as the CSS container query), files unfold in place. */
const NARROW_PX = 480
/** How long the screen takes to grow or shrink around an opened window. */
const RESIZE_MS = 360

const fileId = (project: WorkProject) => `project-${project.id}`

interface WorkDesktopProps {
  label: string
  projects: readonly WorkProject[]
}

/**
 * Things I've built, as files on the tablet's screen. On a wide panel a file
 * opens as a window on the screen (the other files fade and can't be
 * reached meanwhile); on a narrow one it unfolds in place beneath itself.
 * Escape puts an open project back before the panel itself closes, and focus
 * returns to the file.
 */
export function WorkDesktop({ label, projects }: WorkDesktopProps) {
  const reducedMotion = usePrefersReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [narrow, setNarrow] = useState(false)
  /** The project that is open, or being opened. */
  const [open, setOpen] = useState<string | null>(null)
  /** The project whose window is on screen (it stays while it is put back). */
  const [shown, setShown] = useState<string | null>(null)
  const heightBefore = useRef<number | null>(null)
  /** The first of the three files in view (wide screens only). */
  const [start, setStart] = useState(0)
  const browsing = !narrow && projects.length > VISIBLE_FILES
  /** The file shown in the shared info area: follows hover and focus; a tap selects on touch. */
  const [selected, setSelected] = useState(0)

  // Narrow or wide, from the tablet's own width.
  useLayoutEffect(() => {
    const lap = rootRef.current?.closest('.pad')
    if (!lap) return
    const measure = () => setNarrow(lap.clientWidth < NARROW_PX)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(lap)
    return () => observer.disconnect()
  }, [])

  const buttonFor = useCallback(
    (id: string) => listRef.current?.querySelector<HTMLButtonElement>(`#${fileId({ id } as WorkProject)} .wdesk__open`),
    [],
  )

  const noteHeight = () => {
    heightBefore.current = rootRef.current?.offsetHeight ?? null
  }

  const openProject = (project: WorkProject) => {
    if (narrow) {
      setOpen((current) => (current === project.id ? null : project.id))
      return
    }
    noteHeight()
    setOpen(project.id)
    setShown(project.id)
  }

  const putBack = useCallback(() => {
    if (open === null) return
    setOpen(null)
    if (narrow) buttonFor(open)?.focus()
  }, [open, narrow, buttonFor])

  /** The file to focus once the window has gone (the list is inert until then). */
  const returnTo = useRef<string | null>(null)

  const onWindowClosed = useCallback(() => {
    returnTo.current = shown
    noteHeight()
    setShown(null)
  }, [shown])

  useLayoutEffect(() => {
    if (shown || !returnTo.current) return
    buttonFor(returnTo.current)?.focus({ preventScroll: true })
    returnTo.current = null
  }, [shown, buttonFor])

  // Switching to a narrow layout while a window is up: drop the window, keep the project open in place.
  useEffect(() => {
    if (narrow && shown) setShown(null)
  }, [narrow, shown])

  // The screen grows (or shrinks) smoothly around the window instead of jumping.
  useLayoutEffect(() => {
    const el = rootRef.current
    const before = heightBefore.current
    heightBefore.current = null
    if (!el || before === null || reducedMotion || typeof el.animate !== 'function') return
    const after = el.offsetHeight
    if (Math.abs(after - before) < 2) return
    el.animate([{ height: `${before}px` }, { height: `${after}px` }], {
      duration: RESIZE_MS,
      easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    })
  }, [shown, reducedMotion])

  // Escape puts the project back first; only the next Escape closes the panel.
  useEffect(() => {
    if (open === null) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      event.stopPropagation()
      putBack()
    }
    const dialog = rootRef.current?.closest('dialog')
    const onCancel = (event: Event) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      putBack()
    }
    document.addEventListener('keydown', onKeyDown, true)
    dialog?.addEventListener('cancel', onCancel, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      dialog?.removeEventListener('cancel', onCancel, true)
    }
  }, [open, putBack])

  // Arrows move between files as they sit on the screen; Home and End jump.
  const onFilesKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('.wdesk__open') ?? [])
    const current = buttons.indexOf(event.target as HTMLButtonElement)
    if (current < 0) return
    const columns = columnsFrom(buttons.map((b) => b.getBoundingClientRect().top))
    const next = fileIndexForKey(current, event.key, buttons.length, columns)
    if (next === null) return
    event.preventDefault()
    reveal(next)
    buttons[next]?.focus({ preventScroll: true })
  }

  const windowProject = !narrow ? projects.find((p) => p.id === shown) : undefined
  const view = browsing ? clampStart(start, VISIBLE_FILES, projects.length) : 0
  const step = (by: number) => {
    const next = clampStart(view + by, VISIBLE_FILES, projects.length)
    setStart(next)
    setSelected((current) => selectionInView(current, next, VISIBLE_FILES))
  }
  // A file reached by keyboard or screen reader slides into view and becomes the selected one.
  const reveal = (index: number) => {
    setSelected(index)
    if (browsing) setStart(startToShow(index, view, VISIBLE_FILES, projects.length))
  }
  // Choosing a file selects it (its line and "Explore project" appear below); choosing the selected file
  // again opens its window. On a narrow screen a file simply unfolds in place.
  const onFileClick = (project: WorkProject, index: number) => {
    if (!narrow && selected !== index) {
      setSelected(index)
      return
    }
    openProject(project)
  }
  const current = projects[Math.min(selected, projects.length - 1)]
  const positions = browsing ? projects.length - VISIBLE_FILES + 1 : 0

  return (
    <TabletFrame>
      <div ref={rootRef} className="wdesk" data-window={windowProject ? '' : undefined}>
        <svg
          className="wdesk__hills"
          viewBox="0 0 600 80"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M0 50 C 90 20, 190 22, 290 42 S 470 28, 600 24 V80 H0 Z" fill="oklch(0.5 0.058 24)" />
          <path d="M0 60 C 120 40, 230 46, 330 58 S 520 46, 600 54 V80 H0 Z" fill="oklch(0.45 0.095 38)" />
          <path d="M0 70 C 140 59, 260 65, 360 71 S 540 62, 600 68 V80 H0 Z" fill="oklch(0.34 0.048 48)" />
        </svg>

        <div className="wdesk__browse" inert={windowProject ? true : undefined}>
          <div className="wdesk__viewport">
            <ul
              ref={listRef}
              id="wdesk-files"
              className="wdesk__files"
              role="list"
              aria-label={label}
              onKeyDown={onFilesKeyDown}
              style={{ '--start': view } as CSSProperties}
            >
              {projects.map((project, k) => {
                const isOpen = open === project.id
                const foldId = `${fileId(project)}-detail`
                const windowId = `${fileId(project)}-window`
                return (
                  <li
                    key={project.id}
                    id={fileId(project)}
                    className="wdesk__file wtile"
                    data-state={isOpen ? 'open' : 'rest'}
                    data-selected={!narrow && selected === k ? '' : undefined}
                    style={{ '--k': k } as CSSProperties}
                    onFocus={(e) => {
                      // Keyboard focus selects; a click's or tap's focus waits for the click itself (see onFileClick).
                      if ((e.target as HTMLElement).matches(':focus-visible')) reveal(k)
                    }}
                  >
                    <button
                      type="button"
                      className="wdesk__open"
                      aria-expanded={isOpen}
                      aria-controls={narrow ? foldId : isOpen ? windowId : undefined}
                      aria-haspopup={narrow ? undefined : 'dialog'}
                      aria-describedby={narrow ? undefined : `${fileId(project)}-line`}
                      aria-current={!narrow && selected === k ? 'true' : undefined}
                      onClick={() => onFileClick(project, k)}
                    >
                      <WorkThumb kind={project.thumb} />
                      <span className="wdesk__name">{project.title}</span>
                    </button>
                    {!narrow && (
                      <span id={`${fileId(project)}-line`} hidden>
                        {project.line}
                      </span>
                    )}
                    {narrow && (
                      <div id={foldId} className="wdesk__fold" role="region" aria-label={project.title}>
                        <div className="wdesk__fold-inner">
                          <p className="wdesk__summary">{project.summary}</p>
                          {project.topics && <Topics label={`Topics in ${project.title}`} items={project.topics} />}
                          {project.href && (
                            <p className="wdesk__link">
                              <a className="text-link" href={project.href} target="_blank" rel="noopener noreferrer">
                                {project.linkLabel ?? project.title}
                                <span className="visually-hidden"> (opens in a new tab)</span>
                              </a>
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {!narrow && current && (
            <div className="wdesk__info">
              <div key={current.id} className="wdesk__about">
                {/* The same words the selected file's button carries; shown here, read there. */}
                <p className="wdesk__about-line" aria-hidden="true">
                  {current.line}
                </p>
                {current.href ? (
                  <a className="wdesk__explore" href={current.href} target="_blank" rel="noopener noreferrer">
                    {current.linkLabel ?? current.title}<span aria-hidden="true"> ↗</span>
                    <span className="visually-hidden">{current.linkLabel ? `: ${current.title}` : ''} (opens in a new tab)</span>
                  </a>
                ) : (
                  <button type="button" className="wdesk__explore" onClick={() => openProject(current)}>
                    Open<span className="visually-hidden"> {current.title}</span>
                  </button>
                )}
              </div>
            </div>
          )}
          {browsing && (
            <div className="wdesk__nav">
              <button
                type="button"
                className="wdesk__step"
                aria-label="Previous projects"
                aria-controls="wdesk-files"
                disabled={view === 0}
                onClick={() => step(-1)}
              >
                <Chevron dir="left" />
              </button>
              <span className="wdesk__dots" aria-hidden="true">
                {Array.from({ length: positions }, (_, i) => (
                  <i key={i} data-on={i === view ? '' : undefined} />
                ))}
              </span>
              <button
                type="button"
                className="wdesk__step"
                aria-label="Next projects"
                aria-controls="wdesk-files"
                disabled={view >= projects.length - VISIBLE_FILES}
                onClick={() => step(1)}
              >
                <Chevron dir="right" />
              </button>
            </div>
          )}
        </div>

        {windowProject && (
          <ProjectWindow
            key={windowProject.id}
            project={windowProject}
            id={`${fileId(windowProject)}-window`}
            from={listRef.current?.querySelector<HTMLElement>(`#${fileId(windowProject)} .wthumb`) ?? null}
            closing={open !== windowProject.id}
            reducedMotion={reducedMotion}
            onPutBack={putBack}
            onClosed={onWindowClosed}
          />
        )}
      </div>
    </TabletFrame>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path
        d={dir === 'left' ? 'M9 2.5 4.5 7 9 11.5' : 'M5 2.5 9.5 7 5 11.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
