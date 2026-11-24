import { useLayoutEffect, useRef, useState } from 'react'
import { content } from '../../content/content'
import { dismissDiscoveryHint, useDiscoveryHintVisible } from '../../lib/discovery'
import './DiscoveryHint.css'

/** The exit fade in DiscoveryHint.css; the chip is removed when it ends. */
const EXIT_ANIMATION = 'hint-out-fade'
/** A backup in case the exit never reports its end (200ms, or 120ms with reduced motion). */
const EXIT_BACKUP_MS = 400

/**
 * A tiny first-visit cue that the room is interactive: a small glass chip with
 * "Explore the room · Hover or tap the objects", resting just inside
 * the room's bottom edge above the player. It fades in after the room settles,
 * and disappears for good after the first interaction with an object or when
 * dismissed: it fades and drops away, and only then leaves the page.
 */
export function DiscoveryHint() {
  const visible = useDiscoveryHintVisible()
  const ref = useRef<HTMLElement>(null)
  // The store drops the chip at once, so it stays mounted here until its exit has played.
  // Dismissal only goes one way: a chip that was never shown has nothing to play out.
  const [present, setPresent] = useState(visible)
  if (visible && !present) setPresent(true)
  const leaving = present && !visible

  useLayoutEffect(() => {
    const node = ref.current
    if (!leaving || !node) return
    // Start the fade from where the arrival had got to (opacity 0 if it was still waiting),
    // read before the exit replaces the arrival, so an unseen chip doesn't flash in to leave.
    node.style.setProperty('--hint-from', getComputedStyle(node).opacity)
    node.inert = true
    node.setAttribute('data-leaving', '')
    const finish = () => setPresent(false)
    const onEnd = (event: AnimationEvent) => {
      // animations inside the chip bubble up here too
      if (event.target === node && event.animationName === EXIT_ANIMATION) finish()
    }
    node.addEventListener('animationend', onEnd)
    const backup = window.setTimeout(finish, EXIT_BACKUP_MS)
    return () => {
      node.removeEventListener('animationend', onEnd)
      window.clearTimeout(backup)
    }
  }, [leaving])

  if (!present) return null
  const { title, hint, dismissLabel } = content.discovery
  return (
    <aside ref={ref} className="discovery-hint" aria-label={title}>
      <p className="discovery-hint__title">{title}</p>
      <p className="discovery-hint__text">{hint}</p>
      <button
        type="button"
        className="discovery-hint__dismiss"
        aria-label={dismissLabel}
        onClick={() => {
          // Keep keyboard focus somewhere sensible once the hint is gone.
          document.getElementById('main')?.focus({ preventScroll: true })
          dismissDiscoveryHint()
        }}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </aside>
  )
}
