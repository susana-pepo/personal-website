/**
 * Development only: ?trace=1 records, for the first 10 s, every element of the room and the
 * page around it whose visibility drops after it has appeared (a flicker), with the time
 * since navigation. Read the result in the console as `window.__flicker`.
 */
const WATCH = [
  '.cover',
  '.scene',
  '.stage__poster',
  '.stage__video',
  '.masthead',
  '.credits > *',
  '.scene-object',
  '.scene-object img',
  '.window-view__layer',
  '.lamp-liquid',
  '.woman__clips img',
  '.cat__clips img',
]

interface Seen {
  el: Element
  label: string
  max: number
  last: number
}

export function startFlickerTrace() {
  const events: string[] = []
  const seen = new Map<Element, Seen>()
  const label = (el: Element) => {
    const cls = (el.getAttribute('class') ?? el.tagName.toLowerCase()).split(' ').slice(0, 3).join('.')
    const extra = (el as HTMLElement).dataset?.clip ?? (el as HTMLImageElement).src?.split('/').pop()?.slice(0, 24) ?? ''
    return `${cls}${extra ? ` [${extra}]` : ''}`
  }
  // what's actually drawn: its own opacity times its ancestors', and whether it's in the page
  const visible = (el: Element) => {
    if (!el.isConnected) return 0
    let o = 1
    for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0
      o *= Number(cs.opacity)
    }
    return o
  }
  const t0 = performance.timeOrigin
  const tick = () => {
    const t = Math.round(performance.now())
    for (const sel of WATCH) {
      for (const el of document.querySelectorAll(sel)) {
        if (!seen.has(el)) seen.set(el, { el, label: label(el), max: 0, last: 0 })
      }
    }
    for (const s of seen.values()) {
      const v = visible(s.el)
      if (s.max > 0.6 && v < s.max - 0.35 && s.last >= s.max - 0.35) {
        events.push(`${t} ms: ${s.label} dropped ${s.max.toFixed(2)} -> ${v.toFixed(2)}${s.el.isConnected ? '' : ' (removed)'}`)
      }
      if (s.max > 0.6 && s.last < s.max - 0.35 && v >= s.max - 0.1) {
        events.push(`${t} ms: ${s.label} back to ${v.toFixed(2)}`)
      }
      s.max = Math.max(s.max, v)
      s.last = v
    }
    if (performance.now() < 10_000) requestAnimationFrame(tick)
    else (window as unknown as { __flickerDone: boolean }).__flickerDone = true
  }
  ;(window as unknown as { __flicker: string[]; __flickerStart: number }).__flicker = events
  ;(window as unknown as { __flickerStart: number }).__flickerStart = t0
  requestAnimationFrame(tick)
}
