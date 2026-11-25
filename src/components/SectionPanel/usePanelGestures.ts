import { useEffect, type RefObject } from 'react'
import { SECTION_IDS, type SectionId } from '../../content/types'
import { closeSection, currentSection, hrefFor } from '../../lib/router'
import { prefersReducedMotion } from '../../lib/motion'
import { FOLLOW_PX, createRecognizer, type WheelInput } from './panelGestures'

/** Desktop with a trackpad or mouse: phones and tablets keep their own touch behaviour. */
const GESTURE_MEDIA = '(min-width: 640px) and (hover: hover) and (pointer: fine)'
/** After the panel opens, the pour and the first page land before a gesture counts. */
const SETTLE_MS = 900
/**
 * The direction of a swipe's turn, for the page that it brings: the sections loop, so a swipe
 * forward from the last one comes round to the first, and its pages must still move forward.
 */
let swiped: { to: SectionId; dir: 1 | -1; at: number } | null = null
export function swipeDirection(to: SectionId): 1 | -1 | null {
  const s = swiped
  swiped = null
  return s && s.to === to && performance.now() - s.at < 1000 ? s.dir : null
}

/** Something under the pointer that scrolls sideways itself (a shelf, the tab row), and which ways it can still go. */
function sideScroller(target: EventTarget | null, stop: Element): WheelInput['scroller'] {
  let el = target instanceof Element ? target : null
  while (el && el !== stop) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const x = getComputedStyle(el).overflowX
      if (x === 'auto' || x === 'scroll')
        return { forward: el.scrollLeft + el.clientWidth < el.scrollWidth - 1, back: el.scrollLeft > 1 }
    }
    el = el.parentElement
  }
  return null
}

/** Whether everything that scrolls up and down under the pointer is at its top (the page, a list). */
function atTop(target: EventTarget | null, stop: Element): boolean {
  let el = target instanceof Element ? target : null
  while (el && el !== stop) {
    if (el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 0) {
      const y = getComputedStyle(el).overflowY
      if (y === 'auto' || y === 'scroll') return false
    }
    el = el.parentElement
  }
  return true
}

/**
 * Trackpad gestures on the open panel (panelGestures.ts reads them): a two-finger swipe turns to
 * the next or previous section (looping round at the ends), the page leaning a little with the
 * fingers first; a pinch in, or a scroll up begun at the top of the page (the page following down a
 * little first), closes the panel. `openedAt` is when the panel last opened (performance.now()), or
 * null while closed.
 */
export function usePanelGestures(
  dialogRef: RefObject<HTMLDialogElement | null>,
  pagesRef: RefObject<HTMLElement | null>,
  openedAt: number | null,
) {
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || openedAt === null) return
    const media = window.matchMedia(GESTURE_MEDIA)
    const rec = createRecognizer()
    let endTimer = 0
    let carryTimer = 0
    let leanPx = 0
    // Control physically down: a ctrl-wheel is then the browser's zoom, not a trackpad pinch
    let ctrlHeld = false
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Control') ctrlHeld = event.type === 'keydown'
    }
    const onBlur = () => (ctrlHeld = false)

    let pullPx = 0
    /** The pages follow the fingers: sideways for a swipe (`k`), down for a pull to close (`p`). */
    const setLean = (k: number, p = 0) => {
      const pages = pagesRef.current
      if (!pages) return
      const reduce = prefersReducedMotion()
      const px = reduce ? 0 : k * FOLLOW_PX
      const py = reduce ? 0 : p * FOLLOW_PX
      if (px === leanPx && py === pullPx) return
      const rest = px === 0 && py === 0
      // following the fingers: quick; settling back: eased
      pages.style.transition = rest ? 'transform 260ms var(--ease-out)' : 'transform 60ms linear'
      pages.style.transform = rest ? '' : `translate(${px.toFixed(2)}px, ${py.toFixed(2)}px)`
      leanPx = px
      pullPx = py
    }

    /**
     * A turn: the leaning page leaves from where the fingers left it and the new one isn't moved.
     * The lean moves from the pages to the leaving page in the frame the turn renders (watched for
     * below), never before it: moving it at the swipe would show the old page jump back for a frame.
     */
    let handing = false
    const carry = () => {
      dialog.style.setProperty('--swipe-carry', `${leanPx.toFixed(2)}px`)
      handing = true
      window.clearTimeout(carryTimer)
      carryTimer = window.setTimeout(() => {
        handOver()
        dialog.style.removeProperty('--swipe-carry')
      }, 450)
    }
    const handOver = () => {
      if (!handing) return
      handing = false
      const pages = pagesRef.current
      if (pages) {
        pages.style.transition = ''
        pages.style.transform = ''
      }
      leanPx = 0
      pullPx = 0
    }
    // a mutation observer runs before the frame paints, so the hand-over is seamless
    const watch = new MutationObserver(() => {
      if (handing && pagesRef.current?.querySelector('.panel__page.is-leaving')) handOver()
    })
    if (pagesRef.current) watch.observe(pagesRef.current, { childList: true, subtree: true, attributeFilter: ['class'] })

    const onWheel = (event: WheelEvent) => {
      if (!media.matches || !dialog.open) return
      // still arriving, or over the dimmed room rather than the panel: this gesture doesn't count
      if (performance.now() - openedAt < SETTLE_MS || event.target === dialog) {
        rec.hold(event.timeStamp)
        setLean(0)
        return
      }
      const out = rec.feed({
        t: event.timeStamp,
        dx: event.deltaX,
        dy: event.deltaY,
        mode: event.deltaMode,
        ctrl: event.ctrlKey,
        ctrlHeld,
        shift: event.shiftKey,
        scroller: sideScroller(event.target, dialog),
        atTop: atTop(event.target, dialog),
      })
      if (out.prevent && event.cancelable) event.preventDefault()

      if (out.go) {
        carry()
        const here = currentSection()
        const n = SECTION_IDS.length
        // the sections loop: past the last comes the first, before the first the last
        const next = here ? SECTION_IDS[(SECTION_IDS.indexOf(here) + out.go + n) % n] : undefined
        if (next) {
          swiped = { to: next, dir: out.go, at: performance.now() }
          window.location.hash = hrefFor(next)
        }
      } else if (!handing) setLean(out.lean, out.pull ?? 0)
      if (out.close) {
        setLean(0)
        closeSection()
      }

      // fingers lifted without turning: the page settles back
      window.clearTimeout(endTimer)
      endTimer = window.setTimeout(() => {
        if (!handing) setLean(0)
      }, 200)
    }

    dialog.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', onBlur)
    return () => {
      dialog.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', onBlur)
      window.clearTimeout(endTimer)
      window.clearTimeout(carryTimer)
      watch.disconnect()
      dialog.style.removeProperty('--swipe-carry')
      const pages = pagesRef.current
      if (pages) {
        pages.style.transform = ''
        pages.style.transition = ''
      }
    }
  }, [dialogRef, pagesRef, openedAt])
}
