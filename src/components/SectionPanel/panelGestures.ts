/**
 * Trackpad gestures inside the open panel (desktop): a two-finger swipe left or right turns to the
 * next or previous section; a pinch in, or a scroll up begun at the very top of the page, closes the
 * panel. Reading scrolls are never gestures: a scroll up that arrives at the top while scrolling,
 * momentum included, stops there, and only a new one, from rest at the top, pulls the panel shut.
 *
 * Browsers only send wheel events (no touch phases), so this reads them as gestures, and it is
 * careful, so nothing fires by accident:
 *   - One gesture is a run of wheel events with no gap longer than GAP_MS. Its axis is decided from
 *     its first AXIS_PX of travel: only a clearly sideways start (dx at least AXIS_RATIO times dy) is
 *     a swipe. A scroll that drifts sideways later stays a scroll. A swipe that turns out to be a
 *     scroll (fingers landing with a sideways roll, then scrolling down) is given back to the page
 *     as soon as the vertical travel takes over, and it never turns.
 *   - A swipe turns once, at SWIPE_PX sideways, and only while it is still mostly sideways. The rest
 *     of that gesture, its momentum included, is spent (a scroll that starts in it scrolls), and no
 *     second turn can come within COOLDOWN_MS of the first. A run that opens with a big step is
 *     momentum a busy page merged into one event after a pause, never a new swipe.
 *   - A fresh sideways push during a scroll's momentum (steps that grow, which momentum never does)
 *     starts a new gesture, so a swipe right after scrolling is caught.
 *   - A swipe that starts over something that scrolls sideways itself (a shelf, the tab row) and can
 *     still move that way is left to it for the whole gesture, never chained into a turn; at its
 *     end, the next swipe turns.
 *   - Mouse wheels are not gestures: line or page steps, big pixel steps, Shift held (a sideways
 *     mouse scroll), or Control physically held (Ctrl+wheel zooms) are left to the browser.
 *   - A pinch is what browsers send for a trackpad pinch: ctrl-wheel with no Control key down. It
 *     closes once it has pinched in PINCH_PX; a pinch out is the browser's own zoom, left alone.
 *     The first plain scroll event ends a pinch.
 *   - Nothing counts while the panel is still arriving (hold()), nor the rest of a gesture begun then.
 * The recogniser is pure (no DOM), so it is tested on its own; usePanelGestures wires it up.
 */

export const GAP_MS = 180
export const AXIS_PX = 10
export const AXIS_RATIO = 1.5
export const SWIPE_PX = 80
export const PINCH_PX = 70
/** No second turn sooner than this after a turn (about the turn's own length). */
export const COOLDOWN_MS = 450
/** A single wheel step larger than this isn't a trackpad. */
export const STEP_MAX = 60
/** How far the page follows the fingers before a swipe turns (px, with resistance). */
export const FOLLOW_PX = 22
/** A fresh push inside a tail of momentum: sideways steps growing this many times in a row. */
const PUSH_RISES = 2
const PUSH_MIN = 4
/** A scroll up that starts at the top of the page closes the panel once it has pulled this far. */
export const PULL_PX = 70
/** A new gesture's first step is no bigger than this (fingers start from rest). */
const FIRST_MAX = 40
/** Vertical travel that gives a spent swipe's run back to the page as a scroll. */
const SCROLL_TAKEOVER_PX = 20

export interface WheelInput {
  /** event.timeStamp, ms */
  t: number
  dx: number
  dy: number
  /** deltaMode: 0 pixels, 1 lines, 2 pages */
  mode: number
  /** event.ctrlKey: a trackpad pinch, or Control held with a wheel */
  ctrl: boolean
  /** The Control key is physically down (so a ctrl-wheel is a zoom, not a pinch). */
  ctrlHeld?: boolean
  shift?: boolean
  /**
   * Under the pointer, something that scrolls sideways itself (a shelf, the tab row): whether it
   * can still move toward positive dx (its content further right) and toward negative dx.
   */
  scroller: { forward: boolean; back: boolean } | null
  /** The page is scrolled to its top (or doesn't scroll). */
  atTop?: boolean
}

