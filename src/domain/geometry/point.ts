import type { Point2D, Point3D } from './types';

export function add2D(a: Point2D, b: Point2D): Point2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub2D(a: Point2D, b: Point2D): Point2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale2D(p: Point2D, s: number): Point2D {
  return { x: p.x * s, y: p.y * s };
}

export function distance2D(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function midpoint2D(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function length2D(p: Point2D): number {
  return Math.sqrt(p.x * p.x + p.y * p.y);
}

export function normalize2D(p: Point2D): Point2D {
  const len = length2D(p);
  if (len === 0) return { x: 0, y: 0 };
  return { x: p.x / len, y: p.y / len };
}

export function perpendicular2D(p: Point2D): Point2D {
  return { x: -p.y, y: p.x };
}

export function dot2D(a: Point2D, b: Point2D): number {
  return a.x * b.x + a.y * b.y;
}

// ── 3D ──

export function distance3D(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function midpoint3D(a: Point3D, b: Point3D): Point3D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}
