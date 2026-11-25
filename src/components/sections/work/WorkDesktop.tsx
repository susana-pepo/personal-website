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
import { cssToken, prefersReducedMotion } from '../../../lib/motion'
import { ROOM_ANCHORED_FROM } from '../../SectionPanel/panelGeometry'
import { MOVE, WHEEL_GESTURE_GAP, fitScreenHeight, placeOver, rowIndexForKey, wheelGoesToPage, type Box } from './desktop'
import { ProjectPage, projectRowId } from './ProjectPage'
import { TabletFrame } from './TabletFrame'
import { WorkThumb } from './thumbs/WorkThumb'
import './desktop.css'

/** Brings an element into view only if it is outside the window, by the smallest move. */
function bringIntoView(el: HTMLElement | null | undefined, smooth: boolean) {
  if (!el) return
  const r = el.getBoundingClientRect()
  if (r.top >= 0 && r.bottom <= window.innerHeight) return
  el.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' })
}

/** The nearest box around `el` that scrolls up and down (the panel, or the document). */
function scrollParent(el: Element): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
  }
  return document.scrollingElement as HTMLElement | null
}

/** The nearest box around `el` that is set to scroll up and down, whether or not it overflows yet. */
function scrollBox(el: Element): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
  }
  return null
}

/** An element's top in the layout, unmoved by transforms or scrolling (the panel may be mid-entrance). */
function layoutTop(el: HTMLElement): number {
  let top = 0
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop
  return top
}

const boxOf = (el: Element | null | undefined): Box | null => {
  if (!el) return null
  const { left, top, width, height } = el.getBoundingClientRect()
  return { left, top, width, height }
}

const opacityOf = (el: Element | null | undefined, fallback: number) => {
  if (!el) return fallback
  const n = parseFloat(getComputedStyle(el).opacity)
  return Number.isNaN(n) ? fallback : n
}

/**
 * Rows: the projects in the screen. Opening: one project's drawing travels
 * from its row to the top of its page. Page: that project alone. Closing: the
 * drawing travels back into its row.
 */
type Phase = 'rows' | 'opening' | 'page' | 'closing'

/** Where a move starts, read from the screen just before it. */
interface Start {
  /** Where the drawing is now (its row, or wherever an interrupted move left it). */
  drawing: Box | null
  rows: number
  words: number
}

interface WorkDesktopProps {
  label: string
  projects: readonly WorkProject[]
}

/**
 * Things I've built, on the tablet's screen. At rest the screen holds the
 * projects as rows, one under another: a big drawing with the name (and, on a
 * wide tablet, its one line) beside it, or on a phone the drawing with the name
 * beneath. The screen keeps its shape and the rows scroll inside it. Choosing
 * one fills the screen with that project: its drawing grows from the row to
 * the top of the page and the words arrive beneath it. "Put it back", or
 * Escape, sends the drawing back into its row, with the rows where they were
 * and focus on the row it came from.
 *
 * The rows stay in the screen (hidden while a page is up), so their scroll
 * position is kept and the way back can be measured. Only transform and
 * opacity move, through the Web Animations API, so a move can be cut short
 * from wherever it is.
 */