export type GestureAxis = 'none' | 'x' | 'y' | 'up' | 'pinch' | 'ignore'

export interface GestureOut {
  /** How far the page leans with the fingers: -1..1 of FOLLOW_PX, 0 at rest. */
  lean: number
  /** How far the page is pulled down by a scroll up from the top: 0..1 of FOLLOW_PX. */
  pull?: number
  /** Turn to the next (1) or previous (-1) section. */
  go?: 1 | -1
  close?: true
  /**
   * The browser's own reaction to this event must be stopped: only a pinch's (the page's zoom).
   * Swipes and scrolls are never cancelled: Chrome lets the first wheel event of a scroll decide for
   * the whole of it, so cancelling one that later turns out to be a scroll would freeze that scroll.
   * The browser's back/forward swipe is held off in CSS instead (overscroll-behavior-x).
   */
  prevent: boolean
}

interface State {
  last: number
  axis: GestureAxis
  sx: number
  sy: number
  pinch: number
  spent: boolean
  /** Vertical travel since the swipe was spent. */
  after: number
  /** The last sideways step and how many times in a row they've grown (a new push). */
  prevDx: number
  rises: number
  /** The same for upward steps at the top of the page (fingers pulling again after a scroll). */
  prevDy: number
  risesUp: number
  /** The gesture began with the fingers at rest (after a pause), not inside a running scroll. */
  fromRest: boolean
}

const fresh = (): State => ({
  last: -Infinity,
  axis: 'none',
  sx: 0,
  sy: 0,
  pinch: 0,
  spent: false,
  after: 0,
  prevDx: 0,
  rises: 0,
  prevDy: 0,
  risesUp: 0,
  fromRest: false,
})

/** Resistance: follows the fingers at first, then less and less (never past 1). */
export const lean = (px: number) =>
  Math.sign(px) * Math.min(1, (1 - Math.exp(-Math.abs(px) / SWIPE_PX)) / (1 - Math.exp(-1)))

const REST: GestureOut = { lean: 0, prevent: false }

