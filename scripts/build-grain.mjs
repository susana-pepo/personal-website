/**
 * Bake the panel's grain tiles to PNG.
 *
 * Usage: node scripts/build-grain.mjs           (writes the tiles)
 *        node scripts/build-grain.mjs --check   (also compares them with the live SVG)
 *
 * The sheet's fibre, the turn light's dither and the sleeves' tooth used to be SVG data URIs with
 * an feTurbulence filter. Safari renders an SVG used as a background or a mask afresh at every
 * paint, filter and all, on the main thread, so each repaint of the sheet re-ran the noise. Here
 * Chrome renders each SVG once, exactly as it drew it on the page, at 1x, 2x and 3x, and the CSS
 * picks the one for the screen with image-set() at the old tile size. PNG, because it is lossless:
 * the grain is a few 255ths strong, and a lossy codec would smooth away the dither it is there for.
 *
 * Needs Google Chrome and Playwright. Playwright is borrowed from the apartment-studio project
 * (its bundled browsers don't run here, so this launches the installed Chrome); set
 * PLAYWRIGHT_FROM to another package.json that depends on Playwright to use that one instead.
 * Writes public/media/grain/<name>@<n>x.png. Re-run after changing a tile's SVG below.
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/media/grain')
const playwrightFrom = process.env.PLAYWRIGHT_FROM ?? '/Users/susanapepo/Documents/Apps/apartment-studio/package.json'
const { chromium } = createRequire(playwrightFrom)('playwright')

// The SVGs exactly as they were written in the CSS, so the tiles are the same noise.
const TILES = [
  {
    // .panel__sheet's fibre (SectionPanel.css --fibre)
    name: 'fibre',
    size: 180,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .2 0 0 0 0 .14 0 0 0 0 .1 0 0 0 .07 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
    backdrop: 'oklch(0.24 0.012 55)',
  },
  {
    // the turn light's mask (turn-fx.css --turn-grain)
    name: 'turn-grain',
    size: 160,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.2 0 0 0 .3'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>",
    mask: true,
  },
  {
    // the sleeves' printed tooth (music.css .sleeve__face::after and friends)
    name: 'sleeve-grain',
    size: 120,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 .95 0 0 0 0 .9 0 0 0 .09 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
    backdrop: 'oklch(0.5 0.05 40)',
  },
]
const SCALES = [1, 2, 3]

const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
const pngUrl = (buffer) => `url("data:image/png;base64,${buffer.toString('base64')}")`
const file = (tile, scale) => join(outDir, `${tile.name}@${scale}x.png`)

/** One element's pixels at the given scale, transparent where nothing is drawn. */
async function shoot(browser, scale, width, height, style) {
  const context = await browser.newContext({ deviceScaleFactor: scale, viewport: { width: width + 20, height: height + 20 } })
  const page = await context.newPage()
  // In a style sheet, not a style attribute: the urls are quoted, and so is an attribute.
  await page.setContent(`<style>html,body{margin:0;background:transparent}div{width:${width}px;height:${height}px;${style}}</style><div></div>`)
  // A background or mask image loads on its own time; decode each first and let two frames
  // pass, so the screenshot never catches the element before its image is drawn.
  const sources = [...style.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1])
  await page.evaluate(async (sources) => {
    await Promise.all(sources.map((src) => Object.assign(new Image(), { src }).decode()))
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  }, sources)
  const png = await page.screenshot({ clip: { x: 0, y: 0, width, height }, omitBackground: true })
  await context.close()
  return png
}

