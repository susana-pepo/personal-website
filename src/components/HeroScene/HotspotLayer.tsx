import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { content } from '../../content/content'
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { dismissDiscoveryHint } from '../../lib/discovery'
import { hrefFor } from '../../lib/router'
import { HOTSPOTS, HOVER_ZONES, SCENE_HEIGHT, SCENE_WIDTH, pctX, pctY, toPathData, type Hotspot, type HotspotAction } from '../../scene/hotspots'
import { purrHover, purrPat, purrStroke } from '../../audio/purr'
import { GlimmerCursor } from './GlimmerCursor'
import './HotspotSpeech.css'

interface HotspotLayerProps {
  /** Reports which object is lit (pointer over it, or keyboard focus on it). */
  onActiveChange: (id: string | null) => void
  /** Reports which object a pointer is pressing on (null on release, cancel or leave). Not for keys. */
  onPressChange?: (id: string | null) => void
  onAction: (action: HotspotAction) => void
  /** Keyboard focus has arrived on an object (a phone's panning room brings it into view). */
  onFocusObject?: (id: string) => void
  /** The lamp's current light, spoken with its control (e.g. "Lamp light on"). */
  lampTone?: string
  /**
   * What the woman says on her own on arrival (her greeting), floating up above her, or null. It
   * plays through to the end whatever is pointed at meanwhile, and so does her second line (`follow`).
   */
  speech?: string | null
  /** What she says while she's hovered or focused (a line about the room), in place of her usual line. */
  herLine?: string | null
  /** Her second line on arrival, floating up just behind her greeting, beneath it (while she greets). */
  follow?: string | null
  /** A pointer has come onto a hover-only outline (the plant, which sways). */
  onHoverZone?: (id: string) => void
}

const PATHS = new Map(HOTSPOTS.map((h) => [h.id, toPathData(h.polygons)]))
/** The woman at the desk: her greeting and lines float up from her label's spot. */
const WOMAN = HOTSPOTS.find((h) => h.overlay === 'woman') ?? null

/** Objects that answer in the scene itself rather than with a floating tag (the laptop's terminal). */
const LABELLED_IN_SCENE: ReadonlySet<string> = new Set(['laptop'])

/** How long a first hover waits before its label rises (the speech-in delay in HotspotSpeech.css). */
const LABEL_WAIT_MS = 320
/** How long the room stays "warm" once nothing is lit; with the 120 ms leave grace, about 600 ms. */
const WARM_COOL_MS = 480

/** The small tooltip text for an object. */
export function tooltipFor(hotspot: Hotspot): string {
  if (hotspot.action === 'pet') return content.cat.hint
  if (hotspot.action === 'light') return content.lamp.hint
  if (hotspot.action === 'play') return content.piano.hint
  const tip = hotspot.overlay ? (content.objectTooltips as Record<string, string | undefined>)[hotspot.overlay] : undefined
  if (tip) return tip
  return hotspot.section ? content.sections[hotspot.section].roomLabel : ''
}

/** The accessible name of an object's control. */
export function accessibleLabelFor(hotspot: Hotspot): string {
  if (hotspot.action === 'pet') return content.cat.actionLabel
  if (hotspot.action === 'light') return content.lamp.actionLabel
  if (hotspot.action === 'play') return content.piano.actionLabel
  const meta = content.sections[hotspot.section!]
  // Starts with the visible tooltip, so voice control ("click Open laptop") works.
  const visible = tooltipFor(hotspot)
  return visible === meta.roomLabel ? `${visible}: open ${meta.navLabel} (${meta.objectName})` : `${visible}: ${meta.title}`
}

/**
 * Transparent SVG layer over the whole canvas holding every clickable
 * outline, plus the small tooltips. Hover state changes only on enter/leave,
 * never on pointer movement, so moving inside an object doesn't re-render.
 */
