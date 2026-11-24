import { DARK, DEF, LAMP } from './defs'

/**
 * Shared SVG definitions: textures, light and foil. Every book on the shelf
 * refers to these, so they are rendered once at the top of the section.
 */
export function ShelfDefs() {
  return (
    <svg className="bs-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {/* Bookcloth: warp and weft as two stretched noise fields. */}
        <filter id={DEF.cloth} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.3 0.09" numOctaves={2} seed={2} result="a" />
          <feTurbulence type="fractalNoise" baseFrequency="0.09 1.3" numOctaves={2} seed={5} result="b" />
          <feComposite in="a" in2="b" operator="arithmetic" k2={0.5} k3={0.5} result="m" />
          <feColorMatrix in="m" type="matrix" values="2.4 0 0 0 -0.7  2.4 0 0 0 -0.7  2.4 0 0 0 -0.7  0 0 0 0 1" />
        </filter>
        {/* Paper: fine, even tooth. */}
        <filter id={DEF.paper} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={3} seed={9} result="n" />
          <feColorMatrix in="n" type="matrix" values="1.8 0 0 0 -0.4  1.8 0 0 0 -0.4  1.8 0 0 0 -0.4  0 0 0 0 1" />
        </filter>
        {/* Leather: a loose pebbled grain. */}
        <filter id={DEF.leather} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feTurbulence type="turbulence" baseFrequency="0.22" numOctaves={3} seed={4} result="n" />
          <feColorMatrix in="n" type="matrix" values="-1.6 0 0 0 1.25  -1.6 0 0 0 1.25  -1.6 0 0 0 1.25  0 0 0 0 1" />
        </filter>
        {/* Walnut: long grain along the board. */}
        <filter id={DEF.wood} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.0045 0.32" numOctaves={3} seed={12} result="n" />
          <feColorMatrix in="n" type="matrix" values="2.6 0 0 0 -0.8  2.6 0 0 0 -0.8  2.6 0 0 0 -0.8  0 0 0 0 1" />
        </filter>
        {/* Rubbed edges at head and tail: noise thresholded into a ragged mask. */}
        <filter id={DEF.wear} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.85 0.5" numOctaves={2} seed={11} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 9 -4.1" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" />
        </filter>
        {/* Lettering pressed into the cover: shadow above, catch-light below. */}
        <filter id={DEF.stamp} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feOffset in="SourceAlpha" dx={-0.25} dy={-0.45} result="up" />
          <feFlood floodColor="#1a120d" floodOpacity={0.55} />
          <feComposite in2="up" operator="in" result="dark" />
          <feOffset in="SourceAlpha" dx={0.2} dy={0.55} result="dn" />
          <feFlood floodColor="#fff6e8" floodOpacity={0.2} />
          <feComposite in2="dn" operator="in" result="lite" />
          <feMerge>
            <feMergeNode in="dark" />
            <feMergeNode in="lite" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gold foil, lit from above. */}
        <linearGradient id={DEF.gilt} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.88 0.085 88)" />
          <stop offset="0.45" stopColor="oklch(0.74 0.1 78)" />
          <stop offset="0.7" stopColor="oklch(0.84 0.09 86)" />
          <stop offset="1" stopColor="oklch(0.66 0.09 72)" />
        </linearGradient>
        {/* A rounded spine catching the lamp on its right shoulder. */}
        <linearGradient id={DEF.round} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={DARK} stopOpacity={0.4} />
          <stop offset="0.16" stopColor={DARK} stopOpacity={0.1} />
          <stop offset="0.5" stopColor={LAMP} stopOpacity={0} />
          <stop offset="0.74" stopColor={LAMP} stopOpacity={0.17} />
          <stop offset="0.92" stopColor={DARK} stopOpacity={0.08} />
          <stop offset="1" stopColor={DARK} stopOpacity={0.4} />
        </linearGradient>
        {/* A flat paperback spine. */}
        <linearGradient id={DEF.flat} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={DARK} stopOpacity={0.26} />
          <stop offset="0.1" stopColor={DARK} stopOpacity={0.04} />
          <stop offset="0.8" stopColor={LAMP} stopOpacity={0.08} />
          <stop offset="0.93" stopColor={DARK} stopOpacity={0} />
          <stop offset="1" stopColor={DARK} stopOpacity={0.28} />
        </linearGradient>
        {/* Sun-fade along the top of an old spine. */}
        <linearGradient id={DEF.fade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={LAMP} stopOpacity={0.2} />
          <stop offset="0.35" stopColor={LAMP} stopOpacity={0} />
        </linearGradient>
        {/* Lamp on a face-out cover. */}
        <radialGradient id={DEF.coverLight} cx="0.9" cy="0.02" r="1.15">
          <stop offset="0" stopColor={LAMP} stopOpacity={0.2} />
          <stop offset="0.5" stopColor={LAMP} stopOpacity={0} />
          <stop offset="1" stopColor={DARK} stopOpacity={0.22} />
        </radialGradient>
        <linearGradient id={DEF.boardLight} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={DARK} stopOpacity={0.2} />
          <stop offset="0.5" stopColor={LAMP} stopOpacity={0} />
          <stop offset="1" stopColor={LAMP} stopOpacity={0.14} />
        </linearGradient>
        <linearGradient id={DEF.iron} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={DARK} stopOpacity={0.3} />
          <stop offset="0.6" stopColor={LAMP} stopOpacity={0.03} />
          <stop offset="1" stopColor={LAMP} stopOpacity={0.2} />
        </linearGradient>
      </defs>
    </svg>
  )
}
