/** A box relative to some container, in px. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export function boxIn(container: Element, rect: DOMRect): Box {
  const c = container.getBoundingClientRect()
  return { x: rect.left - c.left, y: rect.top - c.top, w: rect.width, h: rect.height }
}

/** Must match --ease-drawer in tokens.css. */
const EASE_DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)'

/**
 * Fly a copy of a sleeve between two places with the Web Animations API.
 *
 * The copy is appended inside `container` (which lives in the panel's <dialog>,
 * in the top layer) and positioned relative to it, so it scrolls with the panel
 * instead of drifting if the panel scrolls mid-flight.
 */
export function flySleeve(container: HTMLElement, source: Element, from: Box, to: Box, duration: number): Promise<void> {
  const copy = document.createElement('div')
  copy.className = 'flight'
  copy.setAttribute('aria-hidden', 'true')
  for (const child of Array.from(source.children)) copy.appendChild(child.cloneNode(true))
  Object.assign(copy.style, { left: `${to.x}px`, top: `${to.y}px`, width: `${to.w}px`, height: `${to.h}px` })
  container.appendChild(copy)
  const scale = to.w > 0 ? from.w / to.w : 1
  const animation = copy.animate(
    [{ transform: `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(${scale})` }, { transform: 'none' }],
    { duration, easing: EASE_DRAWER },
  )
  return animation.finished.then(
    () => copy.remove(),
    () => copy.remove(),
  )
}

export const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))
