/**
 * The desk lamp's light: the painting's own warm white. A click turns it off
 * (just the room's own light), the next turns it back on. (Kept as a list so
 * another colour could be added back as a further step.) Each is two tones, `core` near the bulb and `glow` further out
 * (linear 0–1 RGB, how much each channel of a lit surface is brightened). Light
 * only ever adds: no colour is taken away from the room.
 */
export interface LampTone {
  id: 'warm'
  core: readonly [number, number, number]
  glow: readonly [number, number, number]
  /** Overall strength of the light. */
  gain: number
  /**
   * The light's colour as CSS, for what's drawn in the page rather than in the
   * shader: the glare round the bulb, the tint inside the shade, the splash ink.
   */
  css: string
  /** Whether the inside of the shade is re-tinted (not for the painting's own warm light). */
  tintShade: boolean
}

export const LAMP_TONES: readonly LampTone[] = [
  { id: 'warm', core: [1.0, 0.94, 0.82], glow: [1.0, 0.84, 0.66], gain: 1, css: 'oklch(0.93 0.07 80)', tintShade: false },
]

/** The step after the last light: the lamp's light off, only the room's own light. */
export const LAMP_OFF = LAMP_TONES.length

export const nextTone = (index: number) => (index + 1) % (LAMP_TONES.length + 1)

/** The light at a step, or null when the lamp's light is off. */
export const toneAt = (index: number): LampTone | null => LAMP_TONES[index] ?? null

/** The colour a tone's little splash takes (a soft cream ink when the light goes off). */
export const splashColour = (tone: LampTone | null) => tone?.css ?? 'oklch(0.9 0.025 80)'
