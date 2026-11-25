import type { ReactNode } from 'react'
import './tablet.css'

/**
 * A tablet in landscape, drawn front-on: an aluminium edge, an even bezel with
 * a camera dot, and a screen of one shape (its content scrolls inside it). It
 * stands alone, with no stand or board under it. The camera dot is hidden from
 * screen readers; the screen's content is not.
 */
export function TabletFrame({ children }: { children: ReactNode }) {
  return (
    <div className="pad">
      <div className="pad__edge">
        <div className="pad__bezel">
          <span className="pad__camera" aria-hidden="true" />
          <div className="pad__screen">{children}</div>
        </div>
      </div>
    </div>
  )
}
