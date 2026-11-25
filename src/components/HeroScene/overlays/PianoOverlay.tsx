import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { content } from '../../../content/content'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { listenTo, loopOn, onLoopChange, quietTheRoom, restoreTheRoom, setLandscape, setLoop, setVolume, settings, toggleLoop } from '../../../audio/pianoEngine'
import { overlay, pctX, pctY } from '../../../scene/layout'
import { KEYBOARD_NOTES, PIANO_ATLAS, PIANO_CLOSE_SRC, PIANO_KEYS, PIANO_KNOBS, PIANO_SCREEN, PIANO_SHELF, PIANO_SHELF_SHEAR, PIANO_SIZE, piano, type PianoKnob } from '../../../scene/piano'
import { TITLE_H, TITLE_W, paintName, type Put } from '../../../scene/pianoTitle'
import { LANDSCAPES, LOOPS, LOOP_SOURCE } from '../../../scene/pianoMusic'
import { textPixels, textWidth } from '../../../scene/pixelFont'
import { createPianoScreen, type PianoScreen } from '../../../scene/pianoScreen'
import { SceneObject } from './SceneObject'
import './PianoOverlay.css'

/**
 * The Pixel Jam Piano, a glimmer on the top shelf:
 *  - PianoArt: small, on the shelf, with the room's objects (so the room's light falls on it).
 *    Until it is found, now and then a few moonlight notes rise from it (src/scene/glimmers.ts).
 *    Its outline to click lives in HotspotLayer, like the cat's and the lamp's.
 *  - PianoCloseUp: a click brings it close. It grows from the shelf into a large, playable view
 *    over the room (a modal dialog: the room stays where it is behind it, as when a page is
 *    open). Every key can be played with a pointer (sliding across the keys, several fingers at
 *    once) and with the computer keyboard; each shows its pressed sprite, cut from one atlas,
 *    by opacity alone, and sounds a soft note; the first note starts a backing loop to jam over.
 *    Its two brass knobs work: the top one picks the screen's landscape, the bottom one the loop.
 *    Esc, a click outside or Close sends it back.
 * Which keys are down lives in scene/piano.ts.
 */

const PIANO = overlay('piano')
const [W, H] = PIANO_SIZE
const [AW, AH] = PIANO_ATLAS.size
const pct = (part: number, whole: number) => `${(part / whole) * 100}%`
const boxStyle = ([x, y, w, h]: readonly [number, number, number, number]): CSSProperties => ({ left: pct(x, W), top: pct(y, H), width: pct(w, W), height: pct(h, H) })

const SPRITES = PIANO_KEYS.map((key) => {
  const [, , w, h] = key.box
  const [ax, ay] = key.atlas
  return {
    id: key.id,
    style: {
      ...boxStyle(key.box),
      backgroundImage: `url(${PIANO_ATLAS.src})`,
      backgroundSize: `${pct(AW, w)} ${pct(AH, h)}`,
      backgroundPosition: `${AW > w ? pct(ax, AW - w) : '0%'} ${AH > h ? pct(ay, AH - h) : '0%'}`,
    } satisfies CSSProperties,
  }
})

/**
 * The light of a played key: one cool colour (--keylight, PianoOverlay.css), as if the key were lit
 * from inside. Each key's light is three small layers around it (the key's outline is its hit path, in
 * the picture's pixels), so each is drawn once and the browser only fades and composites them:
 *  - its halo: light spilling out of the gaps around the key, onto the wood rail behind it, its
 *    neighbours' edges and the lip of the case below (screened, and kept off the key itself);
 *  - its face: the key taking on the light, brightest towards its front (overlaid, so the key's own
 *    shading and shape stay);
 *  - its strike: a hotter core that flashes as the key goes down and settles while it is held.
 */
const GLOW_PAD = 44 // (room around the key for the halo, in the picture's pixels)
const GLOWS = PIANO_KEYS.map((key) => {
  const [x, y, w, h] = key.box
  const box: [number, number, number, number] = [x - GLOW_PAD, y - GLOW_PAD, w + GLOW_PAD * 2, h + GLOW_PAD * 2]
  const id = `piano-keylight-${key.id.replace('#', 's')}`
  const black = key.kind === 'black'
  return { key, box, id, black, style: boxStyle(box) }
})
const tone = (name: 'glow' | 'core' | 'hot', alpha = 1): CSSProperties => ({ stopColor: `var(--keylight-${name})`, stopOpacity: alpha, fill: `var(--keylight-${name})` })

