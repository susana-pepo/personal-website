import type { ReactNode } from 'react'
import { ShelfBoard } from '../books/ShelfBoard'
import { ShelfDefs } from '../books/ShelfDefs'
import './tablet.css'

/**
 * A tablet in landscape, drawn front-on: an aluminium edge, an even bezel with
 * a camera dot, and a screen that grows with its content. It rests in a small
 * walnut stand on the same board as the record crate and the desk pile.
 * Decorative parts are hidden from screen readers; the screen's content is not.
 */
export function TabletFrame({ children }: { children: ReactNode }) {
  return (
    <div className="pad">
      <ShelfDefs />
      <div className="pad__edge">
        <div className="pad__bezel">
          <span className="pad__camera" aria-hidden="true" />
          <div className="pad__screen">{children}</div>
        </div>
      </div>
      <span className="pad__stand" aria-hidden="true" />
      <ShelfBoard className="pad__board" />
    </div>
  )
}
