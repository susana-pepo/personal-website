/**
 * The slab as pictures, made while the page is idle. A stand-in of the panel (never opened, so
 * no [open] or :has() rule wakes) is dressed exactly as SectionPanel dresses the real one (its
 * place, the lamp, the reflection), its glass is read from the live CSS of .panel__sheet, its
 * pseudo-elements and its decoration spans, and drawn through an SVG foreignObject at device
 * resolution. Three pictures come out:
 *   - the slab: smoke, reflection, bevels, edge, its inner shadows; the lamp's glint left out;
 *   - the glint alone (the difference the lamp's specular, streak and hot rim make), painted and
 *     compared only over a strip on the lamp edge, cropped small, so the pour can light it only
 *     as the slab arrives under the bulb;
 *   - the shadow it casts on the room, so the contact shadow can trail the slab.
 * Whatever the glass block in SectionPanel.css paints is carried as it is: nothing here knows
 * its layers, only which custom properties are the lamp's glint (GLINT_VARS).
 */
import { partShadows, type Rect } from './geometry'

/** The lamp's own highlight on the lamp-side edge (SectionPanel.css). */
export const GLINT_VARS = ['--g-spec', '--g-streak', '--g-rim-hot', '--g-rim-warm']

/** Room round the slab in the pictures, for its shadow (CSS px). */
export const PAD = 64
/** Resolution cap: device px per CSS px. */
export const MAX_SCALE = 2
/** The lamp's glint lives within this far of the slab's lamp edge (CSS px). */
export const GLINT_STRIP = 48

export interface Surface {
  key: string
  /** The glass as the live CSS paints it now: an open is refused (and re-prepared) when it differs. */
  signature: string
  /** The dialog's box and the slab's, in CSS px, snapped as Chrome snaps the real sheet. */
  dock: Rect
  shell: Rect
  /** The pictures' size in CSS px and the slab's place inside them. */
  W: number
  H: number
  x0: number
  y0: number
  scale: number
  slab: HTMLCanvasElement
  shadow: HTMLCanvasElement
  glint: { pixels: Uint8Array; width: number; height: number; box: [number, number, number, number] } | null
  /** The bulb on the slab, as shares of its box. */
  lamp: { u: number; v: number }
  ms: number
}

