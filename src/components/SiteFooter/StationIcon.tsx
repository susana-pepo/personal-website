import { useId } from 'react'
import type { StationId } from '../../audio/playlist'
import './StationIcon.css'

interface StationIconProps {
  station: StationId
  /** Moving while the station plays; when it stops, the icon holds where it was. */
  playing: boolean
}

/**
 * Each station's small animated drawing, in the site's cream line with one
 * touch of the spot colour:
 * - Lo-fi: headphones nodding gently to the beat, the sound pulsing beside each ear.
 * - Binaural: two waves, one per ear, a little apart in pitch, drifting in and out of step.
 * - Classical: a keyboard, its keys pressed in a slow arpeggio.
 */
export function StationIcon({ station, playing }: StationIconProps) {
  const id = useId()
  return (
    <svg
      className="station-icon"
      data-station={station}
      data-playing={playing ? '' : undefined}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      {station === 'lofi' && <Headphones />}
      {station === 'binaural' && <Waves maskId={`${id}-fade`} />}
      {station === 'classical' && <Keys />}
    </svg>
  )
}

function Headphones() {
  return (
    <>
      <g className="station-icon__bob">
        <path d="M8 18.5v-3a8 8 0 0 1 16 0v3" />
        <rect x={5.5} y={17.5} width={5} height={8.5} rx={2.2} />
        <rect x={21.5} y={17.5} width={5} height={8.5} rx={2.2} />
        <path className="station-icon__fine" d="M10.5 19.5v4.5M21.5 19.5v4.5" />
      </g>
      <path className="station-icon__beat" d="M3.2 19.8q-1.5 2.45 0 4.9" />
      <path className="station-icon__beat station-icon__beat--late station-icon__spot" d="M28.8 19.8q1.5 2.45 0 4.9" />
    </>
  )
}

/** A sine wave as smooth curves: period 12, amplitude 3, from x = -12 to 48 (wide enough to scroll). */
const WAVE = `M-12 16${' q3 -6 6 0 t6 0'.repeat(5)}`

function Waves({ maskId }: { maskId: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${maskId}-g`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.22" stopColor="#fff" />
          <stop offset="0.78" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
          <rect x="2" y="4" width="28" height="24" fill={`url(#${maskId}-g)`} />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <path className="station-icon__wave station-icon__wave--left" d={WAVE} />
        <path className="station-icon__wave station-icon__wave--right station-icon__spot" d={WAVE} />
      </g>
    </>
  )
}

/** Five white keys, 4.8 wide, from x = 4. */
const WHITE = [0, 1, 2, 3, 4].map((i) => 4 + i * 4.8)

function Keys() {
  return (
    <>
      {WHITE.map((x, i) => (
        <rect
          key={x}
          className="station-icon__press"
          style={{ animationDelay: `${i * 0.4}s` }}
          x={x + 0.9}
          y={18.2}
          width={3}
          height={4.6}
          rx={0.8}
        />
      ))}
      <rect x={4} y={8} width={24} height={16} rx={2.2} />
      <path className="station-icon__fine" d="M8.8 17v7M13.6 17v7M18.4 8v16M23.2 17v7" />
      <rect className="station-icon__black" x={7.6} y={8} width={2.4} height={9} rx={0.6} />
      <rect className="station-icon__black" x={12.4} y={8} width={2.4} height={9} rx={0.6} />
      <rect className="station-icon__black" x={22} y={8} width={2.4} height={9} rx={0.6} />
    </>
  )
}
