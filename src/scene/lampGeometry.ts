import { lampParts } from './scene-layout.json'
import { overlay } from './layout'

/*
 * Where the desk lamp's light is, on the 1920×1080 canvas: the bulb, the open rim of the
 * shade (the light leaves through it), and where its light lands. Shared by the lamp's light
 * (the shader and its SVG fallback) and its glare.
 *
 * The bulb and the rim are measured on the lamp picture itself (lampParts in
 * scene-layout.json, as fractions of the picture) and placed from the lamp's box, so the light
 * follows the lamp wherever it's put (move it with ?sandbox=1, then save its numbers). The pool
 * and the foot of the cone lie on the desk: they keep their depth and follow the bulb sideways.
 */
const LAMP = overlay('lamp')
const at = ([fx, fy]: readonly number[]): [number, number] => [LAMP.x + fx! * LAMP.width, LAMP.y + fy! * LAMP.height]

const [bulbX, bulbY] = at(lampParts.bulb)
export const BULB = { x: bulbX, y: bulbY }
export const RIM = { left: at(lampParts.rimLeft), right: at(lampParts.rimRight) } as const
export const POOL = { x: bulbX, y: 735, rx: 300, ry: 92 }
export const CONE_FOOT = { left: [bulbX - 190, 880], right: [bulbX + 300, 860] } as const
