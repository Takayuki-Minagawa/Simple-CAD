import type { Point2D } from './types';
import type { SnapMode } from '@/app/store/editorStore';
import { distance2D, midpoint2D, sub2D, dot2D } from './point';
import { snapPointToGrid } from './transform';
import { segmentIntersection, isDegenerateSegment } from './precision';

export interface SnapCandidate {
  id: string;
  endpoints: Point2D[];
  midpoints: Point2D[];
  /** Edge segments for perpendicular/nearest/intersection snap: pairs [start, end] */
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

/** Axis-aligned bounding box of a segment, expanded by `pad`. */
function segmentBox(a: Point2D, b: Point2D, pad: number) {
  return {
    minX: Math.min(a.x, b.x) - pad,
    maxX: Math.max(a.x, b.x) + pad,
    minY: Math.min(a.y, b.y) - pad,
    maxY: Math.max(a.y, b.y) + pad,
  };
}

function boxesOverlap(
  p: { minX: number; maxX: number; minY: number; maxY: number },
  q: { minX: number; maxX: number; minY: number; maxY: number },
): boolean {
  return p.minX <= q.maxX && p.maxX >= q.minX && p.minY <= q.maxY && p.maxY >= q.minY;
}

interface FlatEdge {
  id: string;
  a: Point2D;
  b: Point2D;
}

/**
 * Collect all candidate edges whose bounding box is near the cursor (within
 * `radius`), used to pre-filter intersection / nearest evaluation and avoid
 * an O(n²) pass over every edge pair in the model.
 */
function collectNearbyEdges(cursor: Point2D, candidates: SnapCandidate[], radius: number): FlatEdge[] {
  const cursorBox = {
    minX: cursor.x - radius,
    maxX: cursor.x + radius,
    minY: cursor.y - radius,
    maxY: cursor.y + radius,
  };
  const edges: FlatEdge[] = [];
  for (const c of candidates) {
    if (!c.edges) continue;
    for (const [a, b] of c.edges) {
      if (isDegenerateSegment(a, b)) continue;
      if (boxesOverlap(segmentBox(a, b, radius), cursorBox)) {
        edges.push({ id: c.id, a, b });
      }
    }
  }
  return edges;
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

  // ── Top-priority tier: endpoint + intersection ──────────────────────────
  // These represent exact structural nodes; if any lies within the snap radius
  // it wins over lower-tier snaps even when a midpoint/edge point is closer.
  let topBest: SnapResult | null = null;
  let topDist = worldRadius;

  if (activeSnapModes.includes('endpoint')) {
    for (const c of candidates) {
      for (const ep of c.endpoints) {
        const d = distance2D(cursor, ep);
        if (d < topDist) {
          topDist = d;
          topBest = { point: ep, type: 'endpoint', sourceId: c.id };
        }
      }
    }
  }

  if (activeSnapModes.includes('intersection')) {
    // Only evaluate pairs of edges near the cursor (bbox pre-filter).
    const nearby = collectNearbyEdges(cursor, candidates, worldRadius);
    for (let i = 0; i < nearby.length; i++) {
      for (let j = i + 1; j < nearby.length; j++) {
        const e1 = nearby[i];
        const e2 = nearby[j];
        const hit = segmentIntersection(e1.a, e1.b, e2.a, e2.b);
        if (!hit) continue;
        const d = distance2D(cursor, hit.point);
        if (d < topDist) {
          topDist = d;
          topBest = { point: hit.point, type: 'intersection', sourceId: e1.id };
        }
      }
    }
  }

  if (topBest) return topBest;

  // ── Lower tiers: midpoint / perpendicular / nearest / grid ──────────────
  let best: SnapResult | null = null;
  let bestDist = worldRadius;

  // Midpoint snap
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

  // Perpendicular snap — snap to the foot of the perpendicular from cursor to each edge
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

  // Nearest snap — snap to the closest point on any edge
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

  // Grid snap (lowest priority)
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

/**
 * Turn construction lines (xline / ray) into clipped pseudo-edge snap
 * candidates so nearest / perpendicular / intersection snapping apply to them.
 *
 * An infinite `xline` is clipped symmetrically around its origin; a `ray` is
 * clipped only in the forward direction. The clip length is large relative to
 * typical building geometry so the pseudo-edge behaves like the underlying
 * (semi-)infinite line for snap purposes, while staying a finite segment that
 * `segmentIntersection` / projection can consume.
 */
export function buildSnapCandidatesFromConstructionLines(
  lines: Array<{
    id: string;
    type: 'xline' | 'ray';
    origin: Point2D;
    direction: Point2D;
  }>,
  clipLength = 1e7,
): SnapCandidate[] {
  const candidates: SnapCandidate[] = [];

  for (const line of lines) {
    const len = Math.hypot(line.direction.x, line.direction.y);
    if (len < 1e-9) continue; // degenerate direction
    const dir = { x: line.direction.x / len, y: line.direction.y / len };

    const forward: Point2D = {
      x: line.origin.x + dir.x * clipLength,
      y: line.origin.y + dir.y * clipLength,
    };
    // xline extends both ways from the origin; ray only forward.
    const back: Point2D =
      line.type === 'ray'
        ? { x: line.origin.x, y: line.origin.y }
        : { x: line.origin.x - dir.x * clipLength, y: line.origin.y - dir.y * clipLength };

    candidates.push({
      id: line.id,
      // The origin is a meaningful endpoint to snap to (start of a ray).
      endpoints: [{ x: line.origin.x, y: line.origin.y }],
      midpoints: [],
      edges: [[back, forward]],
    });
  }

  return candidates;
}
