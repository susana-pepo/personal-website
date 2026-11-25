/**
 * Where the panel sits on wide screens: a floating extension of the room, not a viewport-tall
 * sidebar. It is measured from the room's frame (the painting's box), so it keeps the same
 * proportions at every size and in every section:
 *
 * - popping just out of the room: about 2% of the room's height above it (kept a breath clear
 *   of the scene controls) and about 3% below it;
 * - anchored to the room's right side and reaching past it toward the window's edge (up to
 *   about 5% of the window), for horizontal breathing room;
 * - reaching left to the desk lamp's edge, which lights the glass; within 28rem–50vw;
 * - always inside the window, a margin from every edge.
 *
 * Pure, so it can be tested without a browser. SectionPanel.tsx applies the result as
 * --panel-top / --panel-right / --panel-w / --panel-h (panel-sections.css).
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PanelGeometry {
  top: number;
  /** Distance from the window's right edge to the panel's right edge. */
  right: number;
  width: number;
  height: number;
}

/** Wide screens only: below this the panel keeps its own layouts (tablet width, phone sheet). */
export const ROOM_ANCHORED_FROM = 1025;

const clamp = (min: number, value: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function panelGeometry({
  room,
  lamp,
  controls = null,
  viewport,
  gap,
}: {
  /** The room's frame on screen. */
  room: Box;
  /** The desk lamp's drawing on screen, if it is there. */
  lamp: Box | null;
  /** The scene controls above the room's right corner, if they are there. */
  controls?: Box | null;
  viewport: { width: number; height: number };
  /** The smallest margin to keep from the window's edges. */
  gap: number;
}): PanelGeometry | null {
  const roomWidth = room.right - room.left;
  const roomHeight = room.bottom - room.top;
  if (viewport.width < ROOM_ANCHORED_FROM || roomWidth <= 0 || roomHeight <= 0)
    return null;
  const edge = Math.max(gap, 24);

  // Height: just out of the room, 2% above and 3% below, clear of the scene controls.
  let top = room.top - roomHeight * 0.02;
  if (controls && controls.bottom > controls.top)
    top = Math.max(top, controls.bottom + 20);
  top = Math.max(edge, top);
  const bottom = Math.min(
    viewport.height - edge,
    room.bottom + roomHeight * 0.03,
  );

  // Right edge: past the room toward the window's edge, keeping its margin.
  const outer = Math.min(
    room.right + Math.max(36, viewport.width * 0.05),
    viewport.width - edge,
  );

  // Width: to the lamp's edge (or 42% of the window when there is no lamp), within 28rem and
  // 50% of the window.
  const minWidth = 28 * 16;
  let width =
    lamp && lamp.right > lamp.left ? outer - lamp.right : viewport.width * 0.42;
  width = clamp(minWidth, Math.min(width, viewport.width * 0.5), outer - edge);

  return {
    top: Math.round(top),
    right: Math.round(viewport.width - outer),
    width: Math.round(width),
    height: Math.round(bottom - top),
  };
}
