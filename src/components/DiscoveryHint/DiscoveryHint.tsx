import { content } from '../../content/content'
import { dismissDiscoveryHint, useDiscoveryHintVisible } from '../../lib/discovery'
import './DiscoveryHint.css'

/**
 * A tiny first-visit cue that the room is interactive: a small glass chip with
 * a sparkle, "Explore the room · Hover or tap the objects", resting just inside
 * the room's bottom edge above the player. It fades in after the room settles,
 * and disappears for good after the first interaction with an object or when
 * dismissed.
 */
export function DiscoveryHint() {
  const visible = useDiscoveryHintVisible()
  if (!visible) return null
  const { title, hint, dismissLabel } = content.discovery
  return (
    <aside className="discovery-hint" aria-label={title}>
      <svg className="discovery-hint__spark" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M8 1.5c.4 3.3 2.9 5.8 6.2 6.2-3.3.4-5.8 2.9-6.2 6.2-.4-3.3-2.9-5.8-6.2-6.2C5.1 7.3 7.6 4.8 8 1.5Z" />
      </svg>
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
