/*
 * Where the desk lamp is, on the 1920×1080 canvas: the bulb, the open rim of
 * the shade (the light leaves through it), and where its light lands. Shared by
 * the lamp's light (the shader and its SVG fallback) and its tint.
 */
export const BULB = { x: 1030, y: 472 }
export const RIM = { left: [962, 468], right: [1094, 462] } as const
export const POOL = { x: 1030, y: 735, rx: 300, ry: 92 }
export const CONE_FOOT = { left: [840, 880], right: [1330, 860] } as const
