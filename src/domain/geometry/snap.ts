import type { Point2D } from './types';
import type { SnapMode } from '@/app/store/editorStore';
import { distance2D, midpoint2D } from './point';
import { snapPointToGrid } from './transform';

export interface SnapCandidate {
  id: string;
  endpoints: Point2D[];
  midpoints: Point2D[];
}

export interface SnapResult {
  point: Point2D;
  type: SnapMode;
  sourceId?: string;
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

  // 3. Grid snap (lowest priority)
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

    if (m.start && m.end) {
      endpoints.push({ x: m.start.x, y: m.start.y });
      endpoints.push({ x: m.end.x, y: m.end.y });
      midpoints.push(midpoint2D({ x: m.start.x, y: m.start.y }, { x: m.end.x, y: m.end.y }));
    }
    if (m.polygon) {
      for (const p of m.polygon) {
        endpoints.push(p);
      }
      for (let i = 0; i < m.polygon.length; i++) {
        const next = m.polygon[(i + 1) % m.polygon.length];
        midpoints.push(midpoint2D(m.polygon[i], next));
      }
    }

    if (endpoints.length > 0) {
      candidates.push({ id: m.id, endpoints, midpoints });
    }
  }

  return candidates;
}
