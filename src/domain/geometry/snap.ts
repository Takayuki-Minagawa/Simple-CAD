import type { Point2D } from './types';
import type { SnapMode } from '@/app/store/editorStore';
import { distance2D, midpoint2D, sub2D, dot2D } from './point';
import { snapPointToGrid } from './transform';

export interface SnapCandidate {
  id: string;
  endpoints: Point2D[];
  midpoints: Point2D[];
  /** Edge segments for perpendicular/nearest snap: pairs [start, end] */
  edges?: Array<[Point2D, Point2D]>;
}

export interface SnapResult {
  point: Point2D;
  type: SnapMode;
  sourceId?: string;
}

/**
 * Project cursor onto segment a-b, returning the closest point on the segment
 * and the parameter t in [0,1].
 */
function projectPointOnSegment(cursor: Point2D, a: Point2D, b: Point2D): { point: Point2D; t: number } {
  const ab = sub2D(b, a);
  const ac = sub2D(cursor, a);
  const lenSq = ab.x * ab.x + ab.y * ab.y;
  if (lenSq < 1e-20) return { point: a, t: 0 };
  const t = Math.max(0, Math.min(1, dot2D(ac, ab) / lenSq));
  return {
    point: { x: a.x + ab.x * t, y: a.y + ab.y * t },
    t,
  };
}

export function findSnap(
  cursor: Point2D,
  candidates: SnapCandidate[],
  activeSnapModes: SnapMode[],
  gridSpacing: number,
  snapRadius: number,
  zoom: number,
): SnapResult | null {
  const worldRadius = snapRadius / zoom;
  let best: SnapResult | null = null;
  let bestDist = worldRadius;

  // 1. Endpoint snap (highest priority)
  if (activeSnapModes.includes('endpoint')) {
    for (const c of candidates) {
      for (const ep of c.endpoints) {
        const d = distance2D(cursor, ep);
        if (d < bestDist) {
          bestDist = d;
          best = { point: ep, type: 'endpoint', sourceId: c.id };
        }
      }
    }
  }

  // 2. Midpoint snap
  if (activeSnapModes.includes('midpoint')) {
    for (const c of candidates) {
      for (const mp of c.midpoints) {
        const d = distance2D(cursor, mp);
        if (d < bestDist) {
          bestDist = d;
          best = { point: mp, type: 'midpoint', sourceId: c.id };
        }
      }
    }
  }

  // 3. Perpendicular snap — snap to the foot of the perpendicular from cursor to each edge
  if (activeSnapModes.includes('perpendicular')) {
    for (const c of candidates) {
      if (!c.edges) continue;
      for (const [a, b] of c.edges) {
        const proj = projectPointOnSegment(cursor, a, b);
        // Only consider if the perpendicular foot is interior to the segment (not at endpoints)
        if (proj.t > 0.01 && proj.t < 0.99) {
          const d = distance2D(cursor, proj.point);
          if (d < bestDist) {
            bestDist = d;
            best = { point: proj.point, type: 'perpendicular', sourceId: c.id };
          }
        }
      }
    }
  }

  // 4. Nearest snap — snap to the closest point on any edge
  if (activeSnapModes.includes('nearest') && !best) {
    for (const c of candidates) {
      if (!c.edges) continue;
      for (const [a, b] of c.edges) {
        const proj = projectPointOnSegment(cursor, a, b);
        const d = distance2D(cursor, proj.point);
        if (d < bestDist) {
          bestDist = d;
          best = { point: proj.point, type: 'nearest', sourceId: c.id };
        }
      }
    }
  }

  // 5. Grid snap (lowest priority)
  if (activeSnapModes.includes('grid') && !best) {
    const snapped = snapPointToGrid(cursor, gridSpacing);
    const d = distance2D(cursor, snapped);
    if (d < worldRadius) {
      best = { point: snapped, type: 'grid' };
    }
  }

  return best;
}

/**
 * Build snap candidates from members for the active story.
 */
export function buildSnapCandidatesFromMembers(
  members: Array<{
    id: string;
    type: string;
    start?: Point2D;
    end?: Point2D;
    polygon?: Point2D[];
  }>,
): SnapCandidate[] {
  const candidates: SnapCandidate[] = [];

  for (const m of members) {
    const endpoints: Point2D[] = [];
    const midpoints: Point2D[] = [];
    const edges: Array<[Point2D, Point2D]> = [];

    if (m.start && m.end) {
      const s: Point2D = { x: m.start.x, y: m.start.y };
      const e: Point2D = { x: m.end.x, y: m.end.y };
      endpoints.push(s);
      endpoints.push(e);
      midpoints.push(midpoint2D(s, e));
      edges.push([s, e]);
    }
    if (m.polygon) {
      for (const p of m.polygon) {
        endpoints.push(p);
      }
      for (let i = 0; i < m.polygon.length; i++) {
        const next = m.polygon[(i + 1) % m.polygon.length];
        midpoints.push(midpoint2D(m.polygon[i], next));
        edges.push([m.polygon[i], next]);
      }
    }

    if (endpoints.length > 0) {
      candidates.push({ id: m.id, endpoints, midpoints, edges });
    }
  }

  return candidates;
}
