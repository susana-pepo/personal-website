import { useId } from 'react'
import { safeId } from '../books/defs'

/** Fine dark speckles in the stoneware, scattered once (a fixed seed, so every visit draws the same mug). */
const SPECKS = (() => {
  let seed = 7
  const next = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  return Array.from({ length: 90 }, () => ({ x: 43 + next() * 70, y: 57 + next() * 92, r: 0.22 + next() * 0.38, o: 0.2 + next() * 0.35 }))
})()

/**
 * Susana's terracotta stoneware mug, drawn flat in the panels' style (like the record player
 * and the book spines): a speckled terracotta body, a foot of raw cream clay, a dark coffee
 * surface, its handle on the right, standing on a turned walnut coaster. The lamp is upper
 * right, so the light falls on the body's right side.
 *
 * The steam is three soft wisps that fade as they rise. `steam="rising"` lets them drift up
 * once (see .chat-mug in panel-sections.css); at rest they barely show.
 */
export function DrawnMug({ steam }: { steam: 'rest' | 'rising' }) {
  const id = safeId(useId())
  const body = `mug-body-${id}`
  const clay = `mug-clay-${id}`
  const rimShade = `mug-rim-shade-${id}`
  const wood = `mug-wood-${id}`
  const vapour = `mug-vapour-${id}`
  const clip = `mug-clip-${id}`
  const shadow = `mug-shadow-${id}`
  // Taller than it is wide, narrowing a little to the foot, with softly rounded bottom corners.
  const outline = 'M42 52 L114 52 L110.6 140 Q110.2 150 100.5 150 L55.5 150 Q45.8 150 45.4 140 Z'

  return (
    <svg className="chat-mug" data-steam={steam} viewBox="0 -20 160 186" aria-hidden="true" focusable="false">
      <defs>
        {/* Rounded by the lamp: in shade on the left, lit just right of centre, turning away at the edge. */}
        <linearGradient id={body} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="oklch(0.49 0.1 38)" />
          <stop offset="0.3" stopColor="oklch(0.56 0.115 40)" />
          <stop offset="0.66" stopColor="oklch(0.635 0.12 43)" />
          <stop offset="0.88" stopColor="oklch(0.6 0.118 42)" />
          <stop offset="1" stopColor="oklch(0.52 0.105 39)" />
        </linearGradient>
        <linearGradient id={clay} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="oklch(0.8 0.03 75)" />
          <stop offset="0.66" stopColor="oklch(0.91 0.025 82)" />
          <stop offset="1" stopColor="oklch(0.83 0.03 76)" />
        </linearGradient>
        {/* The lip's shadow just under the rim. */}
        <linearGradient id={rimShade} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="oklch(0.3 0.06 35)" stopOpacity="0.28" />
          <stop offset="1" stopColor="oklch(0.3 0.06 35)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={wood} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="oklch(0.46 0.07 50)" />
          <stop offset="0.65" stopColor="oklch(0.56 0.08 56)" />
          <stop offset="1" stopColor="oklch(0.49 0.072 52)" />
        </linearGradient>
        {/* Steam: warm grey at the cup, gone by the top. */}
        <linearGradient id={vapour} x1="0" x2="0" y1="46" y2="-18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="oklch(0.66 0.035 65)" stopOpacity="0" />
          <stop offset="0.16" stopColor="oklch(0.66 0.035 65)" stopOpacity="0.6" />
          <stop offset="0.55" stopColor="oklch(0.7 0.03 68)" stopOpacity="0.35" />
          <stop offset="1" stopColor="oklch(0.72 0.03 70)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={shadow}>
          <stop offset="0" stopColor="oklch(0.22 0.04 45)" stopOpacity="0.5" />
          <stop offset="1" stopColor="oklch(0.22 0.04 45)" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clip}>
          <path d={outline} />
        </clipPath>
      </defs>

      {/* The steam: three soft wisps rising from the cup. */}
      <g className="chat-mug__steam" fill="none" stroke={`url(#${vapour})`} strokeLinecap="round">
        <path d="M66 44 C61 34 70 26 66 15 C63 7 67 1 65 -5" strokeWidth="2.2" />
        <path d="M79 42 C73 30 86 20 79 6 C75 -3 80 -10 78 -16" strokeWidth="2.8" />
        <path d="M92 44 C88 35 97 28 92 18 C89 12 93 7 91 2" strokeWidth="2.2" />
      </g>

      {/* The turned walnut coaster: its front edge, then its top, with a ring from the lathe. */}
      <ellipse cx="78" cy="156.4" rx="47" ry="8" fill="oklch(0.36 0.055 45)" />
      <ellipse cx="78" cy="152.4" rx="47" ry="8" fill={`url(#${wood})`} />
      <ellipse cx="78" cy="152.4" rx="39.5" ry="6.1" fill="none" stroke="oklch(0.6 0.07 56)" strokeOpacity="0.25" strokeWidth="0.7" />
      <path d="M100 159.7 Q118 158 124.6 154" fill="none" stroke="oklch(0.66 0.08 60)" strokeOpacity="0.45" strokeWidth="0.9" strokeLinecap="round" />
      {/* the mug's shadow on it */}
      <ellipse cx="80" cy="150.6" rx="36" ry="4.4" fill={`url(#${shadow})`} />

      {/* The handle: a thick loop of clay, joined to the body's right side. */}
      <path
        d="M112.5 68 C133 64 142 80 139 98 C136.5 113 125 121 111 119 L111.4 110 C121 111 128 105 129.8 96.5 C131.8 86 126.5 77 112.8 78 Z"
        fill="oklch(0.55 0.112 41)"
      />
      <path d="M116 70.6 C130 69 137.6 80 136.2 94" fill="none" stroke="oklch(0.7 0.11 48)" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />

      {/* The body, its raw clay foot and its speckles. */}
      <path d={outline} fill={`url(#${body})`} />
      <g clipPath={`url(#${clip})`}>
        <rect x="38" y="52" width="80" height="11" fill={`url(#${rimShade})`} />
        {SPECKS.map((s, i) => (
          <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} fill="oklch(0.32 0.05 35)" opacity={s.o.toFixed(2)} />
        ))}
        {/* the foot was left unglazed: its edge wanders a little, as a dipped glaze does */}
        <path d="M36 137.6 C44 135.4 52 136.2 58 138.4 C64 140.4 72 139.8 79 137.6 C86 135.6 93 136 99 138.2 C104 139.8 110 139.4 120 136.6 L120 152 L36 152 Z" fill={`url(#${clay})`} />
        <path d="M36 137.6 C44 135.4 52 136.2 58 138.4 C64 140.4 72 139.8 79 137.6 C86 135.6 93 136 99 138.2 C104 139.8 110 139.4 120 136.6" fill="none" stroke="oklch(0.42 0.08 36)" strokeOpacity="0.22" strokeWidth="0.7" />
      </g>

      {/* The rim, the inside of the cup, and the coffee with a little light on it. */}
      <ellipse cx="78" cy="52" rx="36" ry="6.6" fill="oklch(0.66 0.1 45)" />
      <ellipse cx="78" cy="52.5" rx="33.4" ry="5.3" fill="oklch(0.44 0.09 38)" />
      <ellipse cx="78" cy="53.3" rx="32.2" ry="4.5" fill="oklch(0.24 0.035 40)" />
      <ellipse cx="85" cy="52.7" rx="12" ry="1.3" fill="oklch(0.5 0.05 55)" opacity="0.5" />
    </svg>
  )
}
