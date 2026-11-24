import type { WorkMap, WorkPlace, WorkProject, WorkTheme } from '../../../content/types'

/**
 * Pure pieces of the Work map, kept apart from the component so they can be
 * tested without a DOM.
 */

export const PLACES: readonly WorkPlace[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

export interface MapArea {
  theme: WorkTheme
  place: WorkPlace
  /** 1-based position in content order, shown as "01". */
  n: number
}

export interface MapOutpost {
  theme: WorkTheme
  n: number
}

/**
 * Each theme with a free quadrant becomes an area of the map, in content order.
 * Anything else (no place, or a quadrant already taken) sits off the map.
 */
export function arrangeField(themes: readonly WorkTheme[]): { areas: MapArea[]; outposts: MapOutpost[] } {
  const taken = new Set<WorkPlace>()
  const areas: MapArea[] = []
  const outposts: MapOutpost[] = []
  themes.forEach((theme, i) => {
    const n = i + 1
    if (theme.place && PLACES.includes(theme.place) && !taken.has(theme.place)) {
      taken.add(theme.place)
      areas.push({ theme, place: theme.place, n })
    } else {
      outposts.push({ theme, n })
    }
  })
  return { areas, outposts }
}

/** Which column the field leans toward while an area is open. */
export function leanFor(place: WorkPlace | null | undefined): 'left' | 'right' | undefined {
  if (!place) return undefined
  return place.endsWith('left') ? 'left' : 'right'
}

/** The two axis words that bound a quadrant: "Music, People". */
export function placeLabel(place: WorkPlace, axes: WorkMap['axes']): string {
  const vertical = place.startsWith('top') ? axes.top : axes.bottom
  const horizontal = place.endsWith('left') ? axes.left : axes.right
  return `${vertical}, ${horizontal}`
}

/** One sentence describing the map for screen readers. */
export function mapDescription(axes: WorkMap['axes']): string {
  return `Arranged on two axes: ${axes.top} to ${axes.bottom}, and ${axes.left} to ${axes.right}.`
}

/**
 * Arrow keys move between quadrants as they sit on the page. Moving off an
 * edge goes nowhere (null), like a map, rather than wrapping round.
 */
export function neighbour(place: WorkPlace, key: string): WorkPlace | null {
  const [row, col] = place.split('-') as ['top' | 'bottom', 'left' | 'right']
  switch (key) {
    case 'ArrowLeft':
      return col === 'right' ? `${row}-left` : null
    case 'ArrowRight':
      return col === 'left' ? `${row}-right` : null
    case 'ArrowUp':
      return row === 'bottom' ? `top-${col}` : null
    case 'ArrowDown':
      return row === 'top' ? `bottom-${col}` : null
    default:
      return null
  }
}

/** Where a project sits on the map: the place of its area, if that area is on the map. */
export function projectPlace(project: WorkProject, areas: readonly MapArea[]): WorkPlace | undefined {
  if (!project.area) return undefined
  return areas.find((a) => a.theme.id === project.area)?.place
}

/** The projects made in one area, in content order. */
export function projectsIn(areaId: string, projects: readonly WorkProject[]): WorkProject[] {
  return projects.filter((p) => p.area === areaId)
}
