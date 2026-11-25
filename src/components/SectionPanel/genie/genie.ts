/**
 * The genie: on wide screens with a mouse, the smoked glass slab pours out of the object that was
 * clicked into its place beside the room, and back into the object of the page shown when closed.
 *
 * Owned by SectionPanel (useGenie.ts): it calls open() just after showModal(), close() when the
 * section goes (and closes the dialog only once the promise settles), and reopen() when the
 * section comes back mid-close. Everything else (preparing at idle, re-preparing on a resize or a
 * new light, freeing the GPU between moves) happens here.
 *
 * The beats (ms from the click, see geometry.ts):
 *   0-100    the object's halo warms; nothing moves
 *   100-650  the slab pours out along one calm S-curve, far edge leading, the neck thin, faint
 *            and lamp-warm; its shadow on the room trails it by 50ms; the lamp-side glint lights
 *            as the slab's lamp edge arrives under the bulb
 *   ~520     the contents rise, 35ms apart, all under 200ms: readable by about 800
 *   650-950  the lamp's light sweeps once across the slab; then the real sheet takes over
 * Closing (about 72% of opening): the contents fade (100ms), the slab pours back on an
 * accelerating curve (370ms) while the dim lifts with it, the object's halo glows once as it
 * arrives, and only then does the dialog close.
 *
 * The slab is drawn on the panel's own canvas, the dialog's first child: above the dim, under
 * the sheet, so the real contents rise over it. While the canvas carries the slab, the sheet's
 * own paint is hidden (never moved); the live room is never transformed or filtered.
 * Not used (today's motion runs): phones and touch, reduced motion, a deep link on load (nothing
 * is prepared yet), no WebGL2, or a panel that no longer matches what was prepared.
 */
import { HOTSPOTS } from '../../../scene/hotspots'
import type { SectionId } from '../../../content/types'
import { ROOM_ANCHORED_FROM } from '../panelGeometry'
import {
  CLOSE,
  OPEN,
  cubicBezier,
  glintAt,
  openTimeline,
  planMove,
  reverseMs,
  sameGlass,
  shadowCloseAt,
  shadowOpenAt,
  silhouetteOf,
  sweepAt,
  type OpenTimeline,
  type Plan,
  type Shape,
  type Silhouette,
} from './geometry'
import { checkSurface, glassSignature, rasterise, type Surface } from './raster'
import { Renderer } from './renderer'

/** Where the genie runs at all. */
export const GENIE_MEDIA = `(min-width: ${ROOM_ANCHORED_FROM}px) and (hover: hover) and (pointer: fine)`

/**
 * The browsers it has been verified in: Chromium's (Chrome, Edge, Arc, Brave, Opera). Safari and
 * Firefox keep today's slide until the pour is checked there (the slab is drawn through an SVG
 * foreignObject, which WebKit has a history of drawing without its images). To check one, set
 * localStorage['panel-genie'] = 'on' (or add ?genie to the address); 'off' turns it off anywhere.
 */
export function genieEngineOk(): boolean {
  let flag: string | null = null
  try {
    flag = new URLSearchParams(location.search).has('genie') ? 'on' : localStorage.getItem('panel-genie')
  } catch {
    flag = null
  }
  if (flag === 'on') return true
  if (flag === 'off') return false
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands
  if (brands?.some((b) => b.brand === 'Chromium')) return true
  // Chromium browsers that don't list the brand (Vivaldi, some Brave and Opera builds) still say
  // "Chrome/" in their user agent; Safari and Firefox never do (Chrome on iOS is WebKit: "CriOS").
  return /\bChrome\/\d/.test(navigator.userAgent)
}

const now = () => performance.now()
const stageBox = () => (document.querySelector('.cover .stage') ?? document.querySelector('.stage'))?.getBoundingClientRect() ?? null
const sameBox = (a: DOMRect | null, b: DOMRect | null) =>
  !!a && !!b && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5
