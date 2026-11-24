/**
 * The Pixel Jam Piano's title screen, in pixel art on its 128x95 screen: PIXEL JAM (twice the size,
 * warm amber from top to bottom), PIANO, a little keyboard whose keys light up one by one, and a
 * blinking PRESS A KEY. The close-up boots with it; the piano on the shelf lights up with its name
 * (paintName) while it's hovered, so the two always look the same.
 */
import { textPixels, textWidth } from './pixelFont'

export type Rgb = [number, number, number]
/** Lays one pixel of colour `c` at strength `a` (0-1) over what's there. */
export type Put = (x: number, y: number, c: Rgb, a: number) => void

export const TITLE_W = 128
export const TITLE_H = 95
export const TITLE_BG: Rgb = [0.03, 0.024, 0.05]
const AMBER: Rgb[] = [[1, 0.86, 0.55], [0.98, 0.74, 0.4], [0.95, 0.6, 0.3]]
const MOON: Rgb = [0xf2 / 255, 0xef / 255, 0xd9 / 255]
const KEY: Rgb = [0.86, 0.82, 0.74]
const INK: Rgb = [0.1, 0.08, 0.1]

function text(put: Put, str: string, x0: number, y0: number, c: Rgb, a: number, scale = 1, colour?: (row: number) => Rgb) {
  for (const [x, y] of textPixels(str)) {
    const cc = colour ? colour(y) : c
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) put(x0 + x * scale + dx, y0 + y * scale + dy, cc, a)
  }
}
const centred = (str: string, scale = 1) => Math.round((TITLE_W - textWidth(str) * scale) / 2)

/** The title screen at time `t` (seconds), at strength `a`. */
export function paintTitle(put: Put, t: number, a: number, reduce: boolean) {
  text(put, 'PIXEL JAM', centred('PIXEL JAM', 2), 24, MOON, a, 2, (row) => AMBER[Math.min(2, row >> 1)]!)
  text(put, 'PIANO', centred('PIANO'), 39, MOON, a)
  const k0 = 44
  const lit = Math.floor(t * 6) % 8
  for (let k = 0; k < 8; k++) for (let y = 52; y < 60; y++) for (let x = 0; x < 4; x++) put(k0 + k * 5 + x, y, k === lit && !reduce ? AMBER[0]! : KEY, a)
  for (const k of [0, 1, 3, 4, 5]) for (let y = 52; y < 56; y++) for (let x = 0; x < 2; x++) put(k0 + k * 5 + 3 + x, y, INK, a)
  if (reduce || Math.sin(t * 4) > -0.2) text(put, 'PRESS A KEY', centred('PRESS A KEY'), 70, MOON, a * 0.85) // it blinks
}

/** Just its name, stacked large so it reads on the small shelf piano: PIXEL / JAM / PIANO. */
export function paintName(put: Put, a: number) {
  const S = 4
  const lines = ['PIXEL', 'JAM', 'PIANO']
  const top = Math.round((TITLE_H - (lines.length * 5 * S + (lines.length - 1) * 6)) / 2)
  lines.forEach((line, i) => {
    const colour = (row: number) => (i < 2 ? AMBER[Math.min(2, Math.floor((row * 3) / 5))]! : MOON)
    text(put, line, centred(line, S), top + i * (5 * S + 6), MOON, a, S, colour)
  })
}
