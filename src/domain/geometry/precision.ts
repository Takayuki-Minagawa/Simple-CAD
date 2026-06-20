import type { Point2D, Point3D } from './types';

/**
 * Shared numeric-precision policy for the whole CAD domain.
 *
 * Floating-point results from polar/relative coordinate entry, rotations and
 * import scaling accumulate tiny errors (e.g. 100 * cos(30°) = 86.6025403…).
 * Quantizing to a fixed grid and comparing with a shared epsilon keeps the JSON
 * "single source of truth" reproducible and makes equality / node-sharing
 * decisions stable across the app.
 */

/** General-purpose epsilon for geometric equality comparisons (in mm). */
export const GEOM_EPSILON = 1e-6;

/** Default quantization step for stored coordinates (mm). 0.001mm = 1µm. */
export const COORD_PRECISION = 1e-3;

/** Default angular epsilon (radians). */
export const ANGLE_EPSILON = 1e-9;

/** Round a value to the nearest multiple of `step`, normalizing -0 to 0. */
export function quantize(value: number, step: number = COORD_PRECISION): number {
  if (!Number.isFinite(value) || step <= 0) return value;
  const q = Math.round(value / step) * step;
  // Avoid -0 and trailing FP noise from the division.
  const normalized = q === 0 ? 0 : q;
  // Re-round to the decimal precision implied by `step` to clear FP residue.
  const decimals = Math.max(0, Math.round(-Math.log10(step)));
  return Number(normalized.toFixed(Math.min(decimals, 12)));
}

export function quantizePoint2D(p: Point2D, step: number = COORD_PRECISION): Point2D {
  return { x: quantize(p.x, step), y: quantize(p.y, step) };
}

export function quantizePoint3D(p: Point3D, step: number = COORD_PRECISION): Point3D {
  return { x: quantize(p.x, step), y: quantize(p.y, step), z: quantize(p.z, step) };
}

/** Approximate scalar equality within `eps`. */
export function approxEqual(a: number, b: number, eps: number = GEOM_EPSILON): boolean {
  return Math.abs(a - b) <= eps;
}

export function equals2D(a: Point2D, b: Point2D, eps: number = GEOM_EPSILON): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

export function equals3D(a: Point3D, b: Point3D, eps: number = GEOM_EPSILON): boolean {
  return (
    Math.abs(a.x - b.x) <= eps &&
    Math.abs(a.y - b.y) <= eps &&
    Math.abs(a.z - b.z) <= eps
  );
}

/**
 * Stable string key for a 2D point, quantized so near-coincident points map to
 * the same key (used for node merging / deduplication).
 */
export function pointKey2D(p: Point2D, step: number = COORD_PRECISION): string {
  return `${quantize(p.x, step)}:${quantize(p.y, step)}`;
}

/**
 * Stable string key for a 3D point, quantized to a tolerance so near-coincident
 * structural nodes share the same key instead of splitting the analysis model.
 */
export function pointKey3D(p: Point3D, step: number = COORD_PRECISION): string {
  return `${quantize(p.x, step)}:${quantize(p.y, step)}:${quantize(p.z, step)}`;
}

export interface SegmentIntersection {
  point: Point2D;
  /** Parameter along segment 1 (a→b). */
  t: number;
  /** Parameter along segment 2 (c→d). */
  u: number;
}

/**
 * Intersection of segment a→b with segment c→d.
 *
 * Returns null when the segments are parallel/degenerate or (when `withinBounds`)
 * the crossing lies outside either segment. With `withinBounds=false` the
 * "apparent intersection" of the infinite lines is returned instead.
 */
export function segmentIntersection(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D,
  withinBounds = true,
  eps: number = GEOM_EPSILON,
): SegmentIntersection | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < eps) return null; // parallel or degenerate

  const qp = { x: c.x - a.x, y: c.y - a.y };
  const t = (qp.x * s.y - qp.y * s.x) / denom;
  const u = (qp.x * r.y - qp.y * r.x) / denom;

  if (withinBounds && (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps)) {
    return null;
  }
  return { point: { x: a.x + r.x * t, y: a.y + r.y * t }, t, u };
}

/** A segment is degenerate when its endpoints are coincident within `eps`. */
export function isDegenerateSegment(a: Point2D, b: Point2D, eps: number = GEOM_EPSILON): boolean {
  return equals2D(a, b, eps);
}
