import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { Vinyl } from './Vinyl'

/** A beat after arrival before the arm swings over, so the motion reads as the needle going down. */
const ARM_DELAY_MS = 450

interface TurntableProps {
  /** The album cover, drawn on the label. */
  cover?: string
  /** Listening now: the arm swings onto the record and it turns at 33⅓ rpm. */
  playing: boolean
}

/**
 * The room's record player, seen from above: honey walnut plinth, black record,
 * the cover on the label. The tonearm alone tells "now" from "last played".
 */
export function Turntable({ cover, playing }: TurntableProps) {
  const reduced = usePrefersReducedMotion()
  const [armDown, setArmDown] = useState(false)

  useEffect(() => {
    if (!playing) {
      setArmDown(false)
      return
    }
    if (reduced) {
      setArmDown(true)
      return
    }
    const timer = window.setTimeout(() => setArmDown(true), ARM_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [playing, reduced])

  return (
    <span className="tt" aria-hidden="true" data-playing={armDown ? '' : undefined}>
      <span className="tt__platter">
        <span className="tt__record">
          <Vinyl cover={cover} />
        </span>
        <span className="vinyl__sheen" />
      </span>
      <svg className="tt__arm" viewBox="0 0 16 84" focusable="false">
        <rect x="4.5" y="-7" width="7" height="8" rx="1.5" fill="oklch(0.5 0.01 60)" />
        <circle cx="8" cy="8" r="6.5" fill="oklch(0.86 0.008 80)" />
        <circle cx="8" cy="8" r="3" fill="oklch(0.62 0.01 70)" />
        <path d="M8 10 L8 66 Q8 70 6 72" stroke="oklch(0.9 0.006 80)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <rect x="1.5" y="70" width="7" height="10" rx="1.4" transform="rotate(14 5 75)" fill="oklch(0.28 0.01 45)" />
      </svg>
      <span className="tt__knob" />
      <span className="tt__knob tt__knob--2" />
    </span>
  )
}
