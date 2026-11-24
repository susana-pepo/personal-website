/** Ids of the shared SVG definitions rendered once by <ShelfDefs />. */
export const DEF = {
  cloth: 'bs-tx-cloth',
  paper: 'bs-tx-paper',
  leather: 'bs-tx-leather',
  wood: 'bs-tx-wood',
  wear: 'bs-wear',
  stamp: 'bs-stamp',
  gilt: 'bs-gilt',
  round: 'bs-round',
  flat: 'bs-flat',
  fade: 'bs-fade',
  coverLight: 'bs-cover-light',
  boardLight: 'bs-board-light',
  iron: 'bs-iron',
} as const

export const url = (id: string) => `url(#${id})`

/** Warm near-black and lamp white used for shading inside the drawings. */
export const DARK = '#140c08'
export const LAMP = '#fff4e2'
export const WORN = 'oklch(0.95 0.012 80)'

/** useId() output is not always a valid url(#…) fragment; keep it to safe characters. */
export const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '')

export const r2 = (n: number) => Math.round(n * 100) / 100
