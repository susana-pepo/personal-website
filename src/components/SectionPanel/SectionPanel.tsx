import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type Ref,
} from 'react'
import { content } from '../../content/content'
import { SECTION_IDS, type SectionId } from '../../content/types'
import { closeSection, currentSection, hrefFor } from '../../lib/router'
import { prefersReducedMotion } from '../../lib/motion'
import { SECTION_COMPONENTS } from '../sections/registry'
import {
  inkTransform,
  pad,
  readDuration,
  readingProgress,
  tabIndexForKey,
  turnDirection,
} from './folio'
import '../sections/sections.css'
import '../sections/panel-sections.css'
import './SectionPanel.css'

/** How long the outgoing page stays on screen while the next one turns in. */
const LEAVE_MS = 280

type PanelState = 'closed' | 'open' | 'closing'

interface Page {
  id: SectionId
  /** A fresh key per visit, so the incoming page always replays its entrance. */
  key: number
  /** Opening rises; turning moves with the direction of travel. */
  enter: 'open' | 'turn'
  dir: 1 | -1
  /** The section turned from, for the rolling number. */
  from: SectionId | null
}

interface LeavingPage extends Page {
  /** How far the body had scrolled, so the old page leaves from where it was. */
  offset: number
}

interface SectionPanelProps {
  section: SectionId | null
}

/**
 * The folio: one sheet of uncoated card, with two more pages showing beneath
 * it, taken from the room. Built on the native <dialog>, so the page behind is
 * inert while it is open and focus stays inside. Escape, the Close button and
 * clicking the dimmed room all return to the room; focus goes back to whatever
 * opened the panel. Changing section turns the page instead of remounting it.
 */
export function SectionPanel({ section }: SectionPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const inkRef = useRef<HTMLSpanElement>(null)
  const progressRef = useRef<HTMLSpanElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const pageRef = useRef<Page | null>(null)
  const keyRef = useRef(0)
  const [page, setPage] = useState<Page | null>(null)
  const [leaving, setLeaving] = useState<LeavingPage | null>(null)
  const [state, setState] = useState<PanelState>('closed')

  // Open, turn or close in response to the URL.
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (section) {
      if (!dialog.open) {
        const active = document.activeElement
        returnFocusRef.current = active instanceof HTMLElement || active instanceof SVGElement ? (active as HTMLElement) : null
        const next: Page = { id: section, key: ++keyRef.current, enter: 'open', dir: 1, from: null }
        pageRef.current = next
        setPage(next)
        setLeaving(null)
        dialog.showModal()
        // Next frame, so the entry transition runs from the closed styles.
        const frame = requestAnimationFrame(() => setState('open'))
        return () => cancelAnimationFrame(frame)
      }

      setState('open')
      const previous = pageRef.current
      if (previous?.id === section) return
      const dir = turnDirection(previous?.id ?? null, section)
      if (previous) setLeaving({ ...previous, dir, offset: bodyRef.current?.scrollTop ?? 0 })
      const next: Page = { id: section, key: ++keyRef.current, enter: previous ? 'turn' : 'open', dir, from: previous?.id ?? null }
      pageRef.current = next
      setPage(next)
      return
    }

    const finish = () => {
      setState('closed')
      pageRef.current = null
      setPage(null)
      setLeaving(null)
      const target = returnFocusRef.current
      returnFocusRef.current = null
      if (target && target.isConnected && target !== document.body) target.focus({ preventScroll: true })
      // If the opener can't take focus (e.g. after a deep link), return to the room.
      if (!target || target === document.body || document.activeElement !== target) document.getElementById('main')?.focus({ preventScroll: true })
    }

    if (dialog.open) {
      setState('closing')
      const exitMs = readDuration(getComputedStyle(dialog).getPropertyValue('--folio-exit'), 240)
      const timer = window.setTimeout(() => {
        dialog.close()
        finish()
      }, exitMs + 20)
      return () => window.clearTimeout(timer)
    }
    // The browser already closed it (see the close listener below): just tidy up.
    if (pageRef.current) finish()
  }, [section])

  // Let the room step back a touch while a page is out.
  useEffect(() => {
    const root = document.documentElement
    if (state === 'closed') delete root.dataset.panel
    else root.dataset.panel = state
  }, [state])

  useEffect(() => () => void delete document.documentElement.dataset.panel, [])

  // The outgoing page is removed once it has faded.
  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => setLeaving(null), LEAVE_MS)
    return () => window.clearTimeout(timer)
  }, [leaving])

  /** Moves the single ink mark under the current tab. */
  const placeInk = useCallback((animate: boolean) => {
    const ink = inkRef.current
    const tab = tabsRef.current?.querySelector<HTMLElement>('a[aria-current]')
    if (!ink || !tab) return
    const instant = !animate || prefersReducedMotion()
    if (instant) ink.style.transition = 'none'
    ink.style.transform = inkTransform(tab.offsetLeft, tab.offsetWidth)
    ink.style.opacity = '1'
    if (instant) {
      void ink.getBoundingClientRect()
      ink.style.transition = ''
    }
    // Bring the current tab into view in the sideways-scrolling row.
    const nav = navRef.current
    if (nav && nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({ left: tab.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2, behavior: instant ? 'auto' : 'smooth' })
    }
  }, [])

  const updateProgress = useCallback(() => {
    const body = bodyRef.current
    const bar = progressRef.current
    if (!body || !bar) return
    const { fraction, visible } = readingProgress(body.scrollTop, body.scrollHeight, body.clientHeight)
    bar.style.transform = `scaleX(${fraction})`
    bar.toggleAttribute('data-on', visible)
  }, [])

  // Each new page starts at the top, takes focus on its heading, and moves the ink.
  const pageKey = page?.key
  const pageEnter = page?.enter
  useLayoutEffect(() => {
    if (pageKey === undefined) return
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    headingRef.current?.focus({ preventScroll: true })
    placeInk(pageEnter === 'turn')
    updateProgress()
  }, [pageKey, pageEnter, placeInk, updateProgress])

  // Keep the ink true when the tab row changes size (fonts loading, resizing).
  useEffect(() => {
    const tabs = tabsRef.current
    if (!tabs || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (pageRef.current) placeInk(false)
    })
    observer.observe(tabs)
    return () => observer.disconnect()
  }, [placeInk])

  // Lazy content arriving changes the page height; keep the progress honest.
  useEffect(() => {
    const body = bodyRef.current
    const pages = body?.firstElementChild
    if (!body || !pages || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => updateProgress())
    observer.observe(pages)
    return () => observer.disconnect()
  }, [updateProgress])

  const ticking = useRef(false)
  const onBodyScroll = () => {
    if (ticking.current) return
    ticking.current = true
    requestAnimationFrame(() => {
      ticking.current = false
      updateProgress()
    })
  }

  // Escape: let our router close the panel so history and animation stay in sync.
  // Chromium won't let a page cancel Escape before the visitor has clicked or
  // typed in the dialog, and closes it on the spot; when the dialog closes
  // while a section is still open, close the section too.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onCancel = (event: Event) => {
      event.preventDefault()
      closeSection()
    }
    const onClose = () => {
      if (currentSection()) closeSection()
    }
    dialog.addEventListener('cancel', onCancel)
    dialog.addEventListener('close', onClose)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      dialog.removeEventListener('close', onClose)
    }
  }, [])

  // Clicking the dimmed room outside the sheet closes the panel, but not when a
  // text selection that started inside the panel is released over the room.
  const pressStartedOnBackdrop = useRef(false)
  const onDialogPointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    pressStartedOnBackdrop.current = event.target === event.currentTarget
  }
  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (pressStartedOnBackdrop.current && event.target === event.currentTarget) closeSection()
  }

  // Left and right arrow keys move between the tabs.
  const onTabsKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const links = Array.from(tabsRef.current?.querySelectorAll<HTMLAnchorElement>('a') ?? [])
    const index = links.indexOf(document.activeElement as HTMLAnchorElement)
    const target = tabIndexForKey(index, event.key, links.length)
    if (target === null) return
    event.preventDefault()
    links[target]?.focus()
  }

  const current = page?.id ?? null
  const pages = [leaving, page].filter((p): p is Page | LeavingPage => p !== null)

  return (
    <dialog
      ref={dialogRef}
      className="panel"
      data-state={state}
      aria-labelledby="panel-title"
      onPointerDown={onDialogPointerDown}
      onClick={onDialogClick}
    >
      <div className="panel__sheet">
        <div className="panel__bar">
          <nav ref={navRef} className="panel__nav" aria-label="Sections" onKeyDown={onTabsKeyDown}>
            <div ref={tabsRef} className="panel__tabs">
              <ul role="list">
                {SECTION_IDS.map((id) => (
                  <li key={id}>
                    <a href={hrefFor(id)} aria-current={id === current ? 'page' : undefined}>
                      {content.sections[id].navLabel}
                    </a>
                  </li>
                ))}
              </ul>
              <span ref={inkRef} className="panel__ink" aria-hidden="true" />
            </div>
          </nav>
          <button type="button" className="panel__close" onClick={closeSection}>
            <span className="panel__close-text">Close</span>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
          <span ref={progressRef} className="panel__progress" aria-hidden="true" />
        </div>

        <div ref={bodyRef} className="panel__body" onScroll={onBodyScroll}>
          <div className="panel__pages">
            {pages.map((p) => (
              <FolioPage
                key={p.key}
                page={p}
                leaving={'offset' in p ? p : null}
                headingRef={'offset' in p ? undefined : headingRef}
              />
            ))}
          </div>
        </div>
      </div>
    </dialog>
  )
}

