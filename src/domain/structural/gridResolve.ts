import type { Grid, Member, ProjectData } from './types';
import type { Point2D } from '@/domain/geometry/types';
import { quantize } from '@/domain/geometry/precision';
import { isLinearMember } from './types';

/**
 * Grid-reference resolution (通り芯基準配置).
 *
 * Convention (matches GridLayer/GridHelper3D):
 *  - axis 'X' grids are vertical lines at x = position
 *  - axis 'Y' grids are horizontal lines at y = position
 * The intersection of an X-grid and a Y-grid is { x: xGrid.position, y: yGrid.position }.
 *
 * A member's `gridRef` pins its endpoints to named grid-axis intersections so
 * that editing a grid's position moves the dependent members, keeping drawn
 * dimensions and real members in agreement.
 */

function byName(grids: Grid[]): Map<string, Grid> {
  const map = new Map<string, Grid>();
  for (const g of grids) map.set(g.name, g);
  return map;
}

/**
 * Resolve the intersection point of two named grid axes. The pair may be given
 * in either order (X-then-Y or Y-then-X); axes are assigned by each grid's axis.
 * Returns null when either name is unknown or both grids share the same axis.
 */
export function gridIntersection(
  grids: Grid[],
  nameA: string,
  nameB: string,
): Point2D | null {
  return gridIntersectionFromMap(byName(grids), nameA, nameB);
}

function gridIntersectionFromMap(
  map: Map<string, Grid>,
  nameA: string,
  nameB: string,
): Point2D | null {
  const a = map.get(nameA);
  const b = map.get(nameB);
  if (!a || !b || a.axis === b.axis) return null;
  const xGrid = a.axis === 'X' ? a : b;
  const yGrid = a.axis === 'Y' ? a : b;
  return { x: xGrid.position, y: yGrid.position };
}

/**
 * Compute resolved start/end coordinates for a member from its gridRef.
 * Returns null when the member has no usable gridRef or the grids are unknown.
 * z is preserved from the member's existing endpoints.
 */
export function resolveMemberEndpoints(
  member: Member,
  gridMap: Map<string, Grid>,
): { start?: Point2D; end?: Point2D } | null {
  const ref = member.gridRef;
  if (!ref) return null;
  const out: { start?: Point2D; end?: Point2D } = {};
  if (ref.startGrid) {
    const p = gridIntersectionFromMap(gridMap, ref.startGrid[0], ref.startGrid[1]);
    if (p) out.start = p;
  }
  if (ref.endGrid) {
    const p = gridIntersectionFromMap(gridMap, ref.endGrid[0], ref.endGrid[1]);
    if (p) out.end = p;
  }
  return out.start || out.end ? out : null;
}

/**
 * Re-resolve every gridRef-pinned member's geometry from the current grids.
 * Pure: returns a new ProjectData with updated member coordinates. Members
 * without a gridRef (or with unresolvable refs) are returned unchanged.
 */
export function applyGridGeometry(data: ProjectData): ProjectData {
  if (!data.members.some((m) => m.gridRef)) return data;
  const gridMap = byName(data.grids);

  const members = data.members.map((m): Member => {
    if (!m.gridRef || !isLinearMember(m)) return m;
    const resolved = resolveMemberEndpoints(m, gridMap);
    if (!resolved) return m;
    const next = { ...m };
    if (resolved.start) {
      next.start = {
        x: quantize(resolved.start.x),
        y: quantize(resolved.start.y),
        z: m.start.z,
      };
    }
    if (resolved.end) {
      next.end = {
        x: quantize(resolved.end.x),
        y: quantize(resolved.end.y),
        z: m.end.z,
      };
    }
    return next;
  });

  return { ...data, members };
}
