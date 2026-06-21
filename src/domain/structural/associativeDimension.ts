import type { ProjectData, Member } from './types';
import type { Point2D } from '@/domain/geometry/types';
import { distance2D } from '@/domain/geometry/point';

/**
 * Associative dimensions (2-8).
 *
 * A dimension flagged `associative` with `refMemberIds` re-snaps its endpoints
 * to the nearest endpoints of the referenced members. Calling this after a
 * member edit makes the dimension follow the member, keeping the drawn value in
 * agreement with the real geometry.
 */

function memberEndpoints(m: Member): Point2D[] {
  if (m.type === 'slab') return m.polygon.map((p) => ({ x: p.x, y: p.y }));
  return [
    { x: m.start.x, y: m.start.y },
    { x: m.end.x, y: m.end.y },
  ];
}

function nearest(points: Point2D[], to: Point2D): Point2D {
  let best = to;
  let bestD = Infinity;
  for (const p of points) {
    const d = distance2D(p, to);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Re-snap associative dimension endpoints to the referenced members' endpoints.
 * Pure: returns the same reference when there is nothing to recompute.
 */
export function recomputeAssociativeDimensions(data: ProjectData): ProjectData {
  if (!data.dimensions.some((d) => d.associative && d.refMemberIds?.length)) return data;
  const memberById = new Map(data.members.map((m) => [m.id, m]));

  const dimensions = data.dimensions.map((d) => {
    if (!d.associative || !d.refMemberIds?.length) return d;
    const pts: Point2D[] = [];
    for (const id of d.refMemberIds) {
      const m = memberById.get(id);
      if (m) pts.push(...memberEndpoints(m));
    }
    if (pts.length === 0) return d;
    return { ...d, start: nearest(pts, d.start), end: nearest(pts, d.end) };
  });

  return { ...data, dimensions };
}
