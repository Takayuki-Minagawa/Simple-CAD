import type { Point2D } from './types';
import { GEOM_EPSILON, equals2D, pointKey2D, segmentIntersection } from './precision';

/**
 * Compute the area of a polygon using the Shoelace formula.
 * Returns absolute area (always positive).
 */
export function polygonArea(points: Point2D[]): number {
  const n = points.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += points[i].x * points[j].y;
    sum -= points[j].x * points[i].y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Signed area of a polygon (Shoelace formula). Positive when the vertices wind
 * counter-clockwise, negative when clockwise. Useful for orientation/degeneracy
 * checks where the sign matters (unlike {@link polygonArea}).
 */
export function polygonSignedArea(points: Point2D[]): number {
  const n = points.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += points[i].x * points[j].y;
    sum -= points[j].x * points[i].y;
  }
  return sum / 2;
}

/**
 * A polygon is degenerate when it has fewer than 3 vertices or encloses
 * (effectively) zero area — i.e. all vertices are collinear/coincident.
 */
export function isDegenerate(points: Point2D[], eps: number = GEOM_EPSILON): boolean {
  if (points.length < 3) return true;
  return Math.abs(polygonSignedArea(points)) <= eps;
}

/**
 * True when two or more vertices coincide (within `eps`) after quantization.
 * Adjacent or non-adjacent duplicates are both reported.
 */
export function hasDuplicateVertices(points: Point2D[], eps: number = GEOM_EPSILON): boolean {
  const seen = new Set<string>();
  for (const p of points) {
    const key = pointKey2D(p);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  // Quantized keys catch exact/near-grid duplicates; do a final epsilon sweep for
  // points that straddle a quantization boundary.
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (equals2D(points[i], points[j], eps)) return true;
    }
  }
  return false;
}

/**
 * A simple polygon has no self-intersections: no pair of non-adjacent edges
 * crosses. Returns false for degenerate (<3 vertices) input.
 *
 * Treats the vertex list as a closed ring (last → first edge included).
 */
export function isSimplePolygon(points: Point2D[], eps: number = GEOM_EPSILON): boolean {
  const n = points.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Skip adjacent edges (they legitimately share a vertex) and the wrap pair.
      if (j === i) continue;
      const adjacent = j === (i + 1) % n || (i === 0 && j === n - 1);
      if (adjacent) continue;
      const c = points[j];
      const d = points[(j + 1) % n];
      if (segmentIntersection(a, b, c, d, true, eps)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Compute the perimeter of a polygon.
 */
export function polygonPerimeter(points: Point2D[]): number {
  const n = points.length;
  if (n < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}

/**
 * Compute the length of a linear member from start to end (2D).
 */
export function linearLength(start: Point2D, end: Point2D): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.sqrt(dx * dx + dy * dy);
}