export function createRecognizer() {
  let s = fresh()
  let lastGo = -Infinity

  /** A sideways gesture moves on: it leans with the fingers, and turns once, at SWIPE_PX. */
  const swipe = (t: number, dx: number, dy: number): GestureOut => {
    if (s.spent) {
      // fingers down again and scrolling: the page scrolls
      if (Math.abs(dy) > Math.abs(dx)) s.after += Math.abs(dy)
      if (s.after > SCROLL_TAKEOVER_PX) {
        s.axis = 'y'
        return REST
      }
      return { lean: 0, prevent: false }
    }
    s.sx += dx
    s.sy += dy
    // it was a scroll after all (a sideways roll as the fingers landed): give it back, untouched
    if (Math.abs(s.sy) * AXIS_RATIO > Math.abs(s.sx)) {
      s.axis = 'y'
      return REST
    }
    if (Math.abs(s.sx) >= SWIPE_PX) {
      s.spent = true
      if (t - lastGo < COOLDOWN_MS) return { lean: 0, prevent: false }
      lastGo = t
      // fingers moving left (positive dx) bring the next section in from the right
      return { lean: 0, go: s.sx > 0 ? 1 : -1, prevent: false }
    }
    return { lean: lean(-s.sx), prevent: false }
  }

  /** A scroll up from the top: the page follows down a little, and the panel closes at PULL_PX. */
  const pull = (dx: number, dy: number, _t: number): GestureOut => {
    if (s.spent) return { lean: 0, prevent: false }
    s.sx += dx
    s.sy += dy
    // it went sideways or turned back down: just a scroll
    if (Math.abs(s.sx) > Math.abs(s.sy) || s.sy > 0) {
      s.axis = 'y'
      return REST
    }
    if (-s.sy >= PULL_PX) {
      s.spent = true
      return { lean: 0, pull: 0, close: true, prevent: false }
    }
    return { lean: 0, pull: Math.min(1, -s.sy / PULL_PX), prevent: false }
  }

  return {
    /** Whether the current gesture has ended by `t` (no event for GAP_MS). */
    ended(t: number) {
      return t - s.last > GAP_MS
    },
    /** The panel isn't ready: this event, and the rest of its gesture, count for nothing. */
    hold(t: number) {
      s = { ...fresh(), last: t, axis: 'ignore' }
    },
    reset() {
      s = fresh()
      lastGo = -Infinity
    },
    feed(e: WheelInput): GestureOut {
      let started = false
      if (e.t - s.last > GAP_MS) {
        s = { ...fresh(), fromRest: true }
        started = true
      }
      s.last = e.t
      const stepped = e.mode !== 0 || Math.abs(e.dx) > STEP_MAX || Math.abs(e.dy) > STEP_MAX
      const mouse = stepped || !!e.shift || (e.ctrl && !!e.ctrlHeld)

      // The first plain scroll after a pinch is a scroll, not more pinch.
      if (s.axis === 'pinch' && !e.ctrl) {
        const { last } = s
        s = { ...fresh(), last }
      }

      // A new sideways push while a scroll's (or a spent swipe's) momentum is still running: momentum
      // only ever slows, so sideways steps that grow, clearly sideways, are fingers on the pad again.
      const ax = Math.abs(e.dx)
      const sideways = !e.ctrl && !mouse && ax >= PUSH_MIN && ax >= AXIS_RATIO * Math.abs(e.dy)
      s.rises =
        sideways && ax > Math.abs(s.prevDx) && Math.sign(e.dx) === Math.sign(s.prevDx || e.dx) ? s.rises + 1 : 0
      s.prevDx = e.dx
      const tail = s.axis === 'y' || (s.axis === 'x' && s.spent)
      if (tail && s.rises >= PUSH_RISES) {
        const { last, prevDx, rises } = s
        s = { ...fresh(), last, prevDx, rises }
      }
      // Likewise upward: a scroll that has just reached the top, then fingers pulling up again before
      // its glide has died away (growing upward steps, at the top), is a fresh pull.
      const up = -e.dy
      const upward = !e.ctrl && !mouse && !!e.atTop && up >= PUSH_MIN && up >= AXIS_RATIO * ax
      s.risesUp = upward && up > -s.prevDy ? s.risesUp + 1 : 0
      s.prevDy = e.dy
      if (s.axis === 'y' && s.risesUp >= PUSH_RISES) {
        const { last, prevDx, prevDy, risesUp } = s
        s = { ...fresh(), last, prevDx, prevDy, risesUp, fromRest: true }
      }

      if (s.axis === 'none') {
        // fingers start from rest: a run that opens with a big step is momentum a busy page merged
        // into one event after a pause, not a new swipe (read as a scroll: a fresh push still counts)
        if (mouse) s.axis = 'ignore'
        else if (started && Math.max(Math.abs(e.dx), Math.abs(e.dy)) > FIRST_MAX) s.axis = 'y'
        else if (e.ctrl) s.axis = 'pinch'
        else {
          s.sx += e.dx
          s.sy += e.dy
          // undecided: wait for more travel (never cancelled: it may well be a scroll)
          if (Math.hypot(s.sx, s.sy) < AXIS_PX) return { lean: 0, prevent: false }
          s.axis = Math.abs(s.sx) >= AXIS_RATIO * Math.abs(s.sy) ? 'x' : 'y'
          // a scroll up begun at the top of the page (from rest, not a scroll arriving there) pulls
          // the page down, to close
          if (s.axis === 'y' && s.sy < 0 && e.atTop && s.fromRest) {
            s.axis = 'up'
            const sy = s.sy
            s.sx = 0
            s.sy = 0
            return pull(0, sy, e.t)
          }
          // a shelf that can still move this way takes the whole gesture; one at its end lets it turn
          if (s.axis === 'x' && e.scroller && (s.sx > 0 ? e.scroller.forward : e.scroller.back)) s.axis = 'ignore'
          if (s.axis !== 'x') return REST
          // what was counted while deciding goes through the swipe's own checks
          const { sx, sy } = s
          s.sx = 0
          s.sy = 0
          return swipe(e.t, sx, sy)
        }
      }

      if (s.axis === 'pinch') {
        if (s.spent) return { lean: 0, prevent: true }
        s.pinch += e.dy // pinching in sends positive dy (zooming out)
        // pinching out is the browser's zoom: only a pinch in is ours
        if (s.pinch <= 0) return REST
        if (s.pinch >= PINCH_PX) {
          s.spent = true
          return { lean: 0, close: true, prevent: true }
        }
        return { lean: 0, prevent: true }
      }
      if (s.axis === 'x') return swipe(e.t, mouse ? 0 : e.dx, mouse ? 0 : e.dy)
      if (s.axis === 'up') return pull(e.dx, e.dy, e.t)
      return REST
    },
  }
}

