import { DARK, DEF, LAMP, url } from './defs'

/** The walnut board books stand or lie on. Needs <ShelfDefs /> on the page. */
export function ShelfBoard({ className = 'bs-board' }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <rect width="100%" height="5.5" fill="oklch(0.55 0.07 52)" />
      <rect y="5" width="100%" height="13" fill="oklch(0.42 0.06 50)" />
      <rect width="100%" height="18" filter={url(DEF.wood)} opacity={0.55} style={{ mixBlendMode: 'overlay' }} />
      <rect y="0" width="100%" height="2.4" fill={DARK} opacity={0.16} />
      <rect y="5" width="100%" height="0.9" fill={LAMP} opacity={0.28} />
      <rect y="17" width="100%" height="1" fill={DARK} opacity={0.32} />
      <rect width="100%" height="18" fill={url(DEF.boardLight)} />
    </svg>
  )
}
