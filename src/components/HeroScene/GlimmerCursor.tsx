import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { HotspotAction } from '../../scene/hotspots'

/*
 * The glimmers' own cursors (src/scene/glimmers.ts): over the cat, a hand that strokes it;
 * over the lamp, a little bulb that flicks on now and then, with a small moonlight spark.
 * Drawn in the room's ink (cream, with a warm-brown line), so they belong to the painting
 * rather than to the operating system, and nothing like the plain pointer the section
 * objects keep. Only for a real mouse; touch and keyboard never see them.
 *
 * It follows the pointer outside React (a transform set on each move), so moving it never
 * re-renders anything. With reduced motion they stay still.
 */

/** Each cursor's size on screen, and the point of it that sits on the pointer (px). */
const SIZE = 40
const HOTSPOT: Record<HotspotAction, readonly [number, number]> = {
  pet: [20, 20], // the middle of the palm
  light: [20, 15], // the middle of the bulb
}

/** The pointer's last position, kept even while no hand shows, so one appears where the pointer is. */
const last = { x: -100, y: -100 }
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    (event) => {
      last.x = event.clientX
      last.y = event.clientY
    },
    { passive: true, capture: true },
  )
}

function PetHand() {
  return (
    <svg viewBox="0 0 48 48" width={SIZE} height={SIZE}>
      <g transform="rotate(-12 24 24)">
        <path
          className="glimmer-cursor__hand"
          d="M37.6 18.2C33.4 16.9 29.4 16.5 25.5 16.8L13.4 17.6A1.9 1.9 0 0 0 13 21.3L11.8 21.4A1.8 1.8 0 0 0 11.6 25L12.6 25.1A1.7 1.7 0 0 0 13.4 28.4L15.4 28.6A1.45 1.45 0 0 0 16.2 31.4L22.6 31.7C21.6 32.7 20.6 33.3 19.9 33.9A1.75 1.75 0 0 0 21.6 36.6C24.4 35.9 27.2 34.6 29.6 33.4C32.4 32.6 35.2 32 37.6 31.4C40.6 29.4 40.8 20.6 37.6 18.2Z"
        />
        <path className="glimmer-cursor__seam" d="M24.6 21.1L15.4 21.4M24.6 25L14.8 25.1M24.4 28.5L17.2 28.6" />
      </g>
    </svg>
  )
}

/** The lamp's: a little bulb, off, that flicks on (the `on` layer fades over it). */
function Bulb() {
  return (
    <svg viewBox="0 0 48 48" width={SIZE} height={SIZE}>
      <circle className="glimmer-cursor__glow" cx="24" cy="18" r="11.5" />
      <path className="glimmer-cursor__glass" d={GLASS} />
      <path className="glimmer-cursor__filament" d={FILAMENT} />
      <g className="glimmer-cursor__on">
        <path className="glimmer-cursor__glass glimmer-cursor__glass--on" d={GLASS} />
        <path className="glimmer-cursor__filament glimmer-cursor__filament--on" d={FILAMENT} />
      </g>
      <path
        className="glimmer-cursor__base"
        d="M19.2 28.8L28.8 28.8L28.8 34.4C28.8 36 27.6 37.2 26 37.2L22 37.2C20.4 37.2 19.2 36 19.2 34.4Z"
      />
      <path className="glimmer-cursor__seam" d="M19.4 31L28.6 31.8M19.4 33.4L28.6 34.2" />
      <path className="glimmer-cursor__tip" d="M22.4 37.4L25.6 37.4L24.8 39.6L23.2 39.6Z" />
      {/* a small moonlight spark, as it comes on */}
      <g className="glimmer-cursor__spark">
        <path d="M36.4 9.6L38.8 7.4M37.4 15.6L40.4 15.4M31.4 5.4L32.4 2.6" />
      </g>
    </svg>
  )
}

const GLASS =
  'M24 7.6C30.2 7.6 34 12 34 17C34 21 31.4 23.2 29.8 25.4C29 26.6 28.8 27.6 28.8 28.8L19.2 28.8C19.2 27.6 19 26.6 18.2 25.4C16.6 23.2 14 21 14 17C14 12 17.8 7.6 24 7.6Z'
const FILAMENT = 'M21.6 28.4L21.6 22.4L22.8 19.6L24 22L25.2 19.6L26.4 22.4L26.4 28.4'

interface GlimmerCursorProps {
  /** Which glimmer the mouse is over, or null (no hand: the ordinary cursor). */
  kind: HotspotAction | null
  /** The mouse button is down on it. */
  pressed: boolean
}

export function GlimmerCursor({ kind, pressed }: GlimmerCursorProps) {
  const el = useRef<HTMLDivElement>(null)

  // Before paint, so a hand never shows for a frame anywhere but under the pointer.
  useLayoutEffect(() => {
    const node = el.current
    if (!kind || !node) return
    const [hx, hy] = HOTSPOT[kind]
    let frame = 0
    const place = () => {
      frame = 0
      node.style.transform = `translate3d(${last.x - hx}px, ${last.y - hy}px, 0)`
    }
    place()
    const onMove = () => {
      if (!frame) frame = requestAnimationFrame(place)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [kind])

  if (!kind || typeof document === 'undefined') return null
  return createPortal(
    <div ref={el} className="glimmer-cursor" data-kind={kind} data-pressed={pressed ? '' : undefined} aria-hidden="true">
      <div className="glimmer-cursor__gesture">{kind === 'pet' ? <PetHand /> : <Bulb />}</div>
    </div>,
    document.body,
  )
}
