import type { Point2D } from '@/domain/geometry/types';

/**
 * Failure reason for coordinate parsing (used by validation feedback UI, 4-5).
 */
export type CoordinateParseError =
  | 'empty'
  | 'invalid-pair'
  | 'invalid-polar'
  | 'no-direction'
  | 'unparseable';

export type CoordinateParseResult =
  | { ok: true; point: Point2D }
  | { ok: false; error: CoordinateParseError };

/**
 * Parses coordinate input and returns a Result with a failure reason.
 * Formats:
 * - "x,y" or "x y"        -> absolute coordinate
 * - "@dx,dy" or "@dx dy"  -> relative to lastPoint
 * - "@dist<angle" -> polar relative to lastPoint (angle in degrees)
 * - "@dist" -> relative to lastPoint along the current preview direction
 */
export function parseCoordinateResult(
  input: string,
  lastPoint: Point2D | null,
  previewPoint: Point2D | null = null,
): CoordinateParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'empty' };

  const parsePair = (value: string): [number, number] | null => {
    const parts = value.includes(',') ? value.split(',') : value.trim().split(/\s+/);
    if (parts.length !== 2) return null;
    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [x, y];
  };

  if (trimmed.startsWith('@')) {
    const rest = trimmed.slice(1);

    // Polar: @distance<angle
    const polarMatch = rest.match(/^([+-]?\d+\.?\d*)\s*<\s*([+-]?\d+\.?\d*)$/);
    if (polarMatch) {
      const dist = parseFloat(polarMatch[1]);
      const angleDeg = parseFloat(polarMatch[2]);
      if (!Number.isFinite(dist) || !Number.isFinite(angleDeg)) {
        return { ok: false, error: 'invalid-polar' };
      }
      const rad = (angleDeg * Math.PI) / 180;
      const base = lastPoint ?? { x: 0, y: 0 };
      return {
        ok: true,
        point: { x: base.x + dist * Math.cos(rad), y: base.y + dist * Math.sin(rad) },
      };
    }

    // Distance along current preview direction: @distance
    const distanceMatch = rest.match(/^([+-]?\d+\.?\d*)$/);
    if (distanceMatch) {
      if (!lastPoint || !previewPoint) return { ok: false, error: 'no-direction' };
      const dist = parseFloat(distanceMatch[1]);
      const dx = previewPoint.x - lastPoint.x;
      const dy = previewPoint.y - lastPoint.y;
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(dist) || length === 0) return { ok: false, error: 'no-direction' };
      return {
        ok: true,
        point: { x: lastPoint.x + (dx / length) * dist, y: lastPoint.y + (dy / length) * dist },
      };
    }

    // Relative: @dx,dy or @dx dy
    const pair = parsePair(rest);
    if (pair) {
      const [dx, dy] = pair;
      const base = lastPoint ?? { x: 0, y: 0 };
      return { ok: true, point: { x: base.x + dx, y: base.y + dy } };
    }
    return { ok: false, error: 'invalid-pair' };
  }

  // Absolute: x,y or x y
  const pair = parsePair(trimmed);
  if (pair) {
    const [x, y] = pair;
    return { ok: true, point: { x, y } };
  }

  return { ok: false, error: 'unparseable' };
}

/**
 * Backwards-compatible wrapper returning the parsed point or null.
 * Parses coordinate input in three formats:
 * - "x,y" or "x y"        -> absolute coordinate
 * - "@dx,dy" or "@dx dy"  -> relative to lastPoint
 * - "@dist<angle" -> polar relative to lastPoint (angle in degrees)
 * - "@dist" -> relative to lastPoint along the current preview direction
 */
export function parseCoordinate(
  input: string,
  lastPoint: Point2D | null,
  previewPoint: Point2D | null = null,
): Point2D | null {
  const result = parseCoordinateResult(input, lastPoint, previewPoint);
  return result.ok ? result.point : null;
}

/** Build a polar input string for length+angle dynamic input (degrees). */
export function buildPolarInput(length: number, angleDeg: number): string {
  return `@${length}<${angleDeg}`;
}
