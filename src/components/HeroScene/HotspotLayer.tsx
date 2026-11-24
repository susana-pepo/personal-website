import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { content } from '../../content/content'
import { dismissDiscoveryHint } from '../../lib/discovery'
import { hrefFor } from '../../lib/router'
import { HOTSPOTS, SCENE_HEIGHT, SCENE_WIDTH, pctX, pctY, toPathData, type Hotspot, type HotspotAction } from '../../scene/hotspots'
import './HotspotSpeech.css'

interface HotspotLayerProps {
  /** Reports which object is lit (pointer over it, or keyboard focus on it). */
  onActiveChange: (id: string | null) => void
  onAction: (action: HotspotAction) => void
  /** The lamp's current light, spoken with its control (e.g. "Lamp light on"). */
  lampTone?: string
  /**
   * First visit, before the visitor has touched the room: the woman greets them on her own
   * ("Hey there, I'm Susana") until they hover or open something.
   */
  greeting?: boolean
}

const PATHS = new Map(HOTSPOTS.map((h) => [h.id, toPathData(h.polygons)]))

/** Objects that answer in the scene itself rather than with a floating tag (the laptop's terminal, the lamp's splash). */
const LABELLED_IN_SCENE: ReadonlySet<string> = new Set(['laptop', 'lamp'])

/** The small tooltip text for an object. */
export function tooltipFor(hotspot: Hotspot): string {
  if (hotspot.action === 'pet') return content.cat.hint
  if (hotspot.action === 'light') return content.lamp.hint
  const tip = hotspot.overlay ? (content.objectTooltips as Record<string, string | undefined>)[hotspot.overlay] : undefined
  if (tip) return tip
  return hotspot.section ? content.sections[hotspot.section].roomLabel : ''
}

/** The accessible name of an object's control. */
export function accessibleLabelFor(hotspot: Hotspot): string {
  if (hotspot.action === 'pet') return content.cat.actionLabel
  if (hotspot.action === 'light') return content.lamp.actionLabel
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
export function HotspotLayer({ onActiveChange, onAction, lampTone, greeting = false }: HotspotLayerProps) {
  const uid = useId().replace(/:/g, '')
  const [hovered, setHovered] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  // Escape hides an open tooltip until the pointer or focus moves on.
  const [hushed, setHushed] = useState<string | null>(null)
  // The pointer wins while it is over an object; keyboard focus shows when it isn't.
  const active = hovered ?? focused
  const viaFocus = hovered === null && focused !== null

  useEffect(() => onActiveChange(active), [active, onActiveChange])
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
  const focusChange = useCallback((id: string | null) => {
    if (id) {
      window.clearTimeout(leaveTimer.current)
      setHovered(null)
    }
    setFocused(id)
  }, [])
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
      >
        <defs>
          <filter id={`${uid}-glow`} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>

        {/* Extra reach for fingers, drawn first so every object's own shape wins over a neighbour's margin. */}
        <g className="hotspots__reach" aria-hidden="true">
          {HOTSPOTS.map((hotspot) => (
            <ReachArea key={hotspot.id} hotspot={hotspot} onEnter={enter} onLeave={leave} onAction={act} />
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
              onFocusChange={focusChange}
              onAction={act}
              state={hotspot.action === 'light' ? lampTone : undefined}
            />
          ))}
        </g>
      </svg>

      <div className="hotspot-labels" aria-hidden="true">
        {HOTSPOTS.map((hotspot) => {
          // The cat is a playful extra, not a section: no hover tooltip.
          if (hotspot.action === 'pet') return null
          // Objects that show their own label in the painting (the laptop's terminal types it).
          if (hotspot.overlay && LABELLED_IN_SCENE.has(hotspot.overlay)) return null
          const greets = hotspot.overlay === 'woman'
          const greetingNow = greets && greeting && active === null
          const shown = (active === hotspot.id && hushed !== hotspot.id) || greetingNow
          return (
            <span
              key={hotspot.id}
              className={`hotspot-label${hotspot.section ? ' hotspot-label--speech' : ''}${greets ? ' hotspot-label--greeting' : ''}`}
              data-placement={hotspot.label.placement}
              data-visible={shown ? '' : undefined}
              data-immediate={shown && viaFocus ? '' : undefined}
              data-greeting={greetingNow ? '' : undefined}
              style={{ left: pctX(hotspot.label.x), top: pctY(hotspot.label.y) }}
              onPointerEnter={() => shown && enter(hotspot.id)}
              onPointerLeave={() => leave(hotspot.id)}
            >
              <span className="hotspot-label__text">{tooltipFor(hotspot)}</span>
            </span>
          )
        })}
        {HOTSPOTS.filter((hotspot) => hotspot.section).map((hotspot) => (
          <span
            key={`marker-${hotspot.id}`}
            className="hotspot-marker"
            data-hidden={active === hotspot.id || (greeting && active === null && hotspot.overlay === 'woman') ? '' : undefined}
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
  onAction,
}: {
  hotspot: Hotspot
  onEnter: (id: string) => void
  onLeave: (id: string) => void
  onAction: (action: HotspotAction) => void
}) {
  const d = PATHS.get(hotspot.id)
  const handlers = { onPointerEnter: () => onEnter(hotspot.id), onPointerLeave: () => onLeave(hotspot.id) }
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
      onClick={() => onAction(hotspot.action!)}
      {...handlers}
    />
  )
}

interface InteractiveHotspotProps {
  hotspot: Hotspot
  glowFilter: string
  isActive: boolean
  onEnter: (id: string) => void
  onLeave: (id: string) => void
  onFocusChange: (id: string | null) => void
  onAction: (action: HotspotAction) => void
  /** Its current state, added to its name (the lamp's light colour). */
  state?: string
}

/**
 * One interactive object: its outline (position and size from the shared
 * canvas), an accessible name, resting / hover / focus / active states, and
 * either a link to its section or an in-place action (petting the cat).
 * Section objects are real links (`#music`); the cat is a button, activated by
 * click, tap, Enter or Space. Objects painted into the video get a warm wash
 * of lamplight here; overlays light their own precomputed halos (SceneObject).
 */
export function InteractiveHotspot({ hotspot, glowFilter, isActive, onEnter, onLeave, onFocusChange, onAction, state }: InteractiveHotspotProps) {
  const d = PATHS.get(hotspot.id)
  const spaceDown = useRef(false)
  const shared = {
    className: `hotspot${hotspot.overlay ? ' hotspot--overlay' : ''}`,
    'data-object': hotspot.id,
    'data-active': isActive ? '' : undefined,
    'aria-label': state ? `${accessibleLabelFor(hotspot)}, now ${state}` : accessibleLabelFor(hotspot),
    onPointerEnter: (event: PointerEvent<Element>) => {
      onEnter(hotspot.id)
      // The cat purrs as soon as a mouse comes near (touch has no hover: a tap does it).
      // The lamp waits for a click.
      if (hotspot.action === 'pet' && event.pointerType === 'mouse') onAction(hotspot.action)
    },
    onPointerLeave: () => onLeave(hotspot.id),
    onFocus: (event: FocusEvent<Element>) => {
      // Only light up for keyboard focus, not after a mouse click.
      if (event.currentTarget.matches(':focus-visible')) {
        onFocusChange(hotspot.id)
        if (hotspot.action === 'pet') onAction(hotspot.action)
      }
    },
    onBlur: () => {
      spaceDown.current = false
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

  const activate = () => onAction(hotspot.action!)
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