function KeyGlow({ glow, down }: { glow: (typeof GLOWS)[number]; down: boolean }) {
  const { key, box, id, black } = glow
  const [x, y, w, h] = key.box
  const [bx, by, bw, bh] = box
  const view = box.join(' ')
  const state = { 'data-down': down ? '' : undefined, 'data-black': black ? '' : undefined }
  return (
    <>
      <span className="piano-keylight piano-keylight--halo" {...state} style={glow.style}>
        <svg viewBox={view} preserveAspectRatio="none">
          <defs>
            <filter id={`${id}-bloom`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="13" />
            </filter>
            <filter id={`${id}-edge`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
            <mask id={`${id}-out`} maskUnits="userSpaceOnUse" x={bx} y={by} width={bw} height={bh}>
              <rect x={bx} y={by} width={bw} height={bh} fill="#fff" />
              <path d={key.hit} fill="#000" filter={`url(#${id}-edge)`} />
            </mask>
          </defs>
          <g mask={`url(#${id}-out)`} filter={`url(#${id}-bloom)`}>
            <path d={key.hit} style={tone('glow')} />
            {!black && <ellipse cx={x + w * 0.55} cy={y + h + 6} rx={w * 0.4} ry={10} style={tone('glow')} />}
          </g>
        </svg>
      </span>
      <span className="piano-keylight piano-keylight--face" {...state} style={glow.style}>
        <svg viewBox={view} preserveAspectRatio="none">
          <defs>
            <radialGradient id={`${id}-face`} cx="0.5" cy={black ? 0.7 : 0.76} r="0.8" fx="0.5" fy={black ? 0.78 : 0.86}>
              <stop offset="0" style={tone('core')} />
              <stop offset="0.55" style={tone('glow', 0.7)} />
              <stop offset="1" style={tone('glow', 0.15)} />
            </radialGradient>
          </defs>
          <path d={key.hit} fill={`url(#${id}-face)`} />
        </svg>
      </span>
      <span className="piano-keylight piano-keylight--strike" {...state} style={glow.style}>
        <svg viewBox={view} preserveAspectRatio="none">
          <defs>
            <filter id={`${id}-hot`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="10" />
            </filter>
            <clipPath id={`${id}-in`}>
              <path d={key.hit} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${id}-in)`}>
            <ellipse cx={x + w * 0.52} cy={y + h * (black ? 0.64 : 0.74)} rx={w * 0.36} ry={h * 0.2} style={tone('hot')} filter={`url(#${id}-hot)`} />
          </g>
        </svg>
      </span>
    </>
  )
}

/**
 * Its hover splash, like the cat's when it's petted: two or three cream notes float up and away from
 * its screen, each a little different every time (drift, tilt, size, a staggered start). One per
 * hover, and one each time its paced hint plays the hover on its own (HeroScene, `highlighted`).
 */
const between = (a: number, b: number) => a + Math.random() * (b - a)
function makeSplash() {
  return Array.from({ length: Math.random() < 0.5 ? 2 : 3 }, (_, i) => ({
    dx: between(-0.4, 0.8) + i * between(0.6, 1.1),
    dy: between(-2.4, -1.7) - i * 0.5,
    rotate: between(-14, 14),
    delay: i * between(0.18, 0.32),
    size: between(0.8, 1.05) + (i === 1 ? 0.12 : 0),
  }))
}
/** Where the notes rise from: the top of its screen, towards its right (the same share of the shelf's picture). */
const [SX, SY, SW] = PIANO_SCREEN.box
const [HX, HY, HW] = PIANO_SHELF.screen // (the shelf's picture is its own three-quarter render)
const HINT_FROM: CSSProperties = { left: pct(HX + HW * 0.8, PIANO_SHELF.size[0]), top: pct(HY, PIANO_SHELF.size[1]) }
/** The close-up's shape: the picture's own. */
const STAGE = { aspectRatio: `${W} / ${H}`, '--ratio': W / H } as CSSProperties
/** The screen: its box, clipped to the glass's own rounded outline. */
const [, , , SH] = PIANO_SCREEN.box
const SCREEN_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${SX} ${SY} ${SW} ${SH}' preserveAspectRatio='none'><path d='${PIANO_SCREEN.path}' fill='#fff'/></svg>`,
)}")`
const SCREEN_STYLE: CSSProperties = { ...boxStyle(PIANO_SCREEN.box), maskImage: SCREEN_MASK, WebkitMaskImage: SCREEN_MASK }

/**
 * A brass knob that works, as a volume control: its needle turns over the lit brass (the printed
 * one is painted out of the picture) across the dots printed around it, from quiet to loud, settling
 * with a slight overshoot. Drag it up or down, scroll on it, or tab to it and use the arrow keys
 * (it's a slider). Its name is printed upright beside it, in bold.
 */
const QUIET_AT = 176 // degrees, anticlockwise from 3 o'clock: the first dot of the knob's scale
const LOUD_AT = 81 // the last dot
const STEPS = 10
const DRAG_PX = 16 // how far a drag goes for one step (on screen)
interface KnobProps {
  knob: PianoKnob
  label: string
  name: string
  value: number
  invite: boolean
  onChange: (v: number) => void
}
function Knob({ knob, label, name, value, invite, onChange }: KnobProps) {
  const angle = QUIET_AT + (LOUD_AT - QUIET_AT) * value
  const drag = useRef<{ y: number; from: number } | null>(null)
  const at = Math.round(value * STEPS)
  const set = (step: number) => onChange(Math.max(0, Math.min(STEPS, step)) / STEPS)
  const [x1, y1, x2, y2] = [knob.cx + knob.inner * 0.4, knob.cy, knob.cx + knob.outer, knob.cy]
  return (
    <g
      className="piano-close__knob"
      data-invite={invite ? '' : undefined}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={`${Math.round(value * 100)}%`}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
        ;(event.currentTarget as SVGGElement).focus({ preventScroll: true })
        drag.current = { y: event.clientY, from: at }
      }}
      onPointerMove={(event) => {
        const d = drag.current
        if (d) set(d.from + Math.trunc((d.y - event.clientY) / DRAG_PX))
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onWheel={(event) => set(at + (event.deltaY < 0 ? 1 : -1))}
      onKeyDown={(event) => {
        const to = { ArrowUp: at + 1, ArrowRight: at + 1, ArrowDown: at - 1, ArrowLeft: at - 1, Home: 0, End: STEPS }[event.key]
        if (to === undefined) return
        event.preventDefault()
        event.stopPropagation()
        set(to)
      }}
    >
      <circle className="piano-close__knob-hit" cx={knob.cx} cy={knob.cy} r={knob.r * 1.22} />
      {/* its name, printed on the cream beside it, reading upwards: dark print with a faint light edge */}
      {[
        [1.3, 'piano-close__print-edge'],
        [0, 'piano-close__print'],
      ].map(([dx, className]) => (
        <text
          key={className}
          className={className as string}
          x={knob.cx + knob.r + 19 + (dx as number)}
          y={knob.cy}
          transform={`rotate(-90 ${knob.cx + knob.r + 19 + (dx as number)} ${knob.cy})`}
          dominantBaseline="middle"
          aria-hidden="true"
        >
          {name.toUpperCase()}
        </text>
      ))}
      <line
        className="piano-close__needle"
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={`rgb(${knob.colour.join(',')})`}
        strokeWidth={Math.max(5, knob.width * 0.9)}
        style={{ transform: `rotate(${-angle}deg)`, transformOrigin: `${knob.cx}px ${knob.cy}px` }}
      />
    </g>
  )
}
/**
 * Its name on the walnut rail above the keys, where a piano carries its maker's: a small brass plate
 * with PIXEL JAM PIANO engraved in the screen's own pixel letters (dark, with a hair of light below
 * each, as engraving catches it), held by a tiny screw at each end.
 */
const NAME = 'PIXEL JAM PIANO'
const NAME_PX = 3.1
const NAME_AT = { cx: 502, top: 787.5 } // on the rail's face, centred over the keys
const PLATE = (() => {
  const w = textWidth(NAME) * NAME_PX
  const left = NAME_AT.cx - w / 2
  const at = textPixels(NAME).map(([x, y]) => [left + x * NAME_PX, NAME_AT.top + y * NAME_PX] as const)
  const square = (dy: number) => at.map(([x, y]) => `M${x.toFixed(2)} ${(y + dy).toFixed(2)}h${NAME_PX}v${NAME_PX}h-${NAME_PX}z`).join('')
  return {
    letters: square(0),
    shine: square(0.8),
    x: left - 16,
    y: NAME_AT.top - 3.4,
    w: w + 32,
    h: 5 * NAME_PX + 6.8,
  }
})()
function Nameplate() {
  const { x, y, w, h } = PLATE
  const screws = [x + 7, x + w - 7]
  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id="piano-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6dfa6" />
          <stop offset="0.45" stopColor="#d9ae63" />
          <stop offset="1" stopColor="#a9793a" />
        </linearGradient>
        <radialGradient id="piano-screw" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fbe7b4" />
          <stop offset="1" stopColor="#8a5f2b" />
        </radialGradient>
      </defs>
      {/* the plate, set on the rail: a soft shadow under it, a bright top edge */}
      <rect x={x} y={y + 0.8} width={w} height={h} rx={3} fill="rgb(30 12 4 / 0.45)" />
      <rect x={x} y={y} width={w} height={h} rx={3} fill="url(#piano-brass)" stroke="rgb(90 52 20 / 0.7)" strokeWidth={0.7} />
      <line x1={x + 3} y1={y + 0.9} x2={x + w - 3} y2={y + 0.9} stroke="rgb(255 245 215 / 0.7)" strokeWidth={0.8} />
      {screws.map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={y + h / 2} r={2.3} fill="url(#piano-screw)" stroke="rgb(80 48 18 / 0.6)" strokeWidth={0.4} />
          <line x1={cx - 1.4} y1={y + h / 2 + 0.6} x2={cx + 1.4} y2={y + h / 2 - 0.6} stroke="rgb(70 40 15 / 0.8)" strokeWidth={0.5} />
        </g>
      ))}
      {/* the engraved letters */}
      <path d={PLATE.shine} fill="rgb(255 240 200 / 0.55)" />
      <path d={PLATE.letters} fill="#3a2312" />
    </g>
  )
}

