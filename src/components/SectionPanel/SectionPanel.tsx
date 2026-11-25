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
import { animationMs, prefersReducedMotion } from '../../lib/motion'
import { sectionComponent } from '../sections/registry'
import { lampParts } from '../../scene/scene-layout.json'
import {
  lampOnSheet,
  tabRowScroll,
  readDuration,
  readingProgress,
  tabIndexForKey,
  turnDirection,
} from './folio'
import { asLight, placeReflection, prepareReflections } from './glass'
import { panelGeometry } from './panelGeometry'
import '../sections/sections.css'
import '../sections/panel-sections.css'
import './SectionPanel.css'
import './turn-fx.css'
import { HeaderArt } from './HeaderArt'
import { moveInk } from './liquidInk'
import { clearLight, passLight } from './turnLight'
import { closeAfterPour, useGenie } from './genie/useGenie'

/**
 * Lights the glass from the room's desk lamp: where its bulb is, as --lamp-x and --lamp-y on
 * the dialog (SectionPanel.css draws the rim and the bloom there). Measured from the dialog,
 * which the sheet fills and which never moves, so the sheet's own slide can't skew it.
 */
function placeLamp(dialog: HTMLDialogElement) {
  const art = document.querySelector('.scene-object--lamp .scene-object__art') ?? document.querySelector('.scene-object--lamp')
  const box = art?.getBoundingClientRect()
  // On wide screens the sheet floats beside the room, sized from its frame and kept clear of the
  // lamp (panelGeometry.ts). Set before the sheet is measured below.
  placeOnRoom(dialog, box && box.width > 0 ? box : null)
  const [fx, fy] = lampParts.bulb
  const bulb = box && box.width > 0 ? { x: box.left + box.width * fx!, y: box.top + box.height * fy! } : null
  const at = bulb ? lampOnSheet(bulb, dialog.getBoundingClientRect()) : null
  for (const [name, value] of [['--lamp-x', at?.x], ['--lamp-y', at?.y]] as const) {
    if (value === undefined) dialog.style.removeProperty(name)
    else dialog.style.setProperty(name, `${value}%`)
  }
  // ...and the room it reflects: the still for this light, laid where the room's mirror image falls.
  placeReflection(dialog, bulb)
}

/** Lays the sheet beside the room's frame on wide screens; elsewhere it keeps its own layout. */
function placeOnRoom(dialog: HTMLDialogElement, lamp: DOMRect | null) {
  const room = document.querySelector('.stage')?.getBoundingClientRect()
  const gap = parseFloat(getComputedStyle(dialog).getPropertyValue('--sheet-gap')) || 12
  const g = room
    ? panelGeometry({
        room,
        lamp,
        controls: document.querySelector('.time-control')?.getBoundingClientRect() ?? null,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        gap,
      })
    : null
  const vars = [['--panel-top', g?.top], ['--panel-right', g?.right], ['--panel-w', g?.width], ['--panel-h', g?.height]] as const
  for (const [name, value] of vars) {
    if (value === undefined) dialog.style.removeProperty(name)
    else dialog.style.setProperty(name, `${value}px`)
  }
  if (g) dialog.dataset.geometry = 'room'
  else delete dialog.dataset.geometry
}

/** The outgoing page's slide in SectionPanel.css, for when its animations can't be read. */
const LEAVE_FALLBACK_MS = 260

type PanelState = 'closed' | 'open' | 'closing'

interface Page {
  id: SectionId
  /** A fresh key per visit, so the incoming page always replays its entrance. */
  key: number
  /** Opening rises; turning moves with the direction of travel. */
  enter: 'open' | 'turn'
  dir: 1 | -1
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
  const sheetRef = useRef<HTMLDivElement>(null)
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
  // Wide screens with a mouse: the glass pours out of its object and back (genie/genie.ts).
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const genieRef = useGenie(dialogRef, canvasRef, placeLamp)

