import { DARK, DEF, url } from '../books/defs'

const SPECKS: [number, number, number][] = [
  [9, 20, 1.1],
  [31, 48, 0.8],
  [17, 66, 1.3],
  [36, 12, 0.7],
  [24, 37, 0.6],
]
const VEINS = [14, 27, 44, 61]

/** A travertine block doing the work of a bookend. */
function Bookend() {
  return (
    <svg viewBox="0 0 46 82">
      <rect x="0" y="0" width="46" height="82" rx="2.5" fill="oklch(0.83 0.03 78)" />
      <rect x="0" y="0" width="46" height="82" rx="2.5" filter={url(DEF.paper)} opacity={0.4} style={{ mixBlendMode: 'overlay' }} />
      {SPECKS.map(([x, y, r]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={r * 1.8} ry={r * 0.7} fill="oklch(0.6 0.035 70)" opacity={0.45} />
      ))}
      {VEINS.map((y, i) => (
        <path
          key={y}
          d={`M0 ${y} C 14 ${y + 1.6}, 30 ${y - 1.4}, 46 ${y + (i % 2 ? 1 : -0.6)}`}
          stroke="oklch(0.62 0.04 70)"
          strokeOpacity={0.45}
          strokeWidth={0.7}
          fill="none"
        />
      ))}
      <rect x="0" y="0" width="46" height="82" rx="2.5" fill={url(DEF.iron)} />
      <rect x="0.5" y="0.5" width="45" height="1.2" rx="0.6" fill="#fff8ec" opacity={0.5} />
      <rect x="0.4" y="0.4" width="45.2" height="81.2" rx="2.4" fill="none" stroke={DARK} strokeOpacity={0.22} strokeWidth={0.8} />
    </svg>
  )
}

/** Small things that live on the shelf. Decorative, never interactive. */
export function ShelfObjectArt() {
  return <Bookend />
}
