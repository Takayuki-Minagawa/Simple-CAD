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

function nearestDistinctPair(
  points: Point2D[],
  start: Point2D,
  end: Point2D,
): { start: Point2D; end: Point2D } | null {
  const unique = [...new Map(points.map((point) => [`${point.x}\u0000${point.y}`, point])).values()];
  if (unique.length < 2) return null;

  const twoNearest = (target: Point2D) => {
    let first = { index: -1, distance: Infinity };
    let second = { index: -1, distance: Infinity };
    for (let index = 0; index < unique.length; index += 1) {
      const distance = distance2D(unique[index], target);
      if (distance < first.distance) {
        second = first;
        first = { index, distance };
      } else if (distance < second.distance) {
        second = { index, distance };
      }
    }
    return { first, second };
  };

  const startNearest = twoNearest(start);
  const endNearest = twoNearest(end);
  if (startNearest.first.index !== endNearest.first.index) {
    return {
      start: unique[startNearest.first.index],
      end: unique[endNearest.first.index],
    };
  }

  const keepStartBest = startNearest.first.distance + endNearest.second.distance;
  const keepEndBest = startNearest.second.distance + endNearest.first.distance;
  return keepStartBest <= keepEndBest
    ? { start: unique[startNearest.first.index], end: unique[endNearest.second.index] }
    : { start: unique[startNearest.second.index], end: unique[endNearest.first.index] };
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
    const snapped = nearestDistinctPair(pts, d.start, d.end);
    // A valid member normally provides at least two distinct points. If a
    // legacy/partial reference does not, keep the previous valid dimension
    // instead of collapsing start and end to the same coordinate.
    return snapped ? { ...d, ...snapped } : d;
  });

  return { ...data, dimensions };
}
