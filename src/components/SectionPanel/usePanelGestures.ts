import { useEffect, type RefObject } from 'react'
import { SECTION_IDS, type SectionId } from '../../content/types'
import { closeSection, currentSection, hrefFor } from '../../lib/router'
import { prefersReducedMotion } from '../../lib/motion'
import { FOLLOW_PX, createRecognizer, createRoomRecognizer, createTouchSwipe, type WheelInput } from './panelGestures'

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

    /** Turns to the next (1) or previous (-1) section; the sections loop round at the ends. */
    const turn = (go: 1 | -1) => {
      carry()
      const here = currentSection()
      const n = SECTION_IDS.length
      const next = here ? SECTION_IDS[(SECTION_IDS.indexOf(here) + go + n) % n] : undefined
      if (next) {
        swiped = { to: next, dir: go, at: performance.now() }
        window.location.hash = hrefFor(next)
      }
    }

    // Touch (phones, tablets): one finger swiping sideways turns the section. Nothing else: opening
    // and closing stay with the room's objects and the close button.
    const touch = createTouchSwipe()
    const onTouchStart = (event: TouchEvent) => {
      if (!dialog.open || performance.now() - openedAt < SETTLE_MS) return
      if (event.touches.length > 1) {
        touch.cancel()
        setLean(0)
        return
      }
      const f = event.touches[0]!
      const target = event.target instanceof Element ? event.target : null
      // the record crate flips with a sideways drag of its own
      const claimed = target?.closest('.crate') ? true : (sideScroller(target, dialog) ?? false)
      touch.start({ t: event.timeStamp, x: f.clientX, y: f.clientY, width: window.innerWidth, claimed })
    }
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        touch.cancel()
        setLean(0)
        return
      }
      const f = event.touches[0]!
      const { lean } = touch.move(f.clientX, f.clientY, event.timeStamp)
      // a sideways swipe: the page doesn't also scroll up or down under it
      if (lean !== 0 && event.cancelable) event.preventDefault()
      if (!handing) setLean(lean)
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length > 0) return
      const { go } = touch.end(event.timeStamp)
      if (go) turn(go)
      else if (!handing) setLean(0)
    }
    const onTouchCancel = () => {
      touch.cancel()
      touch.end(0)
      setLean(0)
    }

    const onWheel = (event: WheelEvent) => {
      if (!media.matches || !dialog.open) return
      // still arriving: this gesture doesn't count
      if (performance.now() - openedAt < SETTLE_MS) {
        rec.hold(event.timeStamp)
        setLean(0)
        return
      }
      const overRoom = event.target === dialog
      const out = rec.feed({
        t: event.timeStamp,
        dx: event.deltaX,
        dy: event.deltaY,
        mode: event.deltaMode,
        ctrl: event.ctrlKey,
        ctrlHeld,
        shift: event.shiftKey,
        // anywhere on the site counts: over the dimmed room, it's the panel's page that's read
        scroller: overRoom ? null : sideScroller(event.target, dialog),
        atTop: atTop(overRoom ? dialog.querySelector('.panel__body') : event.target, dialog),
      })
      if (out.prevent && event.cancelable) event.preventDefault()

      if (out.go) turn(out.go)
      else if (!handing) setLean(out.lean, out.pull ?? 0)
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
    dialog.addEventListener('touchstart', onTouchStart, { passive: true })
    dialog.addEventListener('touchmove', onTouchMove, { passive: false })
    dialog.addEventListener('touchend', onTouchEnd, { passive: true })
    dialog.addEventListener('touchcancel', onTouchCancel, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', onBlur)
    return () => {
      dialog.removeEventListener('wheel', onWheel)
      dialog.removeEventListener('touchstart', onTouchStart)
      dialog.removeEventListener('touchmove', onTouchMove)
      dialog.removeEventListener('touchend', onTouchEnd)
      dialog.removeEventListener('touchcancel', onTouchCancel)
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

/**
 * Whether something under the pointer, or the page itself, can still scroll that way (down for a
 * positive dy, up for a negative one), by more than a hair.
 */
function canScroll(target: EventTarget | null, dy: number): boolean {
  const room = (el: Element) => (dy > 0 ? el.scrollHeight - el.clientHeight - el.scrollTop > 4 : el.scrollTop > 4)
  let el = target instanceof Element ? target : null
  while (el && el !== document.documentElement && el !== document.body) {
    if (room(el)) {
      const y = getComputedStyle(el).overflowY
      if (y === 'auto' || y === 'scroll') return true
    }
    el = el.parentElement
  }
  const root = document.scrollingElement
  return !!root && getComputedStyle(root).overflowY !== 'hidden' && room(root)
}

/** After the panel closes, the closing gesture's own tail never reopens it. */
const ROOM_REST_MS = 900

/**
 * In the room (no panel out), a scroll down opens About, the first section, poured by the genie
 * like a click on its object. Desktop only; never while the room is still entering, while anything
 * else is open over it (the piano, the sound sheet), or while the page itself could scroll.
 */
export function useRoomScrollOpen(closed: boolean, settled: Promise<void>) {
  useEffect(() => {
    if (!closed) return
    const media = window.matchMedia(GESTURE_MEDIA)
    const rec = createRoomRecognizer()
    const since = performance.now()
    let ready = false
    let live = true
    void settled.then(() => {
      if (live) ready = true
    })
    const onWheel = (event: WheelEvent) => {
      if (!media.matches) return
      const target = event.target instanceof Element ? event.target : null
      const over = !!document.querySelector('dialog[open]') || !!target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')
      // A scroll with nothing to scroll would only bounce the whole screen (a Mac's rubber band)
      // before About pours out: it's stopped. Never a zoom, and never where something can scroll.
      const vertical = Math.abs(event.deltaY) > Math.abs(event.deltaX)
      if (!over && !event.ctrlKey && vertical && event.cancelable && !canScroll(target, event.deltaY)) event.preventDefault()
      const busy =
        !ready ||
        performance.now() - since < ROOM_REST_MS ||
        over
      if (busy) {
        rec.hold(event.timeStamp)
        return
      }
      const open = rec.feed({
        t: event.timeStamp,
        dx: event.deltaX,
        dy: event.deltaY,
        mode: event.deltaMode,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        canScrollDown: canScroll(target, 1),
      })
      if (open && !currentSection()) window.location.hash = hrefFor(SECTION_IDS[0])
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      live = false
      window.removeEventListener('wheel', onWheel)
    }
  }, [closed, settled])
}
