import type { WorkThumbKind } from '../../../../content/types'

/**
 * Colours for the Work thumbnails, all taken from the room (the same values the
 * bookshelf spines use), plus card, ink and the one spot colour.
 */
export const P = {
  card: 'oklch(0.955 0.006 85)',
  shade: 'oklch(0.9 0.008 80)',
  ink: 'oklch(0.205 0.01 45)',
  ink2: 'oklch(0.37 0.012 45)',
  ink3: 'oklch(0.55 0.012 45)',
  spot: 'oklch(0.6 0.165 37)',
  terracotta: 'oklch(0.55 0.13 40)',
  teal: 'oklch(0.36 0.045 185)',
  slate: 'oklch(0.46 0.05 262)',
  ochre: 'oklch(0.76 0.095 78)',
  walnut: 'oklch(0.4 0.06 50)',
  rose: 'oklch(0.72 0.065 28)',
} as const

/** The surface each object lies on. Muted so the object, not the ground, carries the tile. */
export const GROUND = {
  keys: 'oklch(0.4 0.042 190)',
  guide: 'oklch(0.79 0.08 78)',
  ledger: 'oklch(0.48 0.042 262)',
  plan: 'oklch(0.44 0.058 50)',
  network: 'oklch(0.68 0.055 30)',
} as const satisfies Record<WorkThumbKind, string>

export type ThumbKind = WorkThumbKind

/** Warm near-black for shadows, as in the bookshelf. */
export const SHADOW = '#140c08'