/** In the room, a scroll down from rest that travels this far opens About (the first section). */
export const OPEN_PX = 60

export interface RoomWheel {
  t: number
  dx: number
  dy: number
  mode: number
  ctrl: boolean
  shift?: boolean
  /** Something under the pointer (or the page itself) can still scroll down: then it's a scroll. */
  canScrollDown: boolean
}

/**
 * The room's one gesture: a scroll down (two fingers, or a mouse wheel) opens About. It counts once
 * per gesture, when it goes clearly down where nothing else could scroll; a scroll down made while an
 * earlier scroll is still gliding counts too. Held gestures (the room busy) never do.
 */
export function createRoomRecognizer() {
  let last = -Infinity
  let axis: 'none' | 'down' | 'ignore' = 'ignore'
  let sx = 0
  let sy = 0
  let spent = false
  let prevDy = 0
  let rises = 0
  const start = () => {
    axis = 'none'
    sx = 0
    sy = 0
    spent = false
  }
  return {
    /** The room isn't ready (entering, a panel just closed): this gesture never counts. */
    hold(t: number) {
      last = t
      axis = 'ignore'
      rises = 0
    },
    feed(e: RoomWheel): boolean {
      const unit = e.mode === 1 ? 16 : e.mode === 2 ? 400 : 1
      const dy = e.dy * unit
      const dx = e.dx * unit
      if (e.t - last > GAP_MS) start()
      last = e.t
      // fingers on the pad again while an earlier scroll is still gliding (growing downward steps,
      // which a glide never makes): a fresh scroll down
      rises = dy >= PUSH_MIN && dy >= AXIS_RATIO * Math.abs(dx) && dy > prevDy ? rises + 1 : 0
      prevDy = dy
      if ((axis === 'ignore' || spent) && rises >= PUSH_RISES && !e.ctrl && !e.shift) start()
      // a pinch, a sideways mouse scroll or a scroll that has somewhere to go isn't ours
      if (e.ctrl || e.shift || e.canScrollDown) axis = 'ignore'
      if (axis === 'ignore' || spent) return false
      sx += dx
      sy += dy
      if (axis === 'none') {
        if (Math.hypot(sx, sy) < AXIS_PX) return false
        axis = sy > 0 && sy >= AXIS_RATIO * Math.abs(sx) ? 'down' : 'ignore'
        if (axis === 'ignore') return false
      }
      // drifting sideways: not a scroll down after all
      if (Math.abs(sx) * AXIS_RATIO > Math.abs(sy)) {
        axis = 'ignore'
        return false
      }
      if (sy >= OPEN_PX) {
        spent = true
        return true
      }
      return false
    },
  }
}