export function HotspotLayer({ onActiveChange, onPressChange, onAction, onFocusObject, lampTone, speech = null, herLine = null, follow = null, onHoverZone }: HotspotLayerProps) {
  const uid = useId().replace(/:/g, '')
  const reducedMotion = usePrefersReducedMotion()
  const [hovered, setHovered] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  // Escape hides an open tooltip until the pointer or focus moves on.
  const [hushed, setHushed] = useState<string | null>(null)
  // The pointer wins while it is over an object; keyboard focus shows when it isn't.
  const active = hovered ?? focused
  const viaFocus = hovered === null && focused !== null

  useEffect(() => onActiveChange(active), [active, onActiveChange])

  // The first label waits a moment, so a pointer passing by doesn't set words flying. Once one
  // has been up, the visitor is exploring: the next object's label answers almost at once
  // (data-warm), until nothing has been lit for about 600 ms.
  const [exploring, setExploring] = useState(false)
  useEffect(() => {
    if (!active) {
      if (!exploring) return
      const cool = window.setTimeout(() => setExploring(false), WARM_COOL_MS)
      return () => window.clearTimeout(cool)
    }
    if (exploring) return
    const warmUp = window.setTimeout(() => setExploring(true), viaFocus ? 0 : LABEL_WAIT_MS)
    return () => window.clearTimeout(warmUp)
  }, [active, exploring, viaFocus])
  // Decided once per object as it lights, so a label already rising never changes pace.
  const [warmFor, setWarmFor] = useState<{ id: string | null; warm: boolean }>({ id: null, warm: false })
  if (warmFor.id !== active) setWarmFor({ id: active, warm: active !== null && exploring })
  const warm = warmFor.id === active && warmFor.warm && !reducedMotion

  // A pointer press on an object is reported up, so the object can sink a touch (HeroScene).
  const pressedId = useRef<string | null>(null)
  // The glimmer whose own hand stands in for the cursor while a mouse is over it (GlimmerCursor).
  const [hand, setHand] = useState<HotspotAction | null>(null)
  const [handPressed, setHandPressed] = useState(false)
  const press = useCallback(
    (id: string) => {
      pressedId.current = id
      setHandPressed(true)
      onPressChange?.(id)
    },
    [onPressChange],
  )
  const release = useCallback(
    (id: string) => {
      if (pressedId.current !== id) return
      pressedId.current = null
      setHandPressed(false)
      onPressChange?.(null)
    },
    [onPressChange],
  )
  useEffect(() => {
    if (active !== hushed) setHushed(null)
  }, [active, hushed])

  useEffect(() => {
    if (!active) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setHushed(active)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  // A short grace period on leave lets the pointer travel onto the tooltip
  // without it vanishing (the tooltip itself keeps it open: WCAG 1.4.13).
  const leaveTimer = useRef<number | undefined>(undefined)
  const enter = useCallback((id: string) => {
    window.clearTimeout(leaveTimer.current)
    setHovered(id)
  }, [])
  const leave = useCallback((id: string) => {
    window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => setHovered((current) => (current === id ? null : current)), 120)
  }, [])
  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])
  // Moving focus with the keyboard takes over from a resting mouse.
  const focusChange = useCallback(
    (id: string | null) => {
      if (id) {
        window.clearTimeout(leaveTimer.current)
        setHovered(null)
        onFocusObject?.(id)
      }
      setFocused(id)
    },
    [onFocusObject],
  )
  const act = useCallback(
    (action: HotspotAction) => {
      dismissDiscoveryHint()
      onAction(action)
    },
    [onAction],
  )

  return (
    <>
      <svg
        className="hotspots"
        viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
        preserveAspectRatio="none"
        data-active={active ?? undefined}
        data-hand={hand ?? undefined}
      >
        <defs>
          <filter id={`${uid}-glow`} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>

        {/* Hover-only outlines (the plant's sway), drawn first of all: no click, no label, no keyboard
            stop, and every object's own outline and reach wins over them where they overlap. */}
        <g className="hotspots__hover" aria-hidden="true">
          {HOVER_ZONES.map((zone) => (
            <path key={zone.id} d={toPathData(zone.polygons)} data-zone={zone.id} onPointerEnter={() => onHoverZone?.(zone.id)} />
          ))}
        </g>

        {/* Extra reach for fingers, drawn first so every object's own shape wins over a neighbour's margin. */}
        <g className="hotspots__reach" aria-hidden="true">
          {HOTSPOTS.map((hotspot) => (
            <ReachArea
              key={hotspot.id}
              hotspot={hotspot}
              onEnter={enter}
              onLeave={leave}
              onPress={press}
              onRelease={release}
              onAction={act}
            />
          ))}
        </g>

        <g role="group" aria-label="Objects in the room">
          {HOTSPOTS.map((hotspot) => (
            <InteractiveHotspot
              key={hotspot.id}
              hotspot={hotspot}
              glowFilter={`url(#${uid}-glow)`}
              isActive={active === hotspot.id}
              onEnter={enter}
              onLeave={leave}
              onPress={press}
              onRelease={release}
              onFocusChange={focusChange}
              onAction={act}
              onHand={setHand}
              state={hotspot.action === 'light' ? lampTone : undefined}
            />
          ))}
        </g>
      </svg>

      <GlimmerCursor kind={hand} pressed={handPressed} />

      <div className="hotspot-labels" aria-hidden="true">
        {HOTSPOTS.map((hotspot) => {
          // Glimmers (the cat, the lamp, the piano) have no label: their cursor and their own
          // answer say it (src/scene/glimmers.ts). Screen readers still get each one's name.
          if (hotspot.action) return null
          // Objects that show their own label in the painting (the laptop's terminal types it).
          if (hotspot.overlay && LABELLED_IN_SCENE.has(hotspot.overlay)) return null
          const greets = hotspot.overlay === 'woman'
          // She speaks with her greeting's float: on her own (greeting, invitation), and when
          // hovered with a line about the room (it rises and fades like the greeting).
          // her greeting and second line play through untouched, whatever is pointed at meanwhile
          const greetingNow = greets && speech !== null
          const lineNow = greets && !greetingNow && herLine !== null && active === hotspot.id && hushed !== hotspot.id
          const floating = greetingNow || lineNow
          const shown = (active === hotspot.id && hushed !== hotspot.id) || greetingNow
          return (
            <span
              key={hotspot.id}
              className={`hotspot-label${hotspot.section ? ' hotspot-label--speech' : ''}${greets ? ' hotspot-label--greeting' : ''}`}
              data-placement={hotspot.label.placement}
              data-visible={shown ? '' : undefined}
              data-immediate={shown && viaFocus ? '' : undefined}
              data-warm={shown && warm && active === hotspot.id ? '' : undefined}
              data-greeting={floating ? '' : undefined}
              data-brief={greetingNow ? '' : undefined}
              data-line={lineNow ? '' : undefined}
              style={{ left: pctX(hotspot.label.x), top: pctY(hotspot.label.y) }}
              onPointerEnter={() => shown && enter(hotspot.id)}
              onPointerLeave={() => leave(hotspot.id)}
            >
              <span className="hotspot-label__text">{greetingNow ? speech : lineNow ? herLine : tooltipFor(hotspot)}</span>
            </span>
          )
        })}
        {/* her second line on arrival: the same float, in the same place, once her greeting has faded */}
        {follow && WOMAN && (
          <span
            className="hotspot-label hotspot-label--speech hotspot-label--greeting hotspot-label--follow"
            data-placement={WOMAN.label.placement}
            data-visible=""
            data-greeting=""
            style={{ left: pctX(WOMAN.label.x), top: pctY(WOMAN.label.y) }}
          >
            <span className="hotspot-label__text">{follow}</span>
          </span>
        )}
        {HOTSPOTS.filter((hotspot) => hotspot.section).map((hotspot) => (
          <span
            key={`marker-${hotspot.id}`}
            className="hotspot-marker"
            data-hidden={active === hotspot.id || (speech !== null && hotspot.overlay === 'woman') ? '' : undefined}
            style={{ left: pctX(hotspot.label.x), top: pctY(hotspot.label.y) }}
          />
        ))}
      </div>
    </>
  )
}