const SIDES = ['top', 'right', 'bottom', 'left']
const PAINT = [
  'background-image', 'background-color', 'background-clip', 'background-origin', 'background-size',
  'background-position', 'background-repeat', 'background-blend-mode', 'box-shadow', 'isolation', 'overflow',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  ...SIDES.flatMap((s) => [`border-${s}-width`, `border-${s}-style`, `border-${s}-color`, `padding-${s}`]),
  'box-sizing', 'mix-blend-mode',
  'mask-image', 'mask-size', 'mask-position', 'mask-repeat', 'mask-clip', 'mask-origin', 'mask-composite', 'mask-mode',
]
const PLACE = ['position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'z-index', 'opacity']

interface Node {
  style: Record<string, string>
  children: Node[]
}

const isPainted = (cs: CSSStyleDeclaration) => cs.content !== 'none' && cs.display !== 'none'

function read(el: Element, pseudo: string | null, place: boolean): Record<string, string> {
  const cs = getComputedStyle(el, pseudo)
  const out: Record<string, string> = {}
  for (const p of PAINT) out[p] = cs.getPropertyValue(p)
  if (place) for (const p of PLACE) out[p] = cs.getPropertyValue(p)
  return out
}

/** The decoration spans the glass paints with (bevels, sheen), never the contents. */
export const decorations = (sheet: Element) => Array.from(sheet.querySelectorAll(':scope > span[aria-hidden="true"]'))

/** The sheet's glass as a tree of computed styles: the sheet, its pseudo-elements and decorations. */
function readGlass(sheet: Element): Node {
  const pseudo = (el: Element, which: '::before' | '::after'): Node[] =>
    isPainted(getComputedStyle(el, which)) ? [{ style: read(el, which, true), children: [] }] : []
  const decor = decorations(sheet).map((el) => ({ style: read(el, null, true), children: [...pseudo(el, '::before'), ...pseudo(el, '::after')] }))
  return { style: read(sheet, null, false), children: [...pseudo(sheet, '::before'), ...decor, ...pseudo(sheet, '::after')] }
}

/** What the glass looks like right now, cheaply comparable (the sheet's own fade and slide left out). */
export function glassSignature(sheet: Element): string {
  const parts: string[] = []
  const add = (el: Element, pseudo: string | null) => {
    const cs = getComputedStyle(el, pseudo)
    if (pseudo && !isPainted(cs)) return parts.push('-')
    parts.push(cs.backgroundImage, cs.backgroundSize, cs.backgroundPosition, cs.boxShadow, cs.maskImage, pseudo || el !== sheet ? cs.opacity : '')
  }
  add(sheet, null)
  add(sheet, '::before')
  add(sheet, '::after')
  for (const el of decorations(sheet)) {
    add(el, null)
    add(el, '::before')
    add(el, '::after')
  }
  return parts.join('|')
}

const styleOf = (o: Record<string, string>) =>
  Object.entries(o)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function html(node: Node): string {
  return `<div style="${esc(styleOf(node.style))}">${node.children.map(html).join('')}</div>`
}

// An SVG image can't load anything itself: every url(...) that isn't data: is inlined first.
const inlined = new Map<string, Promise<string | null>>()
async function inlineUrls(text: string): Promise<string> {
  const urls = [...text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/g)]
    .map((m) => m[1] ?? m[2] ?? m[3])
    .filter((u): u is string => !!u && !/^(data:|#|%23|blob:)/i.test(u))
  for (const u of new Set(urls)) {
    let job = inlined.get(u)
    if (!job) {
      job = fetch(new URL(u, location.href))
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then(
          (blob) =>
            new Promise<string>((res, rej) => {
              const fr = new FileReader()
              fr.onload = () => res(String(fr.result))
              fr.onerror = () => rej(fr.error)
              fr.readAsDataURL(blob)
            }),
        )
        .catch(() => null)
      inlined.set(u, job)
    }
    const data = await job
    if (data) text = text.split(u).join(data)
  }
  return text
}

/** The same tree with every image inlined (done on the raw styles, before they're escaped). */
async function inlineNode(node: Node): Promise<Node> {
  const style: Record<string, string> = {}
  for (const [k, v] of Object.entries(node.style)) style[k] = v.includes('url(') ? await inlineUrls(v) : v
  return { style, children: await Promise.all(node.children.map(inlineNode)) }
}

/** Paints markup laid out in a W×H box; `crop` paints only the columns cx to cx + cw of it. */
async function draw(markup: string, W: number, H: number, scale: number, crop?: { cx: number; cw: number }): Promise<HTMLCanvasElement> {
  const cx = crop?.cx ?? 0
  const cw = crop?.cw ?? W
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${H}" viewBox="${cx} 0 ${cw} ${H}"><foreignObject x="0" y="0" width="${W}" height="${H}"><div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${W}px;height:${H}px">${markup}</div></foreignObject></svg>`
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await img.decode()
  const c = document.createElement('canvas')
  c.width = Math.round(cw * scale)
  c.height = Math.round(H * scale)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c
}

/**
 * Whether this browser draws an image inside a foreignObject when the SVG is painted to a canvas
 * (WebKit has been known to leave them out): a small red picture is drawn through one and read
 * back. Asked once per page.
 */
let drawsImages: Promise<boolean> | null = null
function foreignObjectDrawsImages(): Promise<boolean> {
  drawsImages ??= (async () => {
    try {
      const red = document.createElement('canvas')
      red.width = red.height = 4
      const rc = red.getContext('2d')
      if (!rc) return false
      rc.fillStyle = '#f00'
      rc.fillRect(0, 0, 4, 4)
      const c = await draw(`<div style="width:8px;height:8px;background:url(${red.toDataURL('image/png')}) 0 0 / 8px 8px"></div>`, 8, 8, 1)
      const [r, g, b, a] = c.getContext('2d', { willReadFrequently: true })!.getImageData(4, 4, 1, 1).data
      return r! > 200 && g! < 60 && b! < 60 && a! > 200
    } catch {
      return false
    }
  })()
  return drawsImages
}

/**
 * Why a painted slab can't be trusted, or null when it looks like the glass: inside its box it
 * must be nearly opaque, a deep smoke (not black, not pale), and its smoke and reflection must be
 * there (a little texture, not one flat colour).
 */
export function checkSurface(s: Pick<Surface, 'slab' | 'shell' | 'x0' | 'y0' | 'scale'>): string | null {
  const N = 24
  const c = document.createElement('canvas')
  c.width = c.height = N
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 'no 2d context'
  const k = s.scale
  // the middle of the slab, clear of its bevels and lamp edge
  const sx = (s.x0 + s.shell.w * 0.15) * k
  const sy = (s.y0 + s.shell.h * 0.1) * k
  ctx.drawImage(s.slab, sx, sy, s.shell.w * 0.8 * k, s.shell.h * 0.85 * k, 0, 0, N, N)
  const d = ctx.getImageData(0, 0, N, N).data
  let alpha = 0
  let luma = 0
  let luma2 = 0
  const n = N * N
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]! / 255
    const y = a > 0 ? (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255 / a : 0
    alpha += a
    luma += y
    luma2 += y * y
  }
  alpha /= n
  luma /= n
  const spread = Math.sqrt(Math.max(0, luma2 / n - luma * luma))
  if (alpha < 0.6) return `see-through (${alpha.toFixed(2)})`
  if (luma < 0.01 || luma > 0.4) return `wrong depth (${luma.toFixed(3)})`
  if (spread < 0.0015) return 'flat: no smoke or reflection'
  return null
}

/** Lets the page breathe between the heavy steps, so preparing never holds a frame for long. */
const idle = () =>
  new Promise<void>((res) => (window.requestIdleCallback ? window.requestIdleCallback(() => res(), { timeout: 400 }) : window.setTimeout(res, 16)))

/**
 * The glint alone: where the slab with the lamp's glint is brighter than without it, cropped to
 * that patch, premultiplied, ready to be added on the GPU. Null when the glint isn't separable.
 */
function glintOf(lit: HTMLCanvasElement, unlit: HTMLCanvasElement, ox: number): Surface['glint'] {
  // `lit` is a strip of the picture, `ox` device px from its left
  const w = lit.width
  const h = lit.height
  const a = lit.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data
  const b = unlit.getContext('2d', { willReadFrequently: true })!.getImageData(ox, 0, w, h).data
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  const diff = new Uint8Array(w * h * 4)
  for (let i = 0, p = 0; i < a.length; i += 4, p++) {
    const aa = a[i + 3]! / 255
    const ba = b[i + 3]! / 255
    let any = false
    for (let ch = 0; ch < 3; ch++) {
      const d = Math.round(a[i + ch]! * aa - b[i + ch]! * ba)
      if (d > 0) {
        diff[i + ch] = d
        if (d > 1) any = true
      }
    }
    diff[i + 3] = Math.max(0, Math.round((aa - ba) * 255))
    if (any) {
      const x = p % w
      const y = (p - x) / w
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (x1 < 0) return null
  x0 = Math.max(0, x0 - 2)
  y0 = Math.max(0, y0 - 2)
  x1 = Math.min(w - 1, x1 + 2)
  y1 = Math.min(h - 1, y1 + 2)
  const cw = x1 - x0 + 1
  const ch = y1 - y0 + 1
  const pixels = new Uint8Array(cw * ch * 4)
  for (let y = 0; y < ch; y++) pixels.set(diff.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x1 + 1) * 4), y * cw * 4)
  const W = unlit.width
  return { pixels, width: cw, height: ch, box: [(ox + x0) / W, y0 / h, (ox + x1 + 1) / W, (y1 + 1) / h] }
}

export interface RasterInput {
  /** The real dialog: the stand-in is placed beside it and copies its classes. */
  dialog: HTMLDialogElement
  /** Dresses a dialog as SectionPanel does at open: its place, the lamp, the reflection. */
  dress: (dialog: HTMLDialogElement) => void
}

/** Builds, measures and paints the slab. Throws when the browser can't (an SVG it won't draw). */
export async function rasterise({ dialog, dress }: RasterInput): Promise<Surface> {
  const t0 = performance.now()
  if (!(await foreignObjectDrawsImages())) throw new Error('this browser paints the glass without its images')
  const realSheet = dialog.querySelector('.panel__sheet')
  if (!realSheet || !dialog.parentNode) throw new Error('no sheet')
  const probe = document.createElement('dialog')
  probe.className = dialog.className
  probe.dataset.state = 'open'
  probe.setAttribute('aria-hidden', 'true')
  probe.inert = true
  probe.style.cssText = 'display:block;visibility:hidden;pointer-events:none'
  const sheet = document.createElement('div')
  sheet.className = realSheet.className
  for (const span of decorations(realSheet)) sheet.appendChild(span.cloneNode(false))
  probe.appendChild(sheet)
  dialog.parentNode.insertBefore(probe, dialog.nextSibling)

  let lit: Node
  let unlit: Node
  let signature: string
  let dock: Rect
  let box: Rect
  let lamp: Surface['lamp']
  try {
    dress(probe)
    const d = probe.getBoundingClientRect()
    const r = sheet.getBoundingClientRect()
    dock = { x: d.left, y: d.top, w: d.width, h: d.height }
    // Chrome paints the sheet with its edges on device pixels: so do the pictures.
    const dpr = window.devicePixelRatio || 1
    const snap = (v: number) => Math.round(v * dpr) / dpr
    const L = snap(r.left)
    const T = snap(r.top)
    box = { x: L, y: T, w: snap(r.right) - L, h: snap(r.bottom) - T }
    const cs = getComputedStyle(probe)
    const pct = (name: string, fallback: number) => {
      const v = parseFloat(cs.getPropertyValue(name))
      return Number.isFinite(v) ? v / 100 : fallback
    }
    lamp = { u: 0, v: pct('--lamp-y', 0.46) }
    signature = glassSignature(sheet)
    lit = readGlass(sheet)
    for (const name of GLINT_VARS) probe.style.setProperty(name, '0')
    unlit = readGlass(sheet)
  } finally {
    probe.remove()
  }

  const scale = Math.min(window.devicePixelRatio || 1, MAX_SCALE)
  // The pictures' origin sits on a device pixel and the slab keeps its own fraction inside them.
  const x0 = box.x - Math.floor((box.x - PAD) * scale) / scale
  const y0 = box.y - Math.floor((box.y - PAD) * scale) / scale
  const W = Math.ceil(box.w + x0 + PAD)
  const H = Math.ceil(box.h + y0 + PAD)
  const place = `position:absolute;box-sizing:border-box;left:${x0}px;top:${y0}px;width:${box.w}px;height:${box.h}px;`

  const slabOf = (n: Node) => {
    const { inset } = partShadows(n.style['box-shadow'] ?? 'none')
    return html({ style: { ...n.style, 'box-shadow': inset }, children: n.children }).replace('<div style="', `<div style="${place}`)
  }
  const { outer } = partShadows(lit.style['box-shadow'] ?? 'none')
  const shadowMarkup = `<div style="${place}${esc(
    styleOf({
      'box-shadow': outer,
      'border-top-left-radius': lit.style['border-top-left-radius'] ?? '0',
      'border-top-right-radius': lit.style['border-top-right-radius'] ?? '0',
      'border-bottom-right-radius': lit.style['border-bottom-right-radius'] ?? '0',
      'border-bottom-left-radius': lit.style['border-bottom-left-radius'] ?? '0',
    }),
  )}"></div>`

  lit = await inlineNode(lit)
  unlit = await inlineNode(unlit)
  const slab = await draw(slabOf(unlit), W, H, scale)
  await idle()
  // the lamp's glint sits on the slab's left (lamp) edge: only that strip is painted lit
  const cx = Math.max(0, Math.floor((x0 - 8) * scale) / scale)
  const cw = Math.min(W - cx, Math.ceil((GLINT_STRIP + 8) * scale) / scale)
  const withGlint = await draw(slabOf(lit), W, H, scale, { cx, cw })
  await idle()
  const glint = glintOf(withGlint, slab, Math.round(cx * scale))
  await idle()
  const shadow = await draw(shadowMarkup, W, H, 1)
  const key = `${dock.x.toFixed(1)},${dock.y.toFixed(1)},${dock.w.toFixed(1)}x${dock.h.toFixed(1)}@${scale}`
  return { key, signature, dock, shell: box, W, H, x0, y0, scale, slab, shadow, glint, lamp, ms: Math.round(performance.now() - t0) }
}
