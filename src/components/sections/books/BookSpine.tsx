import { useId, type ReactNode } from 'react'
import { clamp, lerp, PALETTE, spineName, type BookSpec } from '../../../content/bookGeometry'
import type { Book } from '../../../content/types'
import { FitText } from './Lettering'
import { DARK, DEF, LAMP, r2, safeId, url, WORN } from './defs'

interface VerticalProps {
  text: string
  /** Display face for titles, sans for names. */
  display: boolean
  x: number
  cy: number
  fs: number
  fill: string
  max: number
  opacity?: number
}

/** Lettering that runs down the spine, top to bottom. */
function Vertical({ text, display, x, cy, fs, fill, max, opacity = 1 }: VerticalProps) {
  return (
    <FitText
      text={text}
      className={display ? 'bs-t-d' : 'bs-t-s'}
      transform={`translate(${r2(x)} ${r2(cy)}) rotate(90)`}
      textAnchor="middle"
      dy="0.34em"
      fontSize={r2(fs)}
      fill={fill}
      opacity={opacity}
      max={max}
      optional={!display}
    />
  )
}

/** Rough width of a letter in the display face, as a share of the font size. */
const GLYPH = 0.5

/** Splits a title into two lines of about the same length, at a word break. */
function halves(text: string): [string, string] | null {
  const words = text.split(' ')
  if (words.length < 2) return null
  let best: [string, string] | null = null
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    if (!best || Math.max(a.length, b.length) < Math.max(best[0].length, best[1].length)) best = [a, b]
  }
  return best
}

/**
 * A real book's title, as large as the spine allows: one line when it reads at a good
 * size, otherwise two lines side by side, as long titles are printed on real spines.
 */
function SpineTitle({ text, w, y0, y1, fill }: { text: string; w: number; y0: number; y1: number; fill: string }) {
  const cx = w / 2
  const len = y1 - y0
  const one = clamp(Math.min(w * 0.42, len / (text.length * GLYPH)), 0, 13)
  const split = one < 8.5 ? halves(text) : null
  if (!split || w < 20) {
    return <Vertical text={text} display x={cx} cy={(y0 + y1) / 2} fs={clamp(w * 0.42, 8.5, 13)} fill={fill} max={len} />
  }
  const fs = clamp(Math.min(w * 0.36, len / (Math.max(split[0].length, split[1].length) * GLYPH)), 6, 11)
  const gap = fs * 0.6
  // Turned to read top to bottom, a line's top faces right, so the first line sits on the right.
  return (
    <>
      <Vertical text={split[0]} display x={cx + gap} cy={(y0 + y1) / 2} fs={fs} fill={fill} max={len} />
      <Vertical text={split[1]} display x={cx - gap} cy={(y0 + y1) / 2} fs={fs} fill={fill} max={len} />
    </>
  )
}

interface BookSpineProps {
  book: Book
  spec: BookSpec
  /** Drawing size in book units; defaults to the book's own thickness and height. */
  w?: number
  h?: number
}