/**
 * The orange light, as the loop's play/pause: lit while the loop is on (from the start: the first
 * key starts it), switched off when it's paused. Off, it's the painting's own lamp glass dimmed
 * (its texture and curve kept, as an unlit lamp looks). A play/pause mark is printed on the cream
 * above it, in the knobs' labels' ink (PrintedPlayPause). Its lit face, in the close-up's pixels.
 */
const LIGHT_BOX = [810, 315, 87, 72] as const
const LIGHT_FACE: CSSProperties = boxStyle(LIGHT_BOX)
const LIGHT_GLASS: CSSProperties = {
  backgroundImage: `url(${PIANO_CLOSE_SRC})`,
  backgroundSize: `${pct(W, LIGHT_BOX[2])} ${pct(H, LIGHT_BOX[3])}`,
  backgroundPosition: `${pct(LIGHT_BOX[0], W - LIGHT_BOX[2])} ${pct(LIGHT_BOX[1], H - LIGHT_BOX[3])}`,
}
function LoopLight({ onToggle }: { onToggle: () => void }) {
  const on = useSyncExternalStore(onLoopChange, loopOn)
  return (
    <button
      type="button"
      className="piano-close__light"
      data-playing={on ? '' : undefined}
      style={LIGHT_FACE}
      aria-pressed={on}
      aria-label={on ? content.piano.pauseLoop : content.piano.playLoop}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onToggle}
    >
      <span className="piano-close__light-glass" style={LIGHT_GLASS} aria-hidden="true" />
    </button>
  )
}
/** ▶❚❚ printed on the cream above the light, left of its brass screw (close-up pixels). */
const MARK = { x: 815, y: 274, h: 17 }
function PrintedPlayPause() {
  const { x, y, h } = MARK
  const shape = (dx: number, dy: number) =>
    `M${x + dx} ${y + dy}v${h}l${h * 0.85} ${-h / 2}z` + // ▶
    `M${x + dx + h * 0.85 + 6} ${y + dy}h${h * 0.3}v${h}h${-h * 0.3}z` + // ❚
    `M${x + dx + h * 0.85 + 6 + h * 0.3 + h * 0.22} ${y + dy}h${h * 0.3}v${h}h${-h * 0.3}z` // ❚
  return (
    <g aria-hidden="true">
      <path className="piano-close__print-edge piano-close__mark" d={shape(1.3, 0)} />
      <path className="piano-close__print piano-close__mark" d={shape(0, 0)} />
    </g>
  )
}

