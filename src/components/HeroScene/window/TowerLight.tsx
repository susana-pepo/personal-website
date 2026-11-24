import { pctX, pctY } from '../../../scene/layout'
import { TIMES, WINDOW_VIEWS, type TimeOfDay } from '../../../scene/windowViews'

/** The lower light pulses out of step with the top one, as on the real tower. */
const DELAYS = [0, 1.6]

interface TowerLightProps {
  /** Whose view is in the window: each view has its own tower, framed a little differently. */
  time: TimeOfDay
  motionAllowed: boolean
}

/**
 * The Berlin TV tower's red aviation lights, in the window: a soft red light
 * pulsing slowly at the top, with a fainter one lower on the mast, out of step.
 * Each time of day has its own set (found in its view; only a faint one by day),
 * cross-fading with the view. Still (softly lit) with reduced motion or a paused
 * room. Decorative only.
 */
export function TowerLight({ time, motionAllowed }: TowerLightProps) {
  return (
    <span className="tower-light" aria-hidden="true" data-still={motionAllowed ? undefined : ''}>
      {TIMES.map((t) => (
        <span key={t} className="tower-light__set" data-on={t === time ? '' : undefined}>
          {WINDOW_VIEWS[t].towerLights.map((light, i) => (
            <span
              key={`${light.x}-${light.y}`}
              className="tower-light__dot"
              style={{
                left: pctX(light.x),
                top: pctY(light.y),
                width: pctX(light.size),
                animationDelay: `${DELAYS[i] ?? 0}s`,
                ['--strength' as string]: light.strength,
              }}
            />
          ))}
        </span>
      ))}
    </span>
  )
}