  // Open, turn or close in response to the URL.
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (section) {
      if (!dialog.open) {
        const active = document.activeElement
        returnFocusRef.current = active instanceof HTMLElement || active instanceof SVGElement ? (active as HTMLElement) : null
        const next: Page = { id: section, key: ++keyRef.current, enter: 'open', dir: 1 }
        pageRef.current = next
        setPage(next)
        setLeaving(null)
        dialog.showModal()
        placeLamp(dialog)
        genieRef.current?.open(section)
        // Next frame, so the entry transition runs from the closed styles.
        const frame = requestAnimationFrame(() => setState('open'))
        return () => cancelAnimationFrame(frame)
      }

      setState('open')
      // Back while it was closing: the glass pours out again from where it is.
      genieRef.current?.reopen()
      const previous = pageRef.current
      if (previous?.id === section) return
      const dir = turnDirection(previous?.id ?? null, section)
      if (previous) setLeaving({ ...previous, dir, offset: bodyRef.current?.scrollTop ?? 0 })
      const next: Page = { id: section, key: ++keyRef.current, enter: previous ? 'turn' : 'open', dir }
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
      // A light still passing from a last turn goes at once: nothing of it rides the close.
      clearLight(sheetRef.current)
      // Poured open: it pours back into the object of the page shown, and the dialog closes after.
      const pour = genieRef.current?.close(pageRef.current?.id ?? null)
      if (pour) {
        let live = true
        void closeAfterPour(pour, dialog, () => live, finish)
        // Reopening mid-close lands here first: the pour turns round (reopen above).
        return () => {
          live = false
        }
      }
      // The dialog goes when the sheet's own fade ends, so the exit is never cut
      // short. The fade, not the slide: it always ends last, also when a close
      // reverses an opening that's only part-way (both were shortened, and the fade
      // had got further), and with reduced motion it's all there is. Transitions
      // inside the sheet (ink, progress, links) bubble up, hence the target check;
      // and an opening fade that happens to end just as the close begins doesn't
      // count, hence the check that the sheet really is gone.
      const sheet = sheetRef.current
      let timer = 0
      const onEnd = (event: TransitionEvent) => {
        if (event.target !== sheet || event.propertyName !== 'opacity') return
        if (getComputedStyle(event.target as Element).opacity === '0') remove()
      }
      // Backup for when the end is missed, timed from when the fade actually starts
      // (a busy page can start it well after this effect), with a longer first wait
      // for when no fade runs at all (the sheet never got as far as open).
      const exitMs = readDuration(getComputedStyle(dialog).getPropertyValue('--folio-exit'), 260)
      const arm = (ms: number) => {
        window.clearTimeout(timer)
        timer = window.setTimeout(remove, ms)
      }
      const onRun = (event: TransitionEvent) => {
        if (event.target === sheet && event.propertyName === 'opacity') arm(exitMs + 100)
      }
      const stop = () => {
        window.clearTimeout(timer)
        sheet?.removeEventListener('transitionend', onEnd)
        sheet?.removeEventListener('transitionrun', onRun)
      }
      const remove = () => {
        stop()
        dialog.close()
        finish()
      }
      sheet?.addEventListener('transitionend', onEnd)
      sheet?.addEventListener('transitionrun', onRun)
      arm(exitMs + 600)
      // Reopening mid-close lands here first, so the old exit can't close the new page.
      return stop
    }
    // The browser already closed it (see the close listener below): just tidy up.
    if (pageRef.current) finish()
  }, [section])

  // Mark the page while a panel is out (html[data-panel]). The room itself stays still;
  // HeroScene.css uses it to hide the rain and tower loops behind the phone sheet.
  useEffect(() => {
    const root = document.documentElement
    if (state === 'closed') delete root.dataset.panel
    else root.dataset.panel = state
  }, [state])

  useEffect(() => () => void delete document.documentElement.dataset.panel, [])

  // The glass's reflection stills are fetched and decoded while the page is idle, so the first
  // open never waits on them.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2500))
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    const handle = idle(() => prepareReflections(asLight(document.querySelector('.scene')?.getAttribute('data-time'))), { timeout: 6000 })
    return () => cancel(handle)
  }, [])

  // The room is laid out again on a resize, and the lamp with it: the glass follows its light.
  // (Measured once more as the sheet arrives, for a deep link that opened before the room.)
  useEffect(() => {
    if (state !== 'open') return
    const dialog = dialogRef.current
    if (!dialog) return
    placeLamp(dialog)
    let frame = 0
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => placeLamp(dialog))
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [state])

  // The outgoing page is removed once it has faded and slid away (read from its own
  // animations, so reduced motion's shorter fade lets it go sooner), with a frame to spare.
  useEffect(() => {
    if (!leaving) return
    const page = bodyRef.current?.querySelector('.panel__page.is-leaving')
    const timer = window.setTimeout(() => setLeaving(null), animationMs(page, LEAVE_FALLBACK_MS) + 20)
    return () => window.clearTimeout(timer)
  }, [leaving])

  /** Moves the single ink mark under the current tab: on a turn it flows there (liquidInk.ts). */
  const placeInk = useCallback((animate: boolean) => {
    const ink = inkRef.current
    const tab = tabsRef.current?.querySelector<HTMLElement>('a[aria-current]')
    if (!ink || !tab) return
    const instant = !animate || prefersReducedMotion()
    moveInk(ink, { left: tab.offsetLeft, width: tab.offsetWidth }, !instant)
    ink.style.opacity = '1'
    // Bring the current tab into view in the sideways-scrolling row, starting at a tab's edge.
    const nav = navRef.current
    if (nav && nav.scrollWidth > nav.clientWidth) {
      const links = Array.from(tabsRef.current?.querySelectorAll<HTMLElement>('a') ?? [])
      const faded = getComputedStyle(nav).maskImage !== 'none' ? nav.clientWidth * 0.2 : 0
      const left = tabRowScroll(
        links.map((a) => ({ left: a.offsetLeft, width: a.offsetWidth })),
        links.indexOf(tab),
        nav.clientWidth,
        nav.scrollWidth - nav.clientWidth,
        faded,
      )
      nav.scrollTo({ left, behavior: instant ? 'auto' : 'smooth' })
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
  const pageDir = page?.dir
  useLayoutEffect(() => {
    if (pageKey === undefined) return
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    headingRef.current?.focus({ preventScroll: true })
    placeInk(pageEnter === 'turn')
    // A turn: the lamp's light passes through the glass as the pages exchange (turnLight.ts).
    if (pageEnter === 'turn' && pageDir) passLight(sheetRef.current, pageDir)
    updateProgress()
  }, [pageKey, pageEnter, pageDir, placeInk, updateProgress])

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
      <canvas ref={canvasRef} className="panel__genie" aria-hidden="true" />
      <div ref={sheetRef} className="panel__sheet">
        {/* The glass's window sheen, bevels and speculars (SectionPanel.css): paint only. */}
        <span className="panel__sheen" aria-hidden="true" />
        <span className="panel__glass" aria-hidden="true" />
        <div className="panel__bar">
          <nav
            ref={navRef}
            className="panel__nav"
            aria-label="Sections"
            onKeyDown={onTabsKeyDown}
            // The row rests on a tab's edge; only when it stops mid-word (at the very end of the row)
            // does its start fade too, so a cut word never shows and a whole tab is never faded.
            onScroll={(event) => {
              const nav = event.currentTarget
              const x = nav.scrollLeft
              const onEdge = Array.from(nav.querySelectorAll('a')).some((a) => Math.abs(a.offsetLeft - x) <= 2)
              nav.toggleAttribute('data-scrolled', x > 2 && !onEdge)
            }}
          >
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
  const { id, enter, dir } = page
  const meta = content.sections[id]
  // Chosen once per page: a preloaded section renders at once with no fallback.
  // Swapping from lazy to plain on a later render would remount the content.
  const [Content] = useState(() => sectionComponent(id))

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
        <h2 id={leaving ? undefined : 'panel-title'} ref={headingRef} tabIndex={-1} className="panel__title">
          {meta.title}
        </h2>
        <HeaderArt id={id} />
      </header>

      <Suspense fallback={<p className="panel__loading">Opening…</p>}>
        <Content />
      </Suspense>
    </article>
  )
}
