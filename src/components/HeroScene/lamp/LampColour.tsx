import { Fragment, type CSSProperties } from 'react'
import { overlay, pctX, pctY } from '../../../scene/layout'
import { usePlacedOverlay } from '../../../scene/layoutOverrides'
import { LAMP_TONES } from '../../../scene/lampTones'
import { BULB } from '../../../scene/lampGeometry'

const LAMP = overlay('lamp')

interface LampColourProps {
  /** Which light is on (index into LAMP_TONES). */
  tone: number
}

/**
 * The parts of the lamp's light that belong to the light source itself, drawn
 * in the page (the light falling on the room is LampLiquid's job):
 *  - a soft glare round the bulb, added like real glare (screen), in the
 *    light's colour;
 *  - for a coloured light, the pale inside of the shade and the bulb take its
 *    hue (never the brass outside) (`color` blend, so the painting keeps its light and shade).
 * One set per light, cross-faded in step with LampLiquid's glide.
 */
export function LampColour({ tone }: LampColourProps) {
  const lamp = usePlacedOverlay(LAMP) // development sandbox only; identical in production
  const at = { '--bulb-x': pctX(BULB.x), '--bulb-y': pctY(BULB.y) } as CSSProperties
  const box = { left: pctX(lamp.x), top: pctY(lamp.y), width: pctX(lamp.width), height: pctY(lamp.height) }
  return (
    <>
      {LAMP_TONES.map((t, i) => (
        <Fragment key={t.id}>
          <span
            aria-hidden="true"
            className="lamp-colour lamp-colour--glare"
            data-on={i === tone ? '' : undefined}
            style={{ ...at, '--tone': t.css } as CSSProperties}
          />
          {t.tintShade && (
            <span
              aria-hidden="true"
              className="lamp-colour lamp-colour--glow"
              data-on={i === tone ? '' : undefined}
              style={{ ...box, '--tone': t.css } as CSSProperties}
            />
          )}
        </Fragment>
      ))}
    </>
  )
}
