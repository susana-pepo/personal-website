import { useState, type CSSProperties, type ReactNode } from 'react'
import { HALO_MARGIN, pctX, pctY, type Overlay } from '../../../scene/layout'
import { usePlacedOverlay } from '../../../scene/layoutOverrides'

interface SceneObjectProps {
  overlay: Overlay
  /** Lit while its hotspot is hovered or focused. */
  highlighted: boolean
  /** Order in the first-visit discovery sequence (0 = first). */
  discoveryIndex: number
  /** Custom artwork (the cat's, woman's or coffee's clips, the record player's layers); defaults to the overlay's transparent PNG. */
  children?: ReactNode
  /** Drawn on top of the artwork, inside the object's box (so it follows the hover magnify). */
  extra?: ReactNode
  className?: string
  dataAttributes?: Record<`data-${string}`, string | undefined>
}

/**
 * One transparent object on the shared canvas, in three stacked layers:
 *   halo  – precomputed amber light following its silhouette (behind it)
 *   art   – the artwork itself (the overlay's PNG, or custom layers passed as children)
 *   sheen – optional precomputed highlight (laptop screen, record rim, metal)
 * Hover only changes opacity (and a brightness lift on still PNGs), so no
 * live filtering runs on video. Purely visual: the clickable outline and its
 * keyboard control live in HotspotLayer.
 */
export function SceneObject({ overlay: base, highlighted, discoveryIndex, children, extra, className, dataAttributes }: SceneObjectProps) {
  const overlay = usePlacedOverlay(base) // development sandbox only; identical in production
  const [loaded, setLoaded] = useState(false)
  // The halo image covers the object's box plus HALO_MARGIN canvas px on every side.
  const halo = {
    left: `${-(HALO_MARGIN / overlay.width) * 100}%`,
    top: `${-(HALO_MARGIN / overlay.height) * 100}%`,
    width: `${((overlay.width + 2 * HALO_MARGIN) / overlay.width) * 100}%`,
    height: `${((overlay.height + 2 * HALO_MARGIN) / overlay.height) * 100}%`,
  }
  const style = {
    left: pctX(overlay.x),
    top: pctY(overlay.y),
    width: pctX(overlay.width),
    height: pctY(overlay.height),
    zIndex: overlay.z,
    '--glow-rest': overlay.glow?.rest ?? 0,
    '--glow-hover': overlay.glow?.hover ?? 0,
    '--glow-invite': overlay.glow?.invite ?? 0,
    '--lift': overlay.glow?.lift ?? 1,
    '--discover-order': discoveryIndex,
  } as CSSProperties

  return (
    <div
      className={`scene-object scene-object--${overlay.id}${className ? ` ${className}` : ''}`}
      data-highlighted={highlighted ? '' : undefined}
      data-loaded={children || loaded ? '' : undefined}
      style={style}
      {...dataAttributes}
      aria-hidden="true"
    >
      {overlay.shadow && (
        <span
          className="scene-object__shadow"
          style={{
            left: `${overlay.shadow.x * 100}%`,
            top: `${overlay.shadow.y * 100}%`,
            width: `${overlay.shadow.w * 100}%`,
            height: `${overlay.shadow.h * 100}%`,
            opacity: overlay.shadow.opacity,
          }}
        />
      )}
      {overlay.halo && (
        <img
          className="scene-object__halo"
          src={overlay.halo}
          alt=""
          decoding="async"
          draggable={false}
          style={halo}
        />
      )}
      <div className="scene-object__art">
        {children ?? (
          <img
            src={overlay.src}
            alt=""
            width={Math.round(overlay.width)}
            height={Math.round(overlay.height)}
            decoding="async"
            draggable={false}
            ref={(img) => {
              // Cached images can finish before React attaches onLoad.
              if (img?.complete && img.naturalWidth > 0) setLoaded(true)
            }}
            onLoad={() => setLoaded(true)}
          />
        )}
      </div>
      {overlay.sheen && <img className="scene-object__sheen" src={overlay.sheen} alt="" decoding="async" draggable={false} />}
      {extra}
    </div>
  )
}