const sine = cubicBezier([0.45, 0, 0.55, 1])
const linear = (x: number) => x

interface Move {
  /** 'out': toward the dock; 'back': into the object. */
  dir: 'out' | 'back'
  section: SectionId
  plan: Plan
  shape: Shape
  /** When the slab starts moving, and how T runs from T0 to T1. */
  start: number
  dur: number
  T0: number
  T1: number
  curve: (x: number) => number
  T: number
  /** Opening only: when its beats count from (the click, moved on if the first frame came late). */
  clock?: { base: number }
  click0?: number
  tl?: OpenTimeline
  /** A close's content fade: the canvas takes the slab over once it's done. */
  fadeUntil?: number
  shadow: (t: number) => number
  sweep: (t: number) => number | null
  /** When the move is over: the hand-off to the real sheet, or the slab back in its object. */
  doneAt: () => number
  resolve?: (closed: boolean) => void
  deltas: number[]
  cpu: number[]
  last: number | null
}

export interface GenieOptions {
  dialog: HTMLDialogElement
  canvas: HTMLCanvasElement
  /** Dresses a dialog as SectionPanel does at open (place, lamp, reflection). */
  dress: (dialog: HTMLDialogElement) => void
}

/** What happened, for the film and the checks (kept short). */
export interface GenieEvent {
  t: number
  name: string
  [k: string]: unknown
}

export class Genie {
  private renderer: Renderer | null = null
  private failed: string | null = null
  private surface: Surface | null = null
  private preparing: Promise<boolean> | null = null
  private stale = true
  /** Counts what may change the glass, so a prepare that ran across a change knows it's stale. */
  private generation = 0
  private dpr = 1
  private necks = new Map<SectionId, Silhouette>()
  private viewW = 0
  private move: Move | null = null
  private raf = 0
  private timers = new Set<number>()
  private disposers: (() => void)[] = []
  /** Set while a panel the genie opened is out. */
  private owned = false
  readonly events: GenieEvent[] = []
  readonly frames: { name: string; deltas: number[]; cpu: number[] }[] = []

  constructor(private o: GenieOptions) {}

  private log(name: string, extra: Record<string, unknown> = {}) {
    this.events.push({ t: Math.round(now()), name, ...extra })
    if (this.events.length > 200) this.events.shift()
  }

  private later(fn: () => void, ms: number) {
    const id = window.setTimeout(() => {
      this.timers.delete(id)
      fn()
    }, ms)
    this.timers.add(id)
  }

  // ── where it runs ──