interface FolioPageProps {
  page: Page
  /** Set while this page is turning away. */
  leaving: LeavingPage | null
  headingRef?: Ref<HTMLHeadingElement>
}

function FolioPage({ page, leaving, headingRef }: FolioPageProps) {
  const { id, enter, dir, from } = page
  const meta = content.sections[id]
  const index = SECTION_IDS.indexOf(id)
  const fromIndex = from ? SECTION_IDS.indexOf(from) : -1
  const rolls = !leaving && enter === 'turn' && fromIndex >= 0
  const Content = SECTION_COMPONENTS[id]

  return (
    <article
      className={leaving ? 'panel__page is-leaving' : 'panel__page'}
      data-enter={leaving ? undefined : enter}
      data-section={id}
      style={{ '--dir': leaving ? leaving.dir : dir, marginTop: leaving ? -leaving.offset : undefined } as CSSProperties}
      aria-hidden={leaving ? true : undefined}
      inert={leaving ? true : undefined}
    >
      <header className="panel__header">
        <p className="panel__meta">
          <span className="panel__count">
            <span className="panel__num" data-roll={rolls ? '' : undefined}>
              {rolls && (
                <span className="panel__num-from" aria-hidden="true">
                  {pad(fromIndex + 1)}
                </span>
              )}
              <span className="panel__num-to">{pad(index + 1)}</span>
            </span>{' '}
            / {pad(SECTION_IDS.length)}
          </span>
        </p>
        <h2 id={leaving ? undefined : 'panel-title'} ref={headingRef} tabIndex={-1} className="panel__title">
          {meta.title}
        </h2>
      </header>

      <Suspense fallback={<p className="panel__loading">Opening…</p>}>
        <Content />
      </Suspense>

    </article>
  )
}
