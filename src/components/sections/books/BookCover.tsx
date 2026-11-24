import { wrapWords, type BookSpec } from '../../../content/bookGeometry'
import type { Book } from '../../../content/types'
import { FitText } from './Lettering'
import { DARK, DEF, LAMP, r2, url, WORN } from './defs'

const W = 200
const H = 300

/** The printed picture on a jacket or paperback, drawn in the book's second colour. */
function Motif({ s }: { s: BookSpec }) {
  const a = s.alt.c
  switch (s.motif) {
    case 'sun':
      return <circle cx={W * 0.62} cy={H * 0.66} r={W * 0.22} fill={a} />
    case 'horizon':
      return (
        <>
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={18} y={H * 0.6 + i * 13} width={W - 36} height={6.5 - i} fill={a} />
          ))}
        </>
      )
    case 'arc':
      return <path d={`M${W - 18} ${H - 40} L${W - 18} ${H * 0.52} A ${W * 0.56} ${W * 0.56} 0 0 0 ${W * 0.35} ${H - 40} Z`} fill={a} />
    case 'grid':
      return (
        <>
          {Array.from({ length: 24 }, (_, k) => (
            <circle key={k} cx={30 + Math.floor(k / 4) * 28} cy={H * 0.58 + (k % 4) * 22} r={3.4} fill={a} />
          ))}
        </>
      )
    case 'band':
      return <rect x={0} y={H * 0.56} width={W} height={H * 0.2} fill={a} />
    default:
      return (
        <>
          <rect x={36} y={H * 0.56} width={W * 0.44} height={H * 0.18} fill={a} />
          <rect x={62} y={H * 0.62} width={W * 0.44} height={H * 0.18} fill={s.col.t} opacity={0.22} />
          <rect x={88} y={H * 0.68} width={W * 0.44} height={H * 0.18} fill={a} opacity={0.65} />
        </>
      )
  }
}

/** The front cover, for a book standing face out and for the book in the detail. */
export function BookCover({ book, spec: s }: { book: Book; spec: BookSpec }) {
  const hard = s.kind !== 'paperback'
  const rx = hard ? 2.5 : 1
  const tex = s.kind === 'cloth' ? DEF.cloth : s.kind === 'leather' ? DEF.leather : DEF.paper
  const wearA = 0.2 + s.wear * 0.35
  let art

  if (s.kind === 'cloth' || s.kind === 'leather') {
    const foil = s.light ? s.col.t : url(DEF.gilt)
    const lines = wrapWords(book.title, 14)
    const top = 96 - (lines.length - 1) * 11
    art = (
      <>
        <rect x={16} y={16} width={W - 32} height={H - 32} fill="none" stroke={DARK} strokeOpacity={0.3} strokeWidth={1.4} filter={url(DEF.stamp)} />
        {s.kind === 'leather' && <rect x={22} y={22} width={W - 44} height={H - 44} fill="none" stroke={url(DEF.gilt)} strokeWidth={0.8} />}
        <g filter={url(DEF.stamp)}>
          {lines.map((line, i) => (
            <FitText key={i} text={line} className="bs-t-d" x={W / 2} y={top + i * 23} textAnchor="middle" fontSize={19} fill={foil} max={W - 56} />
          ))}
          <circle cx={W / 2} cy={top + lines.length * 23 + 18} r={4.5} fill="none" stroke={foil} strokeWidth={1} />
          <FitText text={book.author} className="bs-t-s" x={W / 2} y={H - 58} textAnchor="middle" fontSize={11.5} fill={foil} max={W - 60} />
        </g>
      </>
    )
  } else {
    const paperback = s.kind === 'paperback'
    const lines = wrapWords(book.title, 12)
    const y0 = paperback ? 72 : 52
    const authorOnBand = s.motif === 'band'
    art = (
      <>
        {paperback && (
          <>
            <rect x={0} y={0} width={W} height={34} fill={s.alt.c} />
            <circle cx={W - 24} cy={17} r={7} fill="none" stroke={s.alt.t} strokeWidth={1.3} />
          </>
        )}
        <Motif s={s} />
        {lines.map((line, i) => (
          <FitText key={i} text={line} className="bs-t-d" x={20} y={y0 + i * 27} fontSize={26} fill={s.col.t} max={W - 36} style={{ letterSpacing: '-0.02em' }} />
        ))}
        <FitText
          text={book.author}
          className="bs-t-s"
          x={20}
          y={authorOnBand ? H * 0.66 + 4 : H - 22}
          fontSize={12.5}
          fill={authorOnBand ? s.alt.t : s.col.t}
          opacity={0.88}
          max={W - 40}
        />
      </>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      <rect width={W} height={H} rx={rx} fill={s.col.c} />
      <rect width={W} height={H} rx={rx} filter={url(tex)} opacity={s.kind === 'cloth' ? 0.38 : 0.26} style={{ mixBlendMode: 'overlay' }} />
      {art}
      {hard ? (
        <>
          <rect x={9} y={0} width={1.4} height={H} fill={DARK} opacity={0.26} />
          <rect x={10.6} y={0} width={0.9} height={H} fill={LAMP} opacity={0.16} />
        </>
      ) : (
        <rect x={7} y={0} width={0.8} height={H} fill={DARK} opacity={0.12} />
      )}
      <rect width={W} height={H} rx={rx} fill={url(DEF.coverLight)} />
      <rect x={0} y={0} width={W} height={3} fill={WORN} opacity={r2(wearA)} filter={url(DEF.wear)} />
      <rect x={W - 3} y={0} width={3} height={H} fill={WORN} opacity={r2(wearA * 0.7)} filter={url(DEF.wear)} />
      <rect className="bs-shade" width={W} height={H} fill={DARK} />
      <rect x={0.4} y={0.4} width={W - 0.8} height={H - 0.8} rx={rx} fill="none" stroke={DARK} strokeOpacity={0.3} strokeWidth={0.8} />
    </svg>
  )
}
