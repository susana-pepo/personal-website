import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { CANVAS_HEIGHT, CANVAS_WIDTH, OVERLAYS, pctX, pctY, type OverlayId } from '../../../scene/layout'
import { clearPlacements, getPlacement, setPlacement, type Placement } from '../../../scene/layoutOverrides'
import './SceneSandbox.css'

const NAMES: Record<OverlayId, string> = {
  plant: 'Hanging plant',
  books: 'Shelf books',
  piano: 'Piano computer',
  vinyl: 'Record player',
  lamp: 'Desk lamp',
  vase: 'Flower vase',
  deskbooks: 'Desk books',
  laptop: 'Laptop',
  woman: 'Woman',
  coffee: 'Coffee',
  cat: 'Cat',
}

/**
 * Development-only placement sandbox: open the site with ?sandbox=1.
 * Pick an object, drag it, nudge it with the arrow keys (Shift = 10 px), and
 * resize it with the slider, the − / + keys or the mouse wheel. It always
 * grows and shrinks from its base, so it stays standing on its surface. The
 * numbers are canvas pixels (1920 × 1080): press Copy and paste them to Claude
 * or into src/scene/scene-layout.json. Nothing is saved automatically.
 */
export default function SceneSandbox() {
  const [selected, setSelected] = useState<OverlayId>('plant')
  const [, force] = useState(0)
  const [copied, setCopied] = useState(false)
  const layerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startX: number; startY: number; from: Placement } | null>(null)

  const base = OVERLAYS.find((o) => o.id === selected)!
  const current: Placement = getPlacement(selected) ?? { x: base.x, y: base.y, width: base.width }
  const ratio = base.height / base.width
  const height = current.width * ratio

  const update = useCallback(
    (next: Placement) => {
      setPlacement(selected, { x: Math.round(next.x), y: Math.round(next.y), width: Math.round(next.width) })
      setCopied(false)
      force((n) => n + 1)
    },
    [selected],
  )

  /** Resize around the bottom-centre, so the object keeps standing where it is. */
  const resize = useCallback(
    (width: number) => {
      const w = Math.max(40, Math.min(1200, width))
      const bottom = current.y + current.width * ratio
      const centre = current.x + current.width / 2
      update({ x: centre - w / 2, y: bottom - w * ratio, width: w })
    },
    [current, ratio, update],
  )

  const canvasScale = () => {
    const rect = layerRef.current?.getBoundingClientRect()
    return rect ? CANVAS_WIDTH / rect.width : 1
  }

  const onPointerDown = (event: ReactPointerEvent) => {
    event.preventDefault()
    ;(event.target as Element).setPointerCapture(event.pointerId)
    drag.current = { startX: event.clientX, startY: event.clientY, from: current }
  }
  const onPointerMove = (event: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const k = canvasScale()
    update({ ...d.from, x: d.from.x + (event.clientX - d.startX) * k, y: d.from.y + (event.clientY - d.startY) * k })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select')) return
      const step = event.shiftKey ? 10 : 1
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      const move = moves[event.key]
      if (move) {
        event.preventDefault()
        update({ ...current, x: current.x + move[0], y: current.y + move[1] })
      } else if (event.key === '+' || event.key === '=') {
        resize(current.width + step * 2)
      } else if (event.key === '-' || event.key === '_') {
        resize(current.width - step * 2)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, resize, update])

  const snippet = `"x": ${current.x}, "y": ${current.y}, "width": ${current.width}`
  const copy = async () => {
    const text = `${selected}: ${snippet}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      window.prompt('Copy these numbers', text)
    }
  }

  return (
    <>
      <div className="sandbox-layer" ref={layerRef}>
        <div
          className="sandbox-handle"
          style={{ left: pctX(current.x), top: pctY(current.y), width: pctX(current.width), height: pctY(height) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(event) => resize(current.width - Math.sign(event.deltaY) * (event.shiftKey ? 10 : 2))}
        >
          <span className="sandbox-handle__base" />
        </div>
        <span className="sandbox-guide" style={{ top: pctY(current.y + height) }} />
      </div>

      <div className="sandbox-panel" role="region" aria-label="Placement sandbox">
        <p className="sandbox-panel__title">Placement sandbox</p>
        <div className="sandbox-panel__tabs">
          {OVERLAYS.map((o) => (
            <button key={o.id} type="button" aria-pressed={o.id === selected} onClick={() => setSelected(o.id)}>
              {NAMES[o.id]}
            </button>
          ))}
        </div>
        <label className="sandbox-panel__row">
          Size
          <input
            type="range"
            min={Math.round(base.width * 0.6)}
            max={Math.round(base.width * 1.4)}
            value={current.width}
            onChange={(event) => resize(Number(event.target.value))}
          />
        </label>
        <p className="sandbox-panel__numbers">
          x <b>{current.x}</b> · y <b>{current.y}</b> · width <b>{current.width}</b> · base at y <b>{Math.round(current.y + height)}</b>
        </p>
        <p className="sandbox-panel__help">Drag it · arrow keys nudge (Shift ×10) · − / + or wheel to resize from its base</p>
        <div className="sandbox-panel__actions">
          <button type="button" onClick={copy}>
            {copied ? 'Copied' : 'Copy numbers'}
          </button>
          <button
            type="button"
            onClick={() => {
              clearPlacements()
              force((n) => n + 1)
            }}
          >
            Reset all
          </button>
        </div>
        <p className="sandbox-panel__note">
          Canvas {CANVAS_WIDTH}×{CANVAS_HEIGHT} px. The dashed line marks the object's base. Its clickable outline
          catches up once the numbers are saved.
        </p>
      </div>
    </>
  )
}
