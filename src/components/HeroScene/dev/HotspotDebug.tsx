import { useEffect, useRef, useState } from 'react'
import { HOTSPOTS, SCENE_HEIGHT, SCENE_WIDTH, boundsOf, toPathData } from '../../../scene/hotspots'
import { OVERLAYS } from '../../../scene/layout'

const COLOURS = ['#00e5ff', '#ff4fd8', '#ffe600', '#4dff6a', '#ff6b6b', '#6ba8ff', '#ffa23a']
const BOX_COLOURS: Record<string, string> = { vinyl: '#ff6b6b', books: '#2ee6a6', laptop: '#6ba8ff', cat: '#ffc23a' }

/**
 * Development-only overlay (`?debug=1`, `?debugHotspots=1`, or press D).
 * Draws each transparent overlay's box (dashed, with its canvas position and
 * size), every clickable outline with its vertices and tag anchor, and shows
 * the pointer position in the 1920×1080 canvas so things can be placed
 * precisely. Edit src/scene/scene-layout.json or hotspot-geometry.json and the
 * page hot-reloads; after moving an overlay run `npm run scene:trace`.
 */
export default function HotspotDebug() {
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Listen on the document so the overlay never blocks the real hotspots.
  useEffect(() => {
    const track = (event: PointerEvent) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const inside =
        event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
      setCursor(
        inside
          ? {
              x: Math.round(((event.clientX - rect.left) / rect.width) * SCENE_WIDTH),
              y: Math.round(((event.clientY - rect.top) / rect.height) * SCENE_HEIGHT),
            }
          : null,
      )
    }
    document.addEventListener('pointermove', track)
    return () => document.removeEventListener('pointermove', track)
  }, [])

  return (
    <div className="hotspot-debug" aria-hidden="true">
      <svg ref={svgRef} viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`} preserveAspectRatio="none">
        {OVERLAYS.map((o) => {
          const colour = BOX_COLOURS[o.id] ?? '#fff'
          return (
            <g key={`box-${o.id}`}>
              <rect
                x={o.x}
                y={o.y}
                width={o.width}
                height={o.height}
                fill={colour}
                fillOpacity={0.08}
                stroke={colour}
                strokeWidth={3}
                strokeDasharray="12 8"
              />
              <text
                x={o.x + 6}
                y={o.y + o.height - 8}
                fill={colour}
                fontSize={18}
                fontFamily="monospace"
                paintOrder="stroke"
                stroke="#000"
                strokeWidth={4}
              >
                {o.id.toUpperCase()} x{o.x} y{o.y} w{o.width} h{Math.round(o.height)} z{o.z}
              </text>
            </g>
          )
        })}
        {HOTSPOTS.map((h, i) => {
          const colour = COLOURS[i % COLOURS.length]
          const b = boundsOf(h.polygons)
          return (
            <g key={h.id}>
              <path d={toPathData(h.polygons)} fillRule="evenodd" fill={colour} fillOpacity={0.14} stroke={colour} strokeWidth={2} />
              {h.polygons.flat().map(([x, y], j) => (
                <circle key={j} cx={x} cy={y} r={3.5} fill={colour} />
              ))}
              <circle cx={h.label.x} cy={h.label.y} r={7} fill="none" stroke="#fff" strokeWidth={2} />
              <text x={b.x} y={b.y - 8} fill={colour} fontSize={20} fontFamily="monospace" paintOrder="stroke" stroke="#000" strokeWidth={4}>
                {h.id} → {h.section ?? h.action}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="hotspot-debug__readout">
        debug (D to hide) · {cursor ? `x ${cursor.x}, y ${cursor.y}` : 'move over the scene'}
      </p>
    </div>
  )
}
