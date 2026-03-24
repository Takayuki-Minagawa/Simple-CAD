import type { Point2D } from './types';

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