/** When the close-up's pictures are fetched, after the room has arrived (they're not needed before a click). */
const PRELOAD_AFTER_MS = 6000

/** An eighth note, drawn (not a font's glyph): a tilted head, its stem and a flag. */
function Note() {
  return (
    <svg viewBox="0 0 12 16" aria-hidden="true" focusable="false">
      <ellipse cx="4.2" cy="12.4" rx="3.4" ry="2.5" transform="rotate(-22 4.2 12.4)" />
      <path d="M7.1 12.2V1.6c1.6 0.9 4 2.3 3.9 5.4" fill="none" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The shelf piano's own little screen: while it's hovered, it switches on, the way an old set does
 * (a flicker, then a steady glow), and its name lights up on the glass, large, in amber pixel
 * letters (the close-up's own font). Only the letters glow: the rest of the glass stays as it is.
 * It's drawn by PianoScreenGlow, above the room's evening shading (as the lamp's light is), so it
 * reads as lit; it sits over the picture's glass at its tilt and grows with the piano on hover.
 */
const [GX, GY, GW, GH] = PIANO_SHELF.screen
const [SHELF_W, SHELF_H] = PIANO_SHELF.size
const TILT = Math.tan((PIANO_SHELF_SHEAR * Math.PI) / 180)
const SHELF_SCREEN: CSSProperties = {
  left: pct(GX, SHELF_W),
  top: pct(GY, SHELF_H),
  width: pct(GW, SHELF_W),
  height: pct(GH - GW * TILT, SHELF_H), // (its box holds the glass tilted: the glass itself is this tall)
  transform: `skewY(${PIANO_SHELF_SHEAR}deg)`,
}
function ShelfScreen({ on }: { on: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvas.current
    const g = c?.getContext('2d')
    if (!c || !g || c.width === TITLE_W) return
    c.width = TITLE_W
    c.height = TITLE_H
    const img = g.createImageData(TITLE_W, TITLE_H) // transparent but for the letters
    const put: Put = (x, y, col, a) => {
      const i = (Math.round(y) * TITLE_W + Math.round(x)) * 4
      img.data.set([col[0] * 255, col[1] * 255, col[2] * 255, Math.min(1, a) * 255], i)
    }
    paintName(put, 1)
    g.putImageData(img, 0, 0)
  }, [])
  return (
    <span className="piano__screen" data-on={on ? '' : undefined} style={SHELF_SCREEN} aria-hidden="true">
      <canvas ref={canvas} />
    </span>
  )
}

const GLOW_BOX: CSSProperties = { left: pctX(PIANO.x), top: pctY(PIANO.y), width: pctX(PIANO.width), height: pctY(PIANO.height) }
export function PianoScreenGlow({ on }: { on: boolean }) {
  return (
    <span className="piano-glow" data-on={on ? '' : undefined} style={GLOW_BOX} aria-hidden="true">
      <ShelfScreen on={on} />
    </span>
  )
}

interface PianoArtProps {
  /** Hovered or focused, or giving its paced hint: it grows a little and its screen lights up. */
  highlighted?: boolean
  /** Brought close (its close-up is showing): it leaves the shelf meanwhile. */
  away?: boolean
}

export function PianoArt({ away = false, highlighted = false }: PianoArtProps) {
  // Its close-up's pictures are fetched once the room is calm, so it comes close at once.
  useEffect(() => {
    const later = window.setTimeout(() => {
      for (const src of [PIANO_CLOSE_SRC, PIANO_ATLAS.src]) new Image().src = src
    }, PRELOAD_AFTER_MS)
    return () => window.clearTimeout(later)
  }, [])
  // a fresh splash each time it's hovered (or focused, or gives its hint), and only then
  const lit = highlighted && !away
  const [splash, setSplash] = useState<{ id: number; notes: ReturnType<typeof makeSplash> } | null>(null)
  useEffect(() => {
    if (!lit) return
    setSplash((last) => ({ id: (last?.id ?? 0) + 1, notes: makeSplash() }))
    const done = window.setTimeout(() => setSplash(null), 3200)
    return () => window.clearTimeout(done)
  }, [lit])
  return (
    <SceneObject overlay={PIANO} highlighted={lit} discoveryIndex={-1} className="piano" dataAttributes={{ 'data-away': away ? '' : undefined }}>
      <img src={PIANO.src} alt="" width={Math.round(PIANO.width)} height={Math.round(PIANO.height)} decoding="async" draggable={false} />
      {splash && (
        <span key={splash.id} className="piano__splash" style={HINT_FROM} aria-hidden="true">
          {splash.notes.map((note, i) => (
            <span
              key={i}
              className="piano__splash-note"
              style={
                {
                  '--dx': `${note.dx}em`,
                  '--dy': `${note.dy}em`,
                  '--rot': `${note.rotate}deg`,
                  '--size': note.size,
                  animationDelay: `${note.delay}s`,
                } as CSSProperties
              }
            >
              <Note />
            </span>
          ))}
        </span>
      )}
    </SceneObject>
  )
}

/** The two choices beside the piano: the screen's landscape and the loop. */
const DIALS = [
  { kind: 'landscape', label: content.piano.landscape, help: () => content.piano.landscapeHelp, names: LANDSCAPES.map((l) => l.name) },
  { kind: 'loop', label: content.piano.loop, help: (i: number) => `${Math.round(LOOPS[i]!.bpm)} BPM · ${LOOPS[i]!.key.replace('b ', '♭ ')}`, names: LOOPS.map((l) => l.name) },
] as const

const keyOf = (target: EventTarget) => (target as Element).closest?.<SVGElement>('[data-key]')?.dataset.key
/** How long the piano takes to come close, and to go back. */
const COME_MS = 1100
/**
 * Handing over between the piano on the shelf (in the room's light) and its copy in the air (in full
 * light): the same picture at the same place, so they cross over as a change of light, never a swap.
 */
const HANDOFF_MS = 140
/** The real piano lifts itself off the wood (in the room, in its light) before anything else happens, and sets itself down last. */
const LIFT_MS = 300
const shelfPiano = () => document.querySelector<HTMLElement>('.scene-object--piano')
const lend = (lent: boolean) => shelfPiano()?.toggleAttribute('data-lent', lent)
const lift = (up: boolean) => shelfPiano()?.toggleAttribute('data-lift', up)
/**
 * The room's own light where the shelf piano is: its evening shading, and at night its cool layer
 * too (HeroScene.css: .room-mood, .time-light--night, both multiplied over the room), so its copy
 * in the air can start in exactly that light and brighten as it comes away.
 */
type Glow = { at: [number, number]; size: [number, number]; stops: [number, [number, number, number]][] }
const MOOD: Glow = { at: [0.54, 0.52], size: [0.46, 0.6], stops: [[0, [255, 250, 244]], [0.3, [238, 220, 206]], [0.62, [196, 166, 156]], [0.86, [150, 120, 124]], [1, [122, 96, 108]]] }
const NIGHT: Glow = { at: [0.54, 0.52], size: [0.6, 0.75], stops: [[0, [243, 244, 252]], [0.55, [205, 207, 229]], [1, [164, 168, 203]]] }
function glowAt({ at, size, stops }: Glow, x: number, y: number) {
  const r = Math.hypot((x - at[0]) / size[0], (y - at[1]) / size[1])
  let i = 1
  while (i < stops.length - 1 && stops[i]![0] < r) i++
  const [r0, c0] = stops[i - 1]!
  const [r1, c1] = stops[i]!
  const k = Math.max(0, Math.min(1, (r - r0) / (r1 - r0 || 1)))
  return c0.map((v, j) => (v + (c1[j]! - v) * k) / 255)
}
const LAMP_LIFT = [1.23, 1.32, 1.1]
function roomLight() {
  const room = document.querySelector('.room-mood')?.getBoundingClientRect()
  const piano = shelfPiano()?.getBoundingClientRect()
  if (!room || !piano || !room.width) return 'rgb(255 255 255)'
  const x = (piano.left + piano.width / 2 - room.left) / room.width
  const y = (piano.top + piano.height / 2 - room.top) / room.height
  let c = glowAt(MOOD, x, y)
  const night = document.querySelector('.time-light--night')
  const nightK = night ? Number(getComputedStyle(night).opacity) || 0 : 0
  if (nightK > 0) c = c.map((v, j) => v * (1 - nightK + nightK * glowAt(NIGHT, x, y)[j]!))
  // ...and the lamp's warm light (an overlay over the room, not worth modelling): measured against
  // the real piano on the shelf, it lifts the shading this much, most in green, least in blue
  c = c.map((v, j) => Math.min(1, v * LAMP_LIFT[j]!))
  return `rgb(${c.map((v) => Math.round(v * 255)).join(' ')})`
}
const GO_MS = 750
/** How long its controls take to step aside before it goes back to the shelf. */
const GO_AFTER_MS = 120
/** One curve for the whole journey: an unhurried start (it's lifted), a long, soft landing. */
const EASE = 'cubic-bezier(0.45, 0, 0.15, 1)'
type Place = { dx: number; dy: number; scale: number; height: number }
const SHELF_TURN = 20 // degrees: the shelf picture's angle (its right side further away)
/**
 * Its journey from the shelf to you, as keyframes along an arc: it rises off the shelf first (as if
 * picked up), then turns down at the top of its curve and glides to the middle and settles, growing
 * as it comes. Sampled finely so the path is a true curve; the animation's one easing paces it.
 * Also says where the pictures change places (swapAt: mid-flight).
 */
function journey({ dx, dy, scale, height }: Place) {
  const rise = Math.max(height * 0.6, window.innerHeight * 0.06) // how far above the straight path it arcs
  const cx = dx * 0.55 // the arc's control point: past the start, above both ends
  const cy = Math.min(dy, 0) - rise
  // where the two pictures change places: in the middle of the flight, at full speed, far from the
  // shelf at both ends (on a wide screen the arc's top comes right after take-off: too close)
  const swapAt = 0.48
  const path = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24
    const u = 1 - t
    const x = u * u * dx + 2 * u * t * cx
    const y = u * u * dy + 2 * u * t * cy
    const k = Math.pow(scale, 1 - t) // it grows at an even pace to the eye (by the same factor each moment)
    return { transform: `translate(${x}px, ${y}px) scale(${k})`, offset: t }
  })
  return { path, swapAt }
}
/** Its shadow: small and close on the shelf, wide and soft in the air in front of the room. */
const SHADOW_ON_SHELF = 'drop-shadow(0 0.15rem 0.25rem oklch(0.08 0.01 45 / 0.55))'
const SHADOW_IN_AIR = 'drop-shadow(0 1.5rem 2.5rem oklch(0.08 0.01 45 / 0.45))'
/**
 * The shelf's three-quarter picture flies out as itself, and gives way to the front-on close-up in a
 * blink in the middle of its flight (swapAt), at full speed, under a touch of motion blur;
 * from there the close-up turns the rest of the way to face you as it comes down to land. Two
 * different pictures never dissolve slowly: that shows as a ghost.
 */
function swap(swapAt: number) {
  const turn = [
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: swapAt - 0.04 },
    { opacity: 0, offset: swapAt + 0.04 },
  ]
  return {
    turn,
    blur: [
      { filter: 'blur(0px)', offset: 0 },
      { filter: 'blur(0px)', offset: swapAt - 0.12 },
      { filter: 'blur(1.6px)', offset: swapAt },
      { filter: 'blur(0px)', offset: swapAt + 0.14 },
    ],
    // the close-up turning to face you, from the moment it takes over (on its own layer, so the
    // shelf picture is never tilted)
    facing: [
      { transform: `perspective(1600px) rotateY(${SHELF_TURN}deg)`, offset: 0 },
      ...Array.from({ length: 9 }, (_, i) => ({
        transform: `perspective(1600px) rotateY(${SHELF_TURN * (1 - i / 8)}deg)`,
        offset: swapAt + ((1 - swapAt) * i) / 8,
      })),
    ],
  }
}
/** The room's light on the shelf picture: a tint over the picture alone (its own outline as the mask). */
const FROM_LIGHT: CSSProperties = { maskImage: `url(${PIANO.src})`, WebkitMaskImage: `url(${PIANO.src})` }
const FROM_STYLE: CSSProperties = {
  // the shelf picture at the close-up's height, centred (it's the wider of the two)
  width: `${(PIANO.width / PIANO.height / (W / H)) * 100}%`,
}