/** An invisible, wider margin around an object, only active on touch screens (see CSS). */
function ReachArea({
  hotspot,
  onEnter,
  onLeave,
  onPress,
  onRelease,
  onAction,
}: {
  hotspot: Hotspot
  onEnter: (id: string) => void
  onLeave: (id: string) => void
  onPress: (id: string) => void
  onRelease: (id: string) => void
  onAction: (action: HotspotAction) => void
}) {
  const d = PATHS.get(hotspot.id)
  const handlers = {
    onPointerEnter: () => onEnter(hotspot.id),
    onPointerLeave: () => {
      onRelease(hotspot.id)
      onLeave(hotspot.id)
    },
    ...pressHandlers(hotspot.id, onPress, onRelease),
  }
  if (hotspot.section) {
    return (
      <a href={hrefFor(hotspot.section)} tabIndex={-1} onClick={() => dismissDiscoveryHint()} {...handlers}>
        <path className="hotspot__reach" d={d} />
      </a>
    )
  }
  return (
    <path
      className="hotspot__reach"
      d={d}
      onClick={() => {
        if (hotspot.action === 'pet') purrPat()
        onAction(hotspot.action!)
      }}
      {...handlers}
    />
  )
}

/**
 * A pointer press on an object: the main button or a touch going down, until it lifts or is
 * cancelled (a scroll, a drag). Keys never press: Enter and Space act without the sink.
 */
function pressHandlers(id: string, onPress: (id: string) => void, onRelease: (id: string) => void) {
  return {
    onPointerDown: (event: PointerEvent<Element>) => {
      if (event.button === 0 && !event.ctrlKey) onPress(id) // Ctrl+click on a Mac opens a menu instead
    },
    onPointerUp: () => onRelease(id),
    onPointerCancel: () => onRelease(id),
  }
}

interface InteractiveHotspotProps {
  hotspot: Hotspot
  glowFilter: string
  isActive: boolean
  onEnter: (id: string) => void
  onLeave: (id: string) => void
  onPress: (id: string) => void
  onRelease: (id: string) => void
  onFocusChange: (id: string | null) => void
  onAction: (action: HotspotAction) => void
  /** A glimmer reports a mouse arriving (its action) and leaving (null): its own hand is the cursor then. */
  onHand: (action: HotspotAction | null) => void
  /** Its current state, added to its name (the lamp's light colour). */
  state?: string
}