// Chrome's screenshots are 8-bit RGBA PNGs. Each tile has only a few dozen to a hundred and fifty
// distinct colours, so it is rewritten as an indexed PNG with the same pixels, at about a third of
// the bytes. Done here by hand with zlib, so the script needs nothing but Chrome.
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (bytes) => {
  let c = 0xffffffff
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** The pixels of an 8-bit, non-interlaced RGB, RGBA or indexed PNG, as RGBA. */
function decodePng(png) {
  let offset = 8
  let width = 0
  let height = 0
  let channels = 0
  let palette = null
  let alpha = Buffer.alloc(0)
  const data = []
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('latin1', offset + 4, offset + 8)
    const body = png.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      const [depth, colour, , , interlace] = body.subarray(8)
      if (depth !== 8 || interlace !== 0 || ![2, 3, 6].includes(colour)) throw new Error('Expected an 8-bit RGB, RGBA or indexed PNG.')
      channels = { 2: 3, 3: 1, 6: 4 }[colour]
    }
    if (type === 'PLTE') palette = body
    if (type === 'tRNS') alpha = body
    if (type === 'IDAT') data.push(body)
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(data))
  const stride = width * channels
  const rows = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? rows[y * stride + x - channels] : 0
      const up = y > 0 ? rows[(y - 1) * stride + x] : 0
      const corner = x >= channels && y > 0 ? rows[(y - 1) * stride + x - channels] : 0
      let predicted = 0
      if (filter === 1) predicted = left
      else if (filter === 2) predicted = up
      else if (filter === 3) predicted = (left + up) >> 1
      else if (filter === 4) {
        const p = left + up - corner
        const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - corner)]
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : corner
      }
      rows[y * stride + x] = (line[x] + predicted) & 0xff
    }
  }
  const rgba = Buffer.alloc(width * height * 4, 0xff)
  for (let i = 0; i < width * height; i++) {
    if (palette) {
      const entry = rows[i]
      palette.copy(rgba, i * 4, entry * 3, entry * 3 + 3)
      rgba[i * 4 + 3] = entry < alpha.length ? alpha[entry] : 0xff
    } else rows.copy(rgba, i * 4, i * channels, i * channels + channels)
  }
  return { width, height, rgba }
}

/** The same pixels as an indexed PNG with a transparency table, or null past 256 colours. */
function encodeIndexed({ width, height, rgba }) {
  const index = new Map()
  const pixels = Buffer.alloc(width * height)
  for (let i = 0; i < width * height; i++) {
    const key = rgba.readUInt32BE(i * 4)
    if (!index.has(key)) index.set(key, index.size)
    if (index.size > 256) return null
    pixels[i] = index.get(key)
  }
  const colours = [...index.keys()]
  const palette = Buffer.from(colours.flatMap((key) => [key >>> 24, (key >>> 16) & 0xff, (key >>> 8) & 0xff]))
  const alpha = Buffer.from(colours.map((key) => key & 0xff))
  const scanlines = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y++) pixels.copy(scanlines, y * (width + 1) + 1, y * width, (y + 1) * width)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 3, 0, 0, 0], 8)
  const chunk = (type, body) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(body.length, 0)
    head.write(type, 4, 'latin1')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0)
    return Buffer.concat([head, body, crc])
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('PLTE', palette),
    chunk('tRNS', alpha),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** The largest difference in any channel between two images of the same size, and how many pixels differ. */
function compare(a, b) {
  const [pa, pb] = [decodePng(a).rgba, decodePng(b).rgba]
  let max = 0
  let off = 0
  for (let i = 0; i < pa.length; i += 4) {
    let d = 0
    for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(pa[i + c] - pb[i + c]))
    max = Math.max(max, d)
    if (d) off++
  }
  return { max, off, total: pa.length / 4 }
}

const browser = await chromium.launch({ channel: 'chrome' })
try {
  mkdirSync(outDir, { recursive: true })
  for (const tile of TILES) {
    for (const scale of SCALES) {
      const shot = await shoot(browser, scale, tile.size, tile.size, `background:${svgUrl(tile.svg)}`)
      const image = decodePng(shot)
      if (!image.rgba.some((value, i) => i % 4 === 3 && value > 0)) throw new Error(`${tile.name}@${scale}x came out blank`)
      const png = encodeIndexed(image) ?? shot
      if (compare(png, shot).max) throw new Error(`${tile.name}@${scale}x changed when it was repacked`)
      writeFileSync(file(tile, scale), png)
      console.log(`wrote public/media/grain/${tile.name}@${scale}x.png (${png.length} bytes)`)
    }
  }

  if (process.argv.includes('--check')) {
    // Two by two tiles, so a seam would show too, drawn the way the site draws them: the grain
    // over its backdrop, or the turn grain as a mask over white. Live SVG against the baked PNG.
    for (const tile of TILES) {
      const set = `image-set(${SCALES.map((scale) => `${pngUrl(readFileSync(file(tile, scale)))} ${scale}x`).join(', ')}) 0 0 / ${tile.size}px ${tile.size}px`
      const span = tile.size * 2
      const draw = (layer) =>
        tile.mask
          ? `background:#fff;-webkit-mask:${layer};mask:${layer}`
          : `background:${layer},${tile.backdrop}`
      for (const scale of SCALES) {
        const live = await shoot(browser, scale, span, span, draw(svgUrl(tile.svg)))
        const baked = await shoot(browser, scale, span, span, draw(set))
        const { max, off, total } = compare(live, baked)
        console.log(`${tile.name} @${scale}x: max difference ${max}/255, ${off} of ${total} pixels differ`)
      }
    }
  }
} finally {
  await browser.close()
}
