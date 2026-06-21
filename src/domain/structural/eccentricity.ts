/**
 * Canonical axis-line eccentricity (2-6) resolution shared by the 2D plan,
 * the 3D viewer and the IFC exporter so the SAME JSON places a member at the
 * SAME spot in every representation.
 *
 * Convention for linear members (beam/wall): the offset lies in the member's
 * cross-section plane — there is no along-axis component (that would be a
 * translation, not an eccentricity).
 *   - `dx` = horizontal, in-plan, perpendicular to the member axis
 *            (left-hand perpendicular of the start→end plan direction)
 *   - `dy` = vertical (global +Z)
 *
 * Columns have no in-plan axis (start/end differ only in elevation), so their
 * cross-section lies in the world XY plane and the offset maps directly:
 *   - `dx` → world X, `dy` → world Y
 */

export interface AxisOffset {
  dx: number;
  dy: number;
}

export interface WorldDelta {
  x: number;
  y: number;
  z: number;
}

const ZERO: WorldDelta = { x: 0, y: 0, z: 0 };

function isZero(offset: AxisOffset | undefined): offset is undefined {
  return !offset || (offset.dx === 0 && offset.dy === 0);
}

/**
 * Eccentricity for a member with an in-plan axis (beam/wall).
 * `dx` is applied along the in-plan left-hand perpendicular of start→end,
 * `dy` along global +Z. Returns a world-space delta.
 */
export function linearAxisOffsetToWorld(
  offset: AxisOffset | undefined,
  start: { x: number; y: number },
  end: { x: number; y: number },
): WorldDelta {
  if (isZero(offset)) return ZERO;
  const ax = end.x - start.x;
  const ay = end.y - start.y;
  const len = Math.hypot(ax, ay);
  if (len === 0) {
    // Degenerate plan direction: treat like a column (dx→x, dy→y).
    return { x: offset.dx, y: offset.dy, z: 0 };
  }
  const ux = ax / len;
  const uy = ay / len;
  // In-plan left-hand perpendicular to the axis.
  const px = -uy;
  const py = ux;
  return { x: px * offset.dx, y: py * offset.dx, z: offset.dy };
}

/** Eccentricity for a column: cross-section lies in world XY, dx→x, dy→y. */
export function columnAxisOffsetToWorld(offset: AxisOffset | undefined): WorldDelta {
  if (isZero(offset)) return ZERO;
  return { x: offset.dx, y: offset.dy, z: 0 };
}