  static eligible(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia(GENIE_MEDIA).matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      genieEngineOk()
    )
  }

  private markStale() {
    this.stale = true
    this.generation++
  }

  private gl(): Renderer | null {
    if (this.renderer && !this.renderer.lost) return this.renderer
    if (this.failed) return null
    try {
      this.renderer = new Renderer(this.o.canvas)
      const lost = (e: Event) => {
        e.preventDefault()
        this.log('context lost')
        if (this.renderer) this.renderer.lost = true
        this.abort('context lost')
      }
      const restored = () => {
        this.log('context restored')
        this.renderer = null
        this.schedulePrepare()
      }
      this.o.canvas.addEventListener('webglcontextlost', lost)
      this.o.canvas.addEventListener('webglcontextrestored', restored)
      this.disposers.push(() => {
        this.o.canvas.removeEventListener('webglcontextlost', lost)
        this.o.canvas.removeEventListener('webglcontextrestored', restored)
      })
      return this.renderer
    } catch (e) {
      this.failed = String((e as Error).message || e)
      this.log('gl failed', { e: this.failed })
      return null
    }
  }

  // ── preparing, at idle ──

  /** Starts watching: prepares once the room is at rest, and again whenever the glass may change. */
  start(whenSettled: Promise<void>) {
    let resizeTimer = 0
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      this.markStale()
      // a move can't follow a reflowed panel: it ends where it was going, at once
      if (this.move) this.jump('resized')
      resizeTimer = window.setTimeout(() => this.schedulePrepare(), 300)
    }
    window.addEventListener('resize', onResize)
    this.disposers.push(() => {
      window.removeEventListener('resize', onResize)
      window.clearTimeout(resizeTimer)
    })
    // A new light or weather changes the glass (its reflection, its tuning): prepare it again.
    const scene = document.querySelector('.scene')
    if (scene) {
      const watch = new MutationObserver(() => {
        this.markStale()
        this.schedulePrepare(600)
      })
      watch.observe(scene, { attributes: true, attributeFilter: ['data-time', 'data-weather'] })
      this.disposers.push(() => watch.disconnect())
    }
    let live = true
    this.disposers.push(() => (live = false))
    whenSettled.then(() => live && this.schedulePrepare(1200))
  }

  private idleHandle = 0
  private delayTimer = 0
  /** Prepares at the next idle moment (after `delay`), unless a panel is out: then after it closes. */
  schedulePrepare(delay = 0) {
    if (!Genie.eligible()) return
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    if (this.idleHandle) cancel(this.idleHandle)
    this.idleHandle = 0
    // one pending prepare at a time: a burst of changes (HMR, moods) waits for the last
    window.clearTimeout(this.delayTimer)
    this.delayTimer = 0
    const go = () => {
      const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200))
      this.idleHandle = idle(() => {
        this.idleHandle = 0
        if (this.o.dialog.open || this.move) return // after the close
        void this.prepare()
      }, { timeout: 3000 })
    }
    if (delay)
      this.delayTimer = window.setTimeout(() => {
        this.delayTimer = 0
        go()
      }, delay)
    else go()
  }

  /** Measures and paints the slab, samples the objects, and warms the GPU. Resolves true when ready. */
  prepare(): Promise<boolean> {
    if (this.preparing) return this.preparing
    const job = (async () => {
      if (!Genie.eligible() || this.o.dialog.open) return false
      const r = this.gl()
      if (!r) return false
      const generation = this.generation
      try {
        this.viewW = document.documentElement.clientWidth
        this.dpr = window.devicePixelRatio || 1
        const room = stageBox()
        const s = await rasterise({ dialog: this.o.dialog, dress: this.o.dress })
        if (this.o.dialog.open) return false // opened meanwhile: prepared again after the close
        // a picture that came out wrong (an engine that drew it without its images) never pours
        const bad = checkSurface(s)
        if (bad) {
          this.surface = null
          this.log('prepare refused', { why: bad })
          return false
        }
        if (!sameBox(room, stageBox())) {
          // the room was still moving (its entrance, a resize): try again once it rests
          this.log('room moved while preparing')
          this.schedulePrepare(500)
          return false
        }
        this.sampleObjects()
        this.surface = s
        // the light or the window changed while it was being painted: paint it again
        this.stale = generation !== this.generation
        if (this.stale) this.schedulePrepare(300)
        this.warm(s)
        this.log('prepared', { ms: s.ms, px: [s.slab.width, s.slab.height], glint: s.glint ? [s.glint.width, s.glint.height] : null })
        return true
      } catch (e) {
        this.log('prepare failed', { e: String((e as Error).message || e) })
        return false
      }
    })()
    this.preparing = job
    void job.finally(() => (this.preparing = null))
    return job
  }

  /** Where each section's object is drawn, sampled where its link really answers (not its box). */
  private sampleObjects() {
    if (this.o.dialog.open) return
    const N = 18
    this.necks.clear()
    for (const a of document.querySelectorAll<HTMLAnchorElement>('.stage a[href^="#"]')) {
      const id = (a.getAttribute('href') ?? '').slice(1) as SectionId
      if (this.necks.has(id)) continue
      const r = a.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const hits: { x: number; y: number }[] = []
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) {
          const x = r.left + (r.width * (i + 0.5)) / N
          const y = r.top + (r.height * (j + 0.5)) / N
          if (document.elementFromPoint(x, y)?.closest('a') === a) hits.push({ x, y })
        }
      this.necks.set(id, silhouetteOf(hits, r, N))
    }
  }

  /** One draw off-screen, so the first real frame doesn't pay for shader and texture setup. */
  private warm(s: Surface) {
    const r = this.renderer
    const id = this.necks.keys().next().value
    if (!r || !id) return
    const t = now()
    r.upload(s)
    r.size(64, 64, 1)
    r.draw(planMove(this.necks.get(id)!, s.shell), s, { T: 0.5, shape: 'open', glint: 1, shadow: 1, sweep: 0.5 }, 64, 64)
    r.finish()
    r.free()
    this.log('warmed', { ms: Math.round(now() - t) })
  }

  // ── opening ──

  /** Why an open can't pour (null: it can). */
  private refuse(section: SectionId): string | null {
    if (!Genie.eligible()) return 'media'
    if (!this.renderer || this.renderer.lost) return 'no gl'
    const s = this.surface
    if (!s || this.stale) return 'not prepared'
    if (!this.necks.has(section)) return 'no object'
    const r = this.o.dialog.getBoundingClientRect()
    const d = s.dock
    if (Math.abs(r.left - d.x) > 1 || Math.abs(r.top - d.y) > 1 || Math.abs(r.width - d.w) > 1 || Math.abs(r.height - d.h) > 1) return 'panel moved'
    if (Math.abs(document.documentElement.clientWidth - this.viewW) > 1) return 'window changed'
    if (Math.abs((window.devicePixelRatio || 1) - this.dpr) > 0.01) return 'screen changed'
    const sheet = this.o.dialog.querySelector('.panel__sheet')
    if (!sheet || !sameGlass(glassSignature(sheet), s.signature)) return 'glass changed'
    return null
  }

  /** Called just after showModal() and the dialog's dressing. True when the genie pours it. */
  open(section: SectionId): boolean {
    if (this.move) this.abort('open over a move')
    const why = this.refuse(section)
    if (why) {
      this.log('open: not poured', { section, why })
      if (why !== 'media') {
        this.markStale()
        this.schedulePrepare(400) // ready for next time
      }
      return false
    }
    const s = this.surface!
    const r = this.renderer!
    const plan = planMove(this.necks.get(section)!, s.shell)
    const tl = openTimeline(plan)
    const click = now()
    r.upload(s)
    this.size()
    const uploaded = now()
    this.owned = true
    const d = this.o.dialog
    d.style.setProperty('--genie-content-at', `${Math.round(tl.contentAt + Math.max(0, uploaded + 16 - tl.anticipate - click))}ms`)
    this.set('genie', true)
    this.set('genie-gl', true)
    this.set('genie-rise', true)
    this.halo(section, 'warm')
    // (on a slow machine the upload can outlast the anticipation: the pour then starts a frame after it)
    const clock = { base: Math.max(click, uploaded + 16 - tl.anticipate) }
    this.move = {
      dir: 'out',
      section,
      plan,
      shape: 'open',
      start: clock.base + tl.anticipate,
      dur: tl.pourMs,
      T0: 0,
      T1: 1,
      curve: linear,
      T: 0,
      clock,
      click0: click,
      tl,
      shadow: (t) => shadowOpenAt(t - clock.base, tl),
      sweep: (t) => sweepAt(t - clock.base, tl),
      doneAt: () => clock.base + tl.handoffAt,
      deltas: [],
      cpu: [],
      last: null,
    }
    this.log('open', { section, axis: plan.axis, pourMs: Math.round(tl.pourMs), contentAt: tl.contentAt, uploadMs: Math.round(uploaded - click) })
    this.frame()
    this.run()
    return true
  }

  // ── closing ──

  /**
   * Called as the section goes. Resolves (true) once the slab is back in its object: close the
   * dialog then. Null when the genie isn't carrying this panel: today's close runs.
   */
  close(section: SectionId | null): Promise<boolean> | null {
    if (!this.owned) return null
    const m = this.move
    const s = this.surface
    const r = this.renderer
    const target = section ?? m?.section ?? null
    if (!s || !r || r.lost || !target || !this.necks.has(target) || !this.matchesDock()) {
      this.log('close: not poured', { section: target })
      this.release()
      return null
    }
    return new Promise<boolean>((resolve) => {
      this.set('genie-leave', true)
      if (m && m.dir === 'out' && m.T < 1) {
        // Still pouring out: turn round from where it is.
        if (now() < m.start) {
          this.log('close during anticipation')
          this.finishBack(m.section)
          resolve(true)
          return
        }
        this.turn(m, 'back', resolve)
        return
      }
      if (m) this.settle(m, false)
      // The contents fade on the real sheet (or over the canvas, if it still carries the slab);
      // then the canvas takes the slab and pours it back.
      r.upload(s)
      const plan = planMove(this.necks.get(target)!, s.shell)
      const t = now()
      const fadeUntil = t + CLOSE.fadeMs
      this.setDim(CLOSE.pourMs, CLOSE.fadeMs)
      const clock = { base: fadeUntil }
      this.move = {
        dir: 'back',
        section: target,
        plan,
        shape: 'close',
        start: clock.base,
        dur: CLOSE.pourMs,
        T0: 1,
        T1: 0,
        curve: linear,
        T: 1,
        fadeUntil,
        clock,
        shadow: (now) => shadowCloseAt(now - clock.base, CLOSE.pourMs),
        sweep: () => null,
        doneAt: () => clock.base + CLOSE.pourMs,
        resolve,
        deltas: [],
        cpu: [],
        last: null,
      }
      this.log('close', { section: target, axis: plan.axis })
      this.run()
    })
  }

  /** The section came back while closing: pour back out from where the slab is. */
  reopen() {
    const m = this.move
    if (!m || m.dir !== 'back') return
    // the contents wait, hidden, until the slab is back in its place
    this.set('genie-leave', false)
    this.set('genie-hold', true)
    this.clearDim()
    m.resolve?.(false)
    m.resolve = undefined
    if (m.fadeUntil !== undefined && now() < m.fadeUntil) {
      // Only the contents had started to fade: bring them back.
      this.log('reopen during fade')
      this.settle(m, false)
      this.move = null
      this.handoff()
      return
    }
    this.log('reopen', { T: +m.T.toFixed(3) })
    this.turn(m, 'out')
  }

  /** Turns a move round mid-way, keeping its shape so the slab doesn't jump. */
  private turn(m: Move, dir: 'out' | 'back', resolve?: (closed: boolean) => void) {
    const t = now()
    const to = dir === 'out' ? 1 : 0
    const dur = reverseMs(m.T, to, dir === 'out' ? OPEN.landAt - OPEN.anticipate : CLOSE.pourMs)
    const shadow0 = m.shadow(t)
    const T0 = m.T
    if (dir === 'back') this.setDim(dur, 0)
    this.set('genie-gl', true)
    this.move = {
      ...m,
      dir,
      start: t,
      dur,
      T0,
      T1: to,
      curve: sine,
      clock: undefined,
      tl: undefined,
      fadeUntil: undefined,
      shadow: dir === 'out' ? (n) => shadow0 + (1 - shadow0) * sine((n - t) / dur) : (n) => shadow0 * (1 - sine(Math.min(1, (n - t) / (dur * 0.8)))),
      sweep: () => null,
      doneAt: () => t + dur,
      resolve,
      deltas: [],
      cpu: [],
      last: null,
    }
    this.log('turn', { dir, from: +T0.toFixed(3), dur })
    this.run()
  }

  // ── the frame loop ──

  private run() {
    if (!this.raf) this.raf = requestAnimationFrame(() => this.tick())
  }

  private progress(m: Move, t: number) {
    const k = m.dur > 0 ? Math.min(1, Math.max(0, (t - m.start) / m.dur)) : 1
    return m.T0 + (m.T1 - m.T0) * m.curve(k)
  }

  private tick() {
    this.raf = 0
    const m = this.move
    if (!m) return
    const t = now()
    if (m.last !== null) m.deltas.push(+(t - m.last).toFixed(2))
    else if (m.clock && m.tl) {
      // The click's own frame (the page mounting) can come late: the pour then starts from its
      // beginning a frame later instead of skipping its first part, and the contents wait as much.
      const late = t + 16 - (m.clock.base + m.tl.anticipate)
      if (late > 0) {
        m.clock.base += late
        m.start += late
        this.o.dialog.style.setProperty('--genie-content-at', `${Math.round(m.tl.contentAt + m.clock.base - (m.click0 ?? m.clock.base))}ms`)
      }
    }
    m.last = t
    if (m.fadeUntil !== undefined) {
      if (t < m.fadeUntil) return this.run()
      m.fadeUntil = undefined
      // a late frame: the pour starts now, from its beginning
      if (m.clock && t > m.start) {
        m.clock.base += t - m.start
        m.start = t
      }
      // the canvas takes the slab over in this frame, exactly where the sheet painted it
      this.size()
      this.set('genie-gl', true)
    }
    m.T = this.progress(m, t)
    const c0 = now()
    this.frame(t)
    m.cpu.push(+(now() - c0).toFixed(2))
    if (t >= m.doneAt()) return this.done(m)
    this.run()
  }

  private frame(t = now()) {
    const m = this.move
    const s = this.surface
    const r = this.renderer
    if (!m || !s || !r) return
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    r.draw(
      m.plan,
      s,
      { T: m.T, shape: m.shape, glint: glintAt(m.plan, m.T, m.shape, s.lamp), shadow: Math.max(0, Math.min(1, m.shadow(t))), sweep: m.sweep(t) },
      vw,
      vh,
    )
  }

  private size() {
    const r = this.renderer
    if (r) r.size(document.documentElement.clientWidth, window.innerHeight, this.surface?.scale ?? 1)
  }

  private settle(m: Move, keep: boolean) {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.frames.push({ name: `${m.dir}:${m.section}`, deltas: m.deltas, cpu: m.cpu })
    if (this.frames.length > 20) this.frames.shift()
    if (!keep) this.move = null
  }

  private done(m: Move) {
    this.settle(m, false)
    if (m.dir === 'out') {
      this.log('landed', { section: m.section })
      this.handoff()
      return
    }
    this.log('home', { section: m.section })
    this.finishBack(m.section)
    m.resolve?.(true)
  }

  /** Same frame: the real sheet comes back and the canvas goes, with the GPU freed. */
  private handoff() {
    // (data-genie-rise stays on until the panel closes: taking it off would hand the contents
    // back to the page's own entrance, which would start again from nothing, a blink)
    this.set('genie-gl', false)
    this.set('genie-leave', false)
    this.set('genie-hold', false)
    this.renderer?.clear()
    this.renderer?.free()
    this.halo(null)
  }

  /** The slab is back in its object: the canvas goes, the object glows once, and it's all undone. */
  private finishBack(section: SectionId) {
    this.renderer?.clear()
    this.renderer?.free()
    this.halo(section, 'glow')
    this.later(() => this.haloEl?.getAttribute('data-genie-halo') === 'glow' && this.halo(null), 760)
    this.release(true)
  }

  /** Lets go of the panel: today's styles apply again. */
  private release(keepHalo = false) {
    if (this.move) this.settle(this.move, false)
    this.owned = false
    for (const name of ['genie', 'genie-gl', 'genie-rise', 'genie-leave', 'genie-hold']) this.set(name, false)
    this.o.dialog.style.removeProperty('--genie-content-at')
    this.clearDim()
    if (!keepHalo) this.halo(null)
    this.renderer?.free()
    if (this.stale) this.schedulePrepare(300)
  }

  /** The window changed under a move: it ends where it was going, at once (no pour to a stale place). */
  private jump(reason: string) {
    const m = this.move
    if (!m) return
    this.log('jump', { reason, dir: m.dir })
    this.done(m)
  }

  /** The dialog was closed under us (the browser's own Escape, or the component going). */
  abort(reason: string) {
    if (!this.owned && !this.move) return
    this.log('abort', { reason })
    const m = this.move
    this.release()
    m?.resolve?.(false)
  }

  /** The dialog has closed (by any route): anything left is let go, and what was put off is prepared. */
  closed() {
    this.abort('dialog closed')
    if (!this.surface || this.stale) this.schedulePrepare(300)
  }

  private matchesDock() {
    const s = this.surface
    if (!s) return false
    const r = this.o.dialog.getBoundingClientRect()
    return Math.abs(r.width - s.dock.w) <= 1 && Math.abs(r.height - s.dock.h) <= 1 && Math.abs(r.left - s.dock.x) <= 1 && Math.abs(r.top - s.dock.y) <= 1
  }

  // ── the dialog's and the room's state ──

  private set(name: string, on: boolean) {
    this.o.dialog.toggleAttribute(`data-${name}`, on)
  }

  /** The room's dim lifts in step with the pour back. */
  private setDim(ms: number, delay: number) {
    this.o.dialog.style.setProperty('--genie-dim-ms', `${Math.round(ms)}ms`)
    this.o.dialog.style.setProperty('--genie-dim-delay', `${Math.round(delay)}ms`)
  }

  private clearDim() {
    this.o.dialog.style.removeProperty('--genie-dim-ms')
    this.o.dialog.style.removeProperty('--genie-dim-delay')
  }

  private haloEl: Element | null = null
  /** The object's own amber halo: warmer as it's clicked, one glow as the slab comes home. */
  private halo(section: SectionId | null, how?: 'warm' | 'glow') {
    this.haloEl?.removeAttribute('data-genie-halo')
    this.haloEl = null
    if (!section || !how) return
    const overlay = HOTSPOTS.find((h) => h.section === section && h.overlay)?.overlay
    const el = overlay ? document.querySelector(`.stage .scene-object--${overlay}`) : null
    if (!el) return
    el.setAttribute('data-genie-halo', how)
    this.haloEl = el
  }

  /** Is a panel the genie opened out, and is a move running? */
  get state() {
    const m = this.move
    return {
      ready: !!this.surface && !this.stale,
      failed: this.failed,
      owned: this.owned,
      move: m && { dir: m.dir, section: m.section, axis: m.plan.axis, T: +m.T.toFixed(3) },
      necks: [...this.necks.keys()],
      surface: this.surface && { key: this.surface.key, px: [this.surface.slab.width, this.surface.slab.height], ms: this.surface.ms },
    }
  }

  /** Timing of an opening from a section's object (for the checks). */
  timing(section: SectionId) {
    const s = this.surface
    const n = this.necks.get(section)
    if (!s || !n) return null
    const plan = planMove(n, s.shell)
    return { axis: ['sideways', 'rises', 'falls'][plan.axis], ...openTimeline(plan) }
  }

  destroy() {
    this.abort('unmounted')
    for (const id of this.timers) window.clearTimeout(id)
    this.timers.clear()
    window.clearTimeout(this.delayTimer)
    if (this.idleHandle) (window.cancelIdleCallback ?? window.clearTimeout)(this.idleHandle)
    for (const d of this.disposers.splice(0)) d()
    this.renderer?.destroy()
    this.renderer = null
  }
}