/** A spine drawn from data: binding, lettering, texture, light and wear. */
export function BookSpine({ book, spec: s, w = s.thick, h = s.height }: BookSpineProps) {
  const clipId = `bs-clip-${safeId(useId())}`
  const hard = s.kind !== 'paperback'
  const cap = hard ? 1.8 : 0.5
  const shape = `M0 ${cap} Q${w / 2} ${-cap * 0.55} ${w} ${cap} L${w} ${h - cap} Q${w / 2} ${h + cap * 0.55} 0 ${h - cap} Z`
  const foil = hard && !s.light
  const ink = foil ? url(DEF.gilt) : s.col.t
  const titleFs = clamp(w * 0.36, 8.5, 14.5)
  const authorFs = clamp(w * 0.22, 6.4, 9)
  const cx = w / 2
  const who = spineName(book)
  const gilt = url(DEF.gilt)

  let deco: ReactNode = null
  let letters: ReactNode = null

  if (s.kind === 'cloth') {
    if (s.variant === 0) {
      // Double gilt rules at head and tail.
      deco = [9, 12.4, h - 12.4, h - 9].map((y) => <rect key={y} x={2.2} y={y} width={w - 4.4} height={0.75} fill={ink} opacity={0.9} />)
      letters = (
        <>
          <Vertical text={book.title} display x={cx} cy={lerp(18, h * 0.64, 0.5)} fs={titleFs} fill={ink} max={h * 0.64 - 22} />
          <Vertical text={who} display={false} x={cx} cy={lerp(h * 0.67, h - 16, 0.5)} fs={authorFs} fill={ink} max={h * 0.33 - 20} opacity={0.92} />
        </>
      )
    } else if (s.variant === 1) {
      // A dark lettering piece with a gilt fillet.
      const y0 = h * 0.1
      const y1 = h * 0.64
      deco = (
        <>
          <rect x={2.6} y={y0} width={w - 5.2} height={y1 - y0} rx={0.6} fill={DARK} opacity={s.light ? 0.82 : 0.34} />
          <rect x={3.8} y={y0 + 1.6} width={w - 7.6} height={y1 - y0 - 3.2} fill="none" stroke={gilt} strokeWidth={0.55} />
          <circle cx={cx} cy={h - 12} r={Math.min(2.4, w * 0.08)} fill="none" stroke={ink} strokeWidth={0.7} />
        </>
      )
      letters = (
        <>
          <Vertical text={book.title} display x={cx} cy={(y0 + y1) / 2} fs={titleFs * 0.94} fill={gilt} max={y1 - y0 - 10} />
          <Vertical text={who} display={false} x={cx} cy={lerp(h * 0.68, h - 20, 0.5)} fs={authorFs} fill={ink} max={h * 0.32 - 24} />
        </>
      )
    } else {
      // Blind-stamped title, gilt author.
      deco = (
        <>
          <rect x={2.2} y={7} width={w - 4.4} height={0.7} fill={DARK} opacity={0.28} />
          <rect x={2.2} y={h - 7.7} width={w - 4.4} height={0.7} fill={DARK} opacity={0.28} />
        </>
      )
      letters = (
        <>
          <Vertical text={book.title} display x={cx} cy={lerp(14, h * 0.74, 0.5)} fs={titleFs * 1.05} fill={DARK} max={h * 0.74 - 18} opacity={0.24} />
          <Vertical text={who} display={false} x={cx} cy={lerp(h * 0.77, h - 12, 0.5)} fs={authorFs} fill={ink} max={h * 0.23 - 16} />
        </>
      )
    }
  } else if (s.kind === 'leather') {
    // Raised bands with gilt fillets, a contrasting label.
    const bands = [0.09, 0.64, 0.92].map((f) => h * f)
    const label = s.colour === 'oxblood' ? PALETTE.ink.c : PALETTE.oxblood.c
    deco = (
      <>
        <rect x={1.6} y={h * 0.13} width={w - 3.2} height={h * 0.47} rx={0.5} fill={label} />
        <rect x={2.8} y={h * 0.13 + 1.4} width={w - 5.6} height={h * 0.47 - 2.8} fill="none" stroke={gilt} strokeWidth={0.5} />
        {bands.map((y) => (
          <g key={y}>
            <rect x={0} y={y - 2} width={w} height={4} fill={DARK} opacity={0.28} />
            <rect x={0} y={y - 2} width={w} height={1.1} fill={LAMP} opacity={0.2} />
            <rect x={0} y={y - 3.6} width={w} height={0.5} fill={gilt} />
            <rect x={0} y={y + 3.1} width={w} height={0.5} fill={gilt} />
          </g>
        ))}
      </>
    )
    letters = (
      <>
        <Vertical text={book.title} display x={cx} cy={h * (0.13 + 0.235)} fs={titleFs * 0.92} fill={gilt} max={h * 0.47 - 10} />
        <Vertical text={who} display={false} x={cx} cy={(bands[1]! + bands[2]!) / 2} fs={authorFs * 0.92} fill={gilt} max={bands[2]! - bands[1]! - 12} />
      </>
    )
  } else if (book.spineColour) {
    // A real book: its own colour, the full title and the author, and no invented bands.
    const split = h * 0.74
    letters = (
      <>
        <SpineTitle text={book.title} w={w} y0={8} y1={split} fill={s.col.t} />
        <Vertical text={who} display={false} x={cx} cy={lerp(split + 4, h - 7, 0.5)} fs={clamp(w * 0.26, 7, 9.5)} fill={s.col.t} max={h - split - 13} opacity={0.85} />
      </>
    )
  } else if (s.kind === 'jacket') {
    if (s.variant !== 1) {
      const y0 = h * 0.78
      deco = (
        <>
          <rect x={0} y={y0} width={w} height={h - y0} fill={s.alt.c} />
          <circle cx={cx} cy={h - 9} r={Math.min(3, w * 0.1)} fill={s.alt.t} opacity={0.9} />
        </>
      )
      letters = (
        <>
          <Vertical text={book.title} display x={cx} cy={lerp(12, h * 0.52, 0.5)} fs={titleFs * 1.02} fill={s.col.t} max={h * 0.52 - 16} />
          <Vertical text={who} display={false} x={cx} cy={lerp(h * 0.54, h * 0.77, 0.5)} fs={authorFs} fill={s.col.t} max={h * 0.23 - 6} opacity={0.85} />
        </>
      )
    } else {
      deco = (
        <>
          <rect x={0} y={h * 0.06} width={w} height={2.2} fill={s.alt.c} />
          <rect x={cx - 2.5} y={h - 11} width={5} height={5} fill={s.col.t} opacity={0.7} />
        </>
      )
      letters = (
        <>
          <Vertical text={who} display={false} x={cx} cy={lerp(h * 0.1, h * 0.3, 0.5)} fs={authorFs} fill={s.col.t} max={h * 0.2 - 4} opacity={0.85} />
          <Vertical text={book.title} display x={cx} cy={lerp(h * 0.33, h - 16, 0.5)} fs={titleFs * 1.02} fill={s.col.t} max={h * 0.67 - 22} />
        </>
      )
    }
  } else {
    // Paperback: a series band at the head, printed title, reading creases.
    const band = h * 0.15
    deco = (
      <>
        <rect x={0} y={0} width={w} height={band} fill={s.alt.c} />
        <circle cx={cx} cy={band / 2} r={Math.min(3.6, w * 0.17)} fill="none" stroke={s.alt.t} strokeWidth={0.8} />
      </>
    )
    letters = (
      <>
        <Vertical text={book.title} display x={cx} cy={lerp(band + 6, h * 0.68, 0.5)} fs={titleFs * 0.98} fill={s.col.t} max={h * 0.68 - band - 10} />
        <Vertical text={who} display={false} x={cx} cy={lerp(h * 0.7, h - 6, 0.5)} fs={authorFs} fill={s.col.t} max={h * 0.3 - 10} opacity={0.8} />
      </>
    )
  }

  const tex = s.kind === 'cloth' ? DEF.cloth : s.kind === 'leather' ? DEF.leather : DEF.paper
  const texOpacity = s.kind === 'cloth' ? 0.46 : s.kind === 'leather' ? 0.4 : 0.3
  const wearA = 0.18 + s.wear * 0.4

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}>
          <path d={shape} />
        </clipPath>
      </defs>
      <g clipPath={url(clipId)}>
        <rect width={w} height={h} fill={s.col.c} />
        <rect width={w} height={h} filter={url(tex)} opacity={texOpacity} style={{ mixBlendMode: 'overlay' }} />
        {deco}
        <g filter={foil || s.kind === 'cloth' ? url(DEF.stamp) : undefined}>{letters}</g>
        {s.creases.map(([fx, j], i) => {
          const x = w * fx
          const y0 = h * (0.18 + j * 0.15)
          const y1 = h * (0.6 + j * 0.3)
          return (
            <path
              key={i}
              d={`M${r2(x)} ${r2(y0)} C ${r2(x + 0.8)} ${r2(lerp(y0, y1, 0.3))}, ${r2(x - 0.7)} ${r2(lerp(y0, y1, 0.6))}, ${r2(x + 0.3)} ${r2(y1)}`}
              stroke="#fff8ec"
              strokeOpacity={0.32}
              strokeWidth={0.55}
              fill="none"
            />
          )
        })}
        <rect width={w} height={h} fill={url(hard ? DEF.round : DEF.flat)} />
        {s.faded && <rect width={w} height={h} fill={url(DEF.fade)} />}
        <rect x={0} y={0} width={w} height={3.2} fill={WORN} opacity={r2(wearA)} filter={url(DEF.wear)} />
        <rect x={0} y={h - 3} width={w} height={3} fill={WORN} opacity={r2(wearA * 0.8)} filter={url(DEF.wear)} />
      </g>
      <rect className="bs-shade" width={w} height={h} fill={DARK} />
      <path d={shape} fill="none" stroke={DARK} strokeOpacity={0.32} strokeWidth={0.6} />
    </svg>
  )
}