/**
 * One interactive object: its outline (position and size from the shared
 * canvas), an accessible name, resting / hover / focus / active states, and
 * either a link to its section or an in-place action (petting the cat, lighting
 * the lamp, playing the piano). Section objects are real links (`#music`); the
 * objects with an action are buttons, activated by click, tap, Enter or Space. Objects painted into the video get a warm wash
 * of lamplight here; overlays light their own precomputed halos (SceneObject).
 */
export function InteractiveHotspot({
  hotspot,
  glowFilter,
  isActive,
  onEnter,
  onLeave,
  onPress,
  onRelease,
  onFocusChange,
  onAction,
  onHand,
  state,
}: InteractiveHotspotProps) {
  const d = PATHS.get(hotspot.id)
  const spaceDown = useRef(false)
  const stroke = useRef<{ x: number; y: number; t: number } | null>(null)
  const shared = {
    className: `hotspot${hotspot.overlay ? ' hotspot--overlay' : ''}`,
    'data-object': hotspot.id,
    'data-active': isActive ? '' : undefined,
    'aria-label': state ? `${accessibleLabelFor(hotspot)}, now ${state}` : accessibleLabelFor(hotspot),
    onPointerEnter: (event: PointerEvent<Element>) => {
      onEnter(hotspot.id)
      if (hotspot.action && event.pointerType === 'mouse') onHand(hotspot.action)
      if (hotspot.action === 'pet' && event.pointerType === 'mouse') {
        stroke.current = { x: event.clientX, y: event.clientY, t: event.timeStamp }
        purrHover(true)
      }
      // The cat purrs as soon as a mouse comes near (touch has no hover: a tap does it).
      // The lamp waits for a click.
      if (hotspot.action === 'pet' && event.pointerType === 'mouse') onAction(hotspot.action)
    },
    onPointerLeave: () => {
      onRelease(hotspot.id)
      onLeave(hotspot.id)
      if (hotspot.action) onHand(null)
      if (hotspot.action === 'pet') purrHover(false)
    },
    // stroking the cat: how fast the hand moves sets how full its purr is
    onPointerMove:
      hotspot.action === 'pet'
        ? (event: PointerEvent<Element>) => {
            if (event.pointerType !== 'mouse') return
            const last = stroke.current
            stroke.current = { x: event.clientX, y: event.clientY, t: event.timeStamp }
            const dt = last ? (event.timeStamp - last.t) / 1000 : 0
            if (last && dt > 0) purrStroke(Math.hypot(event.clientX - last.x, event.clientY - last.y) / dt)
          }
        : undefined,
    ...pressHandlers(hotspot.id, onPress, onRelease),
    onFocus: (event: FocusEvent<Element>) => {
      // Only light up for keyboard focus, not after a mouse click.
      if (event.currentTarget.matches(':focus-visible')) {
        onFocusChange(hotspot.id)
        if (hotspot.action === 'pet') onAction(hotspot.action)
      }
    },
    onBlur: () => {
      spaceDown.current = false
      onRelease(hotspot.id) // e.g. the window loses focus mid-press, so the release never arrives
      onFocusChange(null)
    },
  }
  const shapes = (
    <>
      {!hotspot.overlay && <path className="hotspot__glow" d={d} fillRule="evenodd" filter={glowFilter} />}
      <path className="hotspot__hit" d={d} fillRule="evenodd" />
      <path className="hotspot__focus-halo" d={d} />
      <path className="hotspot__focus" d={d} />
    </>
  )

  if (hotspot.section) {
    return (
      <a
        {...shared}
        href={hrefFor(hotspot.section)}
        onClick={() => dismissDiscoveryHint()}
      >
        {shapes}
      </a>
    )
  }

  // a click, tap or key: on the cat, a pat (which is also what first lets its purr be heard)
  const activate = () => {
    if (hotspot.action === 'pet') purrPat()
    onAction(hotspot.action!)
  }
  return (
    <g
      {...shared}
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
        if (event.key === 'Enter' && !event.repeat) {
          event.preventDefault()
          activate()
        } else if (event.key === ' ') {
          event.preventDefault() // no page scroll; act on release, like a native button
          spaceDown.current = true
        }
      }}
      onKeyUp={(event: KeyboardEvent<SVGGElement>) => {
        // Only a Space that was pressed here counts (not one carried over from another control).
        if (event.key === ' ' && spaceDown.current) activate()
        spaceDown.current = false
      }}
    >
      {shapes}
    </g>
  )
}
