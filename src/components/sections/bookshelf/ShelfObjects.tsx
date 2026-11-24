import { OBJECT_SIZE } from '../../../content/bookGeometry'

/** A travertine block holding the books up: a photo of the stone, cut out. */
function Bookend() {
  const { w, h } = OBJECT_SIZE.bookend
  return (
    <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
      <image href="/media/books/travertine-bookend.webp" width={w} height={h} preserveAspectRatio="none" />
    </svg>
  )
}

/** Small things that live on the shelf. Decorative, never interactive. */
export function ShelfObjectArt() {
  return <Bookend />
}