interface PianoCloseUpProps {
  /** Brought close (the piano on the shelf was clicked). */
  open: boolean
  /** It has gone back to the shelf. */
  onClosed: () => void
}

export function PianoCloseUp({ open, onClosed }: PianoCloseUpProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const keysRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'closed' | 'open' | 'closing'>('closed')
  const reducedMotion = usePrefersReducedMotion()
  const down = useSyncExternalStore(piano.subscribe, piano.keys)

  // Where the close-up would sit to lie exactly over the piano on the shelf.
  const fromShelf = (): Place | null => {
    const shelf = document.querySelector('.scene-object--piano')?.getBoundingClientRect()
    const here = stage.current?.getBoundingClientRect()
    if (!shelf || !here || !here.width) return null
    return {
      scale: shelf.height / here.height, // (handle to feet: the two pictures aren't the same shape)
      dx: shelf.left + shelf.width / 2 - (here.left + here.width / 2),
      dy: shelf.top + shelf.height / 2 - (here.top + here.height / 2),
      height: shelf.height,
    }
  }
  /** The whole journey, forwards (coming close) or backwards (going back): path, picture, shadow. */
  const travel = (place: Place, back: boolean) => {
    const node = stage.current
    if (!node) return null
    const timing: KeyframeAnimationOptions = {
      duration: back ? GO_MS : COME_MS,
      // (coming, its copy first appears over the shelf piano; going back, its controls leave first)
      delay: back ? GO_AFTER_MS : HANDOFF_MS,
      easing: EASE,
      fill: back ? 'both' : 'backwards',
      direction: back ? 'reverse' : 'normal',
    }
    const body = node.querySelector('.piano-close__body')
    const from = node.querySelector('.piano-close__from')
    const { path, swapAt } = journey(place)
    const { turn, blur, facing } = swap(swapAt)
    // the copy starts in the room's light, exactly as the piano on the shelf looks, and comes into
    // full light as it rises (before it turns to face you)
    const light = node.querySelector<HTMLElement>('.piano-close__from-light')
    if (light) light.style.background = roomLight()
    const moves = [
      node.animate(path, timing),
      node.animate([{ filter: SHADOW_ON_SHELF }, { filter: SHADOW_IN_AIR }], timing),
      from?.animate(turn, timing),
      body?.animate(turn.map((k) => ({ ...k, opacity: 1 - k.opacity })), timing),
      from?.animate(blur, timing),
      body?.animate(blur, timing),
      body?.animate(facing, timing),
      light?.animate([{ opacity: 1, offset: 0 }, { opacity: 0, offset: Math.max(0.1, swapAt - 0.06) }], timing),
    ]
    if (!back && from) {
      // its copy fades in over the piano on the shelf, which then steps out of the room
      void from
        .animate([{ opacity: 0 }, { opacity: 1 }], { duration: HANDOFF_MS, easing: 'ease-out' })
        .finished.then(() => lend(true), () => lend(true))
    }
    return moves[0]!
  }

  // Come close: open the dialog, and once its picture is ready, grow from the shelf.
  useEffect(() => {
    const box = dialog.current
    const node = stage.current
    if (!open || !box || !node || box.open) return
    box.showModal()
    keysRef.current?.focus({ preventScroll: true })
    // the real piano lifts itself off the wood first, in the room; its copy waits unseen until
    // that's done and its own picture is decoded, then takes over in the air, at the same place
    const body = node.querySelector<HTMLElement>('.piano-close__body')
    const shelfPicture = node.querySelector<HTMLElement>('.piano-close__from')
    if (body) body.style.opacity = '0'
    if (shelfPicture) shelfPicture.style.opacity = '0'
    if (!reducedMotion) lift(true)
    let live = true
    const art = node.querySelector('img')
    const lifted = new Promise((done) => window.setTimeout(done, reducedMotion ? 0 : LIFT_MS))
    void Promise.all([(art?.decode?.() ?? Promise.resolve()).catch(() => {}), lifted]).then(() => {
      if (!live) return
      const from = reducedMotion ? null : fromShelf()
      setState('open')
      // once it has landed up close, the room's other sounds stop (the focus music, the rain, the purr)
      const landed = () => live && quietTheRoom()
      const coming = from ? travel(from, false) : null
      if (coming) void coming.finished.then(landed, landed)
      else {
        if (!from) lend(true) // (no journey: it simply steps out of the room)
        landed()
      }
      if (body) body.style.opacity = ''
      if (shelfPicture) shelfPicture.style.opacity = ''
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Go back to the shelf, then close.
  const close = () => {
    const box = dialog.current
    if (!box?.open || state === 'closing') return
    setState('closing')
    piano.releaseAll()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      lend(false)
      lift(false) // the real piano sets itself down on the wood
      box.close()
      setState('closed')
      onClosed()
      restoreTheRoom() // (the music that was playing before plays on)
    }
    const to = fromShelf()
    if (!to || reducedMotion) return void window.setTimeout(finish, reducedMotion ? 160 : 0)
    const going = travel(to, true)
    if (!going) return finish()
    // (and never later than it should be: a tab in the background barely runs animations)
    lift(true) // (the real piano waits in the air above the shelf, unseen, to be handed back)
    const late = window.setTimeout(finish, GO_AFTER_MS + GO_MS + HANDOFF_MS + 250)
    void going.finished
      .catch(() => {})
      .then(() => {
        // back above the shelf, still in the air: the real piano comes back under it, its copy fades
        // away, then the real one sets itself down (finish)
        lend(false)
        const from = stage.current?.querySelector('.piano-close__from')
        const fade = from?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: HANDOFF_MS, easing: 'ease-in', fill: 'forwards' })
        return fade?.finished.catch(() => {})
      })
      .then(() => {
        window.clearTimeout(late)
        finish()
        for (const a of stage.current?.getAnimations({ subtree: true }) ?? []) a.cancel()
      })
  }

  // Esc: go back the same way (not the dialog's own instant close).
  useEffect(() => {
    const box = dialog.current
    if (!box) return
    const onCancel = (event: Event) => {
      event.preventDefault()
      close()
    }
    box.addEventListener('cancel', onCancel)
    return () => box.removeEventListener('cancel', onCancel)
  })

  // The notes sound only while it is close.
  useEffect(() => (state === 'open' ? listenTo(piano) : undefined), [state])

  // Its screen: a little landscape that answers the music, drawn only while it is close.
  const canvas = useRef<HTMLCanvasElement>(null)
  const screen = useRef<PianoScreen | null>(null)
  const [knobs, setKnobs] = useState(settings)
  useEffect(() => {
    if (state !== 'open' || !canvas.current) return
    // (a new one each time it opens: its canvas is new, and what a melody left behind stays until it closes)
    const s = createPianoScreen(canvas.current, reducedMotion)
    s.setLandscape(settings().landscape)
    s.start()
    screen.current = s
    return () => {
      s.stop()
      screen.current = null
    }
  }, [state, reducedMotion])
  const turnLandscape = (v: number) => {
    setLandscape(v)
    screen.current?.setLandscape(v)
    screen.current?.readout('landscape', v)
    setKnobs(settings())
  }
  const turnLoop = (v: number) => {
    setLoop(v)
    screen.current?.readout('loop', v)
    setKnobs(settings())
  }
  const toggleLight = () => {
    toggleLoop()
    screen.current?.readout('loopState', loopOn() ? 1 : 0)
  }
  const turnVolume = (which: 'loop' | 'keys', v: number) => {
    setVolume(which, v)
    screen.current?.readout(which === 'loop' ? 'loopVolume' : 'keysVolume', v)
    setKnobs(settings())
  }

  // Pointers (mouse, pen, fingers) pressed on the keys and not yet lifted: sliding one across
  // the keys plays each key it reaches, like a glissando.
  const pressing = useRef(new Set<number>())
  useEffect(() => {
    const lifted = (event: globalThis.PointerEvent) => {
      pressing.current.delete(event.pointerId)
      piano.release(`p${event.pointerId}`)
    }
    const away = () => document.hidden && piano.releaseAll()
    window.addEventListener('pointerup', lifted)
    window.addEventListener('pointercancel', lifted)
    document.addEventListener('visibilitychange', away)
    return () => {
      window.removeEventListener('pointerup', lifted)
      window.removeEventListener('pointercancel', lifted)
      document.removeEventListener('visibilitychange', away)
      piano.releaseAll()
    }
  }, [])

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const key = keyOf(event.target)
    if (!key || state !== 'open' || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault() // no text selection, no focus change: the keys keep the keyboard
    // A finger is held by the key it lands on: let it go, so it can slide on to the next key.
    const target = event.target as Element
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId)
    pressing.current.add(event.pointerId)
    piano.press(`p${event.pointerId}`, key)
  }
  const onPointerOver = (event: PointerEvent<SVGSVGElement>) => {
    const key = keyOf(event.target)
    if (key && pressing.current.has(event.pointerId)) piano.press(`p${event.pointerId}`, key)
  }
  // Off the keys, the key comes up (and plays again if the pointer comes back still pressed).
  const onPointerLeave = (event: PointerEvent<SVGSVGElement>) => piano.release(`p${event.pointerId}`)

  // The computer keyboard plays it wherever the focus is in the close-up.
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    const key = KEYBOARD_NOTES[event.code]
    if (!key || event.metaKey || event.ctrlKey || event.altKey) return
    event.preventDefault()
    event.stopPropagation() // a note, not a shortcut
    if (!event.repeat && state === 'open') piano.press(`k${event.code}`, key)
  }
  const onKeyUp = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (KEYBOARD_NOTES[event.code]) piano.release(`k${event.code}`)
  }

  // A click on the dimmed room around it (not a press that began on the piano) sends it back.
  const pressStartedOutside = useRef(false)
  const onDialogPointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    pressStartedOutside.current = event.target === event.currentTarget
  }
  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (pressStartedOutside.current && event.target === event.currentTarget) close()
  }

  return (
    <dialog
      ref={dialog}
      className="piano-close"
      data-state={state}
      aria-label={content.piano.closeUpLabel}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onPointerDown={onDialogPointerDown}
      onClick={onDialogClick}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) piano.releaseAll()
      }}
    >
      {(open || state !== 'closed') && (
        <div className="piano-close__frame">
          <button type="button" className="piano-close__close" onClick={close}>
            <span>{content.piano.close}</span>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>

          <div ref={stage} className="piano-close__stage" style={STAGE}>
            <div className="piano-close__body">
            <img className="piano-close__art" src={PIANO_CLOSE_SRC} alt="" width={W} height={H} draggable={false} />
            {SPRITES.map((sprite) => (
              <span key={sprite.id} className="piano-close__key" data-down={down.has(sprite.id) ? '' : undefined} style={sprite.style} />
            ))}
            <div className="piano-close__light-of-keys" aria-hidden="true">
              {GLOWS.map((glow) => (
                <KeyGlow key={glow.id} glow={glow} down={down.has(glow.key.id)} />
              ))}
            </div>
            {/* The screen: a pixel-art landscape that answers the music (src/scene/pianoScreen.ts),
                clipped to the glass's outline, behind faint scanlines. */}
            <div className="piano-close__screen" data-screen="" style={SCREEN_STYLE}>
              <canvas ref={canvas} aria-hidden="true" />
              <span className="piano-close__glass" aria-hidden="true" />
            </div>
            <div
              ref={keysRef}
              className="piano-close__keys"
              role="application"
              aria-roledescription="piano"
              aria-label={content.piano.closeUpLabel}
              aria-describedby="piano-how-to"
              tabIndex={-1}
            >
              <svg
                viewBox={`0 0 ${W} ${H}`}
                aria-hidden="true"
                focusable="false"
                onPointerDown={onPointerDown}
                onPointerOver={onPointerOver}
                onPointerLeave={onPointerLeave}
              >
                {PIANO_KEYS.map((key) => (
                  <path key={key.id} className="piano-close__hit" data-key={key.id} d={key.hit} />
                ))}
              </svg>
            </div>
            <LoopLight onToggle={toggleLight} />
            <svg className="piano-close__knobs" viewBox={`0 0 ${W} ${H}`}>
              <Nameplate />
              <PrintedPlayPause />
              {PIANO_KNOBS.length === 2 && (
                <>
                  <Knob
                    knob={PIANO_KNOBS[0]!}
                    label={content.piano.loopVolume}
                    name={content.piano.loopKnob}
                    value={knobs.loopVolume}
                    invite={state === 'open' && !reducedMotion}
                    onChange={(v) => turnVolume('loop', v)}
                  />
                  <Knob
                    knob={PIANO_KNOBS[1]!}
                    label={content.piano.keysVolume}
                    name={content.piano.keysKnob}
                    value={knobs.keysVolume}
                    invite={state === 'open' && !reducedMotion}
                    onChange={(v) => turnVolume('keys', v)}
                  />
                </>
              )}
            </svg>
            </div>
            {/* the shelf's picture, for the moment it turns to face you */}
            <span className="piano-close__from" style={FROM_STYLE} aria-hidden="true">
              <img src={PIANO.src} alt="" draggable={false} />
              <span className="piano-close__from-light" style={FROM_LIGHT} />
            </span>
          </div>

          {/* what to play over: the landscape on the screen and the loop, each stepped through with its arrows */}
          <div className="piano-close__dials">
            {DIALS.map((dial) => {
              const value = knobs[dial.kind]
              const turn = dial.kind === 'landscape' ? turnLandscape : turnLoop
              const n = dial.names.length
              return (
                <div key={dial.kind} className="piano-close__dial" role="group" aria-label={dial.label}>
                  <span className="piano-close__dial-name">{dial.label}</span>
                  <span className="piano-close__dial-dots" aria-hidden="true">
                    {dial.names.map((name, j) => (
                      <i key={name} data-on={j === value ? '' : undefined} />
                    ))}
                  </span>
                  <button type="button" className="piano-close__dial-step" aria-label={`${content.piano.previous}: ${dial.names[(value + n - 1) % n]}`} onClick={() => turn((value + n - 1) % n)}>
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M10 3.5L5.5 8l4.5 4.5" />
                    </svg>
                  </button>
                  <span className="piano-close__dial-value" aria-live="polite">
                    {dial.names[value]}
                  </span>
                  <button type="button" className="piano-close__dial-step" aria-label={`${content.piano.next}: ${dial.names[(value + 1) % n]}`} onClick={() => turn((value + 1) % n)}>
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6 3.5L10.5 8 6 12.5" />
                    </svg>
                  </button>
                  <span className="piano-close__dial-help">{dial.help(value)}</span>
                </div>
              )
            })}
          </div>

          <p id="piano-how-to" className="piano-close__how">
            {content.piano.howTo}
          </p>
          {/* the loop's credit, as its licence asks: the song, its composer, where it's from, the licence */}
          <p className="piano-close__credit">
            {content.piano.loopCredit} “{LOOPS[knobs.loop]?.name}” {content.piano.by} {LOOP_SOURCE.name} (
            <a href={LOOP_SOURCE.url} target="_blank" rel="noreferrer">
              incompetech.com
            </a>
            ),{' '}
            <a href={LOOP_SOURCE.licenceUrl} target="_blank" rel="noreferrer">
              {LOOP_SOURCE.licence}
            </a>
          </p>
        </div>
      )}
    </dialog>
  )
}