export function WorkDesktop({ label, projects }: WorkDesktopProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const pageRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  /** The project whose page is up (or on its way in or out). */
  const [open, setOpen] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('rows')
  /** Set on the first change of view, so the panel's arrival stagger never replays. */
  const [moved, setMoved] = useState(false)
  /**
   * The row a drawing was put back into. It takes focus as the drawing sets off, and focus would
   * start its drawing's small motion, still running when the drawing lands; so that row keeps
   * still until focus moves on.
   */
  const [still, setStill] = useState<string | null>(null)
  const start = useRef<Start | null>(null)
  const moving = useRef<Animation[]>([])
  /** Counts moves, so a move that was cut short never finishes the one after it. */
  const move = useRef(0)

  const rowThumb = (id: string) => listRef.current?.querySelector(`#${projectRowId(id)} .wthumb`)
  const pagePic = () => pageRef.current?.querySelector('.wdesk__pic')
  const pageFades = () => Array.from(pageRef.current?.querySelectorAll<HTMLElement>('[data-fade]') ?? [])

  const stop = () => {
    for (const a of moving.current) a.cancel()
    moving.current = []
  }

  const openProject = (id: string) => {
    if (phase === 'opening' || phase === 'page') return
    // Cut short a way back: from where its drawing is now if it is this project, else from the row.
    const same = phase === 'closing' && open === id
    start.current = {
      drawing: boxOf(same ? pagePic() : rowThumb(id)),
      rows: phase === 'closing' ? opacityOf(listRef.current, 1) : 1,
      words: same ? opacityOf(pageFades()[0], 0) : 0,
    }
    stop()
    move.current += 1
    setMoved(true)
    setOpen(id)
    setPhase('opening')
  }

  const putBack = useCallback(() => {
    if (phase !== 'opening' && phase !== 'page') return
    start.current = {
      drawing: boxOf(pagePic()),
      rows: opacityOf(listRef.current, phase === 'page' ? 0 : 1),
      words: opacityOf(pageFades()[0], 1),
    }
    stop()
    move.current += 1
    setStill(open)
    setPhase('closing')
  }, [phase, open])

  // Each change of phase starts its move from what start.current recorded.
  useLayoutEffect(() => {
    const from = start.current
    start.current = null
    const list = listRef.current
    const page = pageRef.current
    const token = move.current
    const reduce = prefersReducedMotion()
    const ease = cssToken('--ease-drawer', 'cubic-bezier(0.32, 0.72, 0, 1)')
    const easeOut = cssToken('--ease-out', 'cubic-bezier(0.23, 1, 0.32, 1)')
    const settle = (next: () => void) => {
      Promise.all(moving.current.map((a) => a.finished)).then(
        () => {
          if (move.current === token) next()
        },
        () => {},
      )
    }

    if (phase === 'opening' && from && list && page) {
      titleRef.current?.focus({ preventScroll: true })
      const pic = pagePic()
      const anims: Animation[] = []
      if (reduce) {
        anims.push(list.animate([{ opacity: from.rows }, { opacity: 0 }], { duration: MOVE.fade, easing: 'ease' }))
        anims.push(page.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOVE.fade, easing: 'ease' }))
      } else {
        const home = boxOf(pic)
        if (pic && home && from.drawing) {
          anims.push(
            pic.animate([{ transform: placeOver(home, from.drawing) }, { transform: 'none' }], {
              duration: MOVE.travel,
              easing: ease,
            }),
          )
        }
        anims.push(
          list.animate([{ opacity: from.rows }, { opacity: 0 }], { duration: MOVE.rowsOut, easing: easeOut }),
        )
        for (const el of pageFades()) {
          anims.push(
            el.animate(
              [
                { opacity: from.words, transform: `translateY(${from.words > 0 ? 0 : 8}px)` },
                { opacity: 1, transform: 'none' },
              ],
              { ...MOVE.wordsIn, easing: easeOut, fill: 'backwards' },
            ),
          )
        }
      }
      moving.current = anims
      bringIntoView(rootRef.current, !reduce)
      settle(() => setPhase('page'))
      return
    }

    if (phase === 'closing' && from && list && page && open) {
      // Focus goes back to the row at once, so a keyboard is never left on a page that is leaving.
      list.querySelector<HTMLButtonElement>(`#${projectRowId(open)} .wdesk__open`)?.focus({ preventScroll: true })
      const pic = pagePic()
      const target = boxOf(rowThumb(open))
      const anims: Animation[] = []
      if (reduce) {
        anims.push(page.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MOVE.fade, easing: 'ease', fill: 'forwards' }))
        anims.push(list.animate([{ opacity: from.rows }, { opacity: 1 }], { duration: MOVE.fade, easing: 'ease' }))
      } else {
        const home = boxOf(pic)
        if (pic && home && target) {
          anims.push(
            pic.animate(
              [{ transform: from.drawing ? placeOver(home, from.drawing) : 'none' }, { transform: placeOver(home, target) }],
              // Held at the row until the page is taken away, so it never springs back for a frame.
              { duration: MOVE.back, easing: ease, fill: 'forwards' },
            ),
          )
        }
        for (const el of pageFades()) {
          anims.push(
            el.animate([{ opacity: from.words }, { opacity: 0 }], {
              duration: MOVE.wordsOut,
              easing: easeOut,
              fill: 'forwards',
            }),
          )
        }
        anims.push(
          list.animate([{ opacity: from.rows }, { opacity: 1 }], {
            ...MOVE.rowsIn,
            easing: easeOut,
            fill: 'backwards',
          }),
        )
      }
      moving.current = anims
      settle(() => {
        setOpen(null)
        setPhase('rows')
      })
      return
    }

    // The way back has landed: the page is gone, so its held frames go too.
    if (phase === 'rows') stop()
    // Only a change of phase starts a move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // On a desktop the screen is as tall as the panel's first view allows (see fitScreenHeight); the
  // rows then take half of it each. Below that width the screen keeps its own proportions.
  useLayoutEffect(() => {
    const root = rootRef.current
    const pad = root?.closest<HTMLElement>('.pad')
    const screen = root?.parentElement
    const section = pad?.parentElement
    const view = root && scrollBox(root)
    if (!root || !pad || !screen || !section || !view) return
    const wide = window.matchMedia(`(min-width: ${ROOM_ANCHORED_FROM}px)`)
    const fit = () => {
      if (!wide.matches) {
        root.style.removeProperty('--fit-h')
        return
      }
      const height = fitScreenHeight({
        view: view.clientHeight,
        above: layoutTop(pad) - layoutTop(view),
        frame: pad.offsetHeight - screen.offsetHeight,
        breath: parseFloat(getComputedStyle(section).rowGap) || 0,
      })
      root.style.setProperty('--fit-h', `${height}px`)
    }
    fit()
    // The view changes with the window; what sits above the tablet changes as its text wraps.
    const watch = new ResizeObserver(fit)
    watch.observe(view)
    for (const el of Array.from(section.children)) if (el !== pad) watch.observe(el)
    wide.addEventListener('change', fit)
    return () => {
      watch.disconnect()
      wide.removeEventListener('change', fit)
    }
  }, [])

  // A move still running when the tablet leaves is let go.
  useEffect(() => stop, [])

  // A wheel that starts at the end of the screen's scroll carries on to the page (see wheelGoesToPage).
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let last = -Infinity
    let passing = false
    const onWheel = (event: WheelEvent) => {
      const fresh = event.timeStamp - last > WHEEL_GESTURE_GAP
      last = event.timeStamp
      const view = (event.target as Element).closest?.<HTMLElement>('.wdesk__rows, .wdesk__page')
      passing = !!view && !event.ctrlKey && wheelGoesToPage(view, event.deltaY, fresh, passing)
      if (!passing) return
      const page = scrollParent(root)
      if (!page || page.scrollTop + page.clientHeight >= page.scrollHeight - 1) return
      event.preventDefault()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? page.clientHeight : 1
      page.scrollBy({ top: event.deltaY * unit, behavior: 'instant' })
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [])

  // Escape puts the project back first; only the next Escape closes the panel.
  useEffect(() => {
    if (phase !== 'opening' && phase !== 'page') return
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
  }, [phase, putBack])

  // Arrow keys move from row to row (focus scrolls the row into view on the screen); Home and End jump.
  const onRowsKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('.wdesk__open') ?? [])
    const current = buttons.indexOf(event.target as HTMLButtonElement)
    if (current < 0) return
    const next = rowIndexForKey(current, event.key, buttons.length)
    if (next === null) return
    event.preventDefault()
    buttons[next]?.focus()
  }

  const project = projects.find((p) => p.id === open)
  const away = phase === 'opening' || phase === 'page'

  return (
    <TabletFrame>
      <div
        ref={rootRef}
        className="wdesk"
        data-phase={phase}
        data-moved={moved ? '' : undefined}
      >
        <ul
          ref={listRef}
          className="wdesk__rows"
          role="list"
          aria-label={label}
          aria-hidden={away || undefined}
          inert={away || undefined}
          onKeyDown={onRowsKeyDown}
        >
          {projects.map((p, k) => (
            <li
              key={p.id}
              id={projectRowId(p.id)}
              className="wdesk__row wtile"
              // While its drawing is on the move, the row's own copy steps aside.
              data-source={open === p.id && phase !== 'rows' ? '' : undefined}
              data-still={still === p.id ? '' : undefined}
              style={{ '--k': k } as CSSProperties}
            >
              {/* Named by the project's title; its one line is read as the description. */}
              <button
                type="button"
                className="wdesk__open"
                aria-labelledby={`${projectRowId(p.id)}-name`}
                aria-describedby={`${projectRowId(p.id)}-line`}
                onClick={() => openProject(p.id)}
                onBlur={() => setStill((id) => (id === p.id ? null : id))}
              >
                <WorkThumb kind={p.thumb} />
                <span className="wdesk__caption">
                  <span id={`${projectRowId(p.id)}-name`} className="wdesk__name">
                    {p.title}
                  </span>
                  <span id={`${projectRowId(p.id)}-line`} className="wdesk__line">
                    {p.line}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {project && (
          <ProjectPage
            key={project.id}
            ref={pageRef}
            project={project}
            titleRef={titleRef}
            onPutBack={putBack}
            playing={phase === 'page'}
            inert={phase === 'closing'}
          />
        )}
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
      </div>
    </TabletFrame>
  )
}
