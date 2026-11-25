import type { ReactNode } from 'react'

/** Printed cover art: a real image, drawn sample art, or a blank card-shade face. */
export function CoverArt({ cover, art, size = 300 }: { cover?: string; art?: ReactNode; size?: number }) {
  if (art) return <>{art}</>
  if (cover) return <img src={cover} alt="" width={size} height={size} loading="lazy" decoding="async" draggable={false} />
  return null
}

/**
 * A black record with the cover printed on its label. With no art, the label
 * is the vermilion one from the painting.
 */
export function Vinyl({ cover, art }: { cover?: string; art?: ReactNode }) {
  return (
    <>
      <span className="vinyl__face" />
      <span className="vinyl__label">
        <CoverArt cover={cover} art={art} size={120} />
      </span>
    </>
  )
}
