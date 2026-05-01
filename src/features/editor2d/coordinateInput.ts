import type { Point2D } from '@/domain/geometry/types';

/**
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
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Commas take precedence; otherwise a coordinate pair may be separated by whitespace.
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
      if (!Number.isFinite(dist) || !Number.isFinite(angleDeg)) return null;
      const rad = (angleDeg * Math.PI) / 180;
      const base = lastPoint ?? { x: 0, y: 0 };
      return {
        x: base.x + dist * Math.cos(rad),
        y: base.y + dist * Math.sin(rad),
      };
    }

    // Distance along current preview direction: @distance
    const distanceMatch = rest.match(/^([+-]?\d+\.?\d*)$/);
    if (distanceMatch && lastPoint && previewPoint) {
      const dist = parseFloat(distanceMatch[1]);
      const dx = previewPoint.x - lastPoint.x;
      const dy = previewPoint.y - lastPoint.y;
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(dist) || length === 0) return null;
      return {
        x: lastPoint.x + (dx / length) * dist,
        y: lastPoint.y + (dy / length) * dist,
      };
    }

    // Relative: @dx,dy or @dx dy
    const pair = parsePair(rest);
    if (pair) {
      const [dx, dy] = pair;
      const base = lastPoint ?? { x: 0, y: 0 };
      return { x: base.x + dx, y: base.y + dy };
    }
    return null;
  }

  // Absolute: x,y or x y
  const pair = parsePair(trimmed);
  if (pair) {
    const [x, y] = pair;
    return { x, y };
  }

  return null;
}
