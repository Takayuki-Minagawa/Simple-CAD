import type { Point2D } from '@/domain/geometry/types';
import type { Transform3D, Vector3 } from './types';

export const DEFAULT_TRANSFORM: Transform3D = {
  origin: { x: 0, y: 0, z: 0 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
  zAxis: { x: 0, y: 0, z: 1 },
};

export function applyTransform2D(transform: Transform3D, point: Point2D): Point2D {
  const world = add3(
    transform.origin,
    add3(scale3(transform.xAxis, point.x), scale3(transform.yAxis, point.y)),
  );
  return { x: world.x, y: world.y };
}

export function composeTransform(parent: Transform3D, child: Transform3D): Transform3D {
  return {
    origin: add3(
      parent.origin,
      add3(
        add3(scale3(parent.xAxis, child.origin.x), scale3(parent.yAxis, child.origin.y)),
        scale3(parent.zAxis, child.origin.z),
      ),
    ),
    xAxis: transformDirection(parent, child.xAxis),
    yAxis: transformDirection(parent, child.yAxis),
    zAxis: transformDirection(parent, child.zAxis),
  };
}

function transformDirection(transform: Transform3D, vector: Vector3): Vector3 {
  return normalize3(
    add3(
      add3(scale3(transform.xAxis, vector.x), scale3(transform.yAxis, vector.y)),
      scale3(transform.zAxis, vector.z),
    ),
  );
}

export function defaultRefDirection(axis: Vector3): Vector3 {
  if (Math.abs(axis.z) > 0.99) {
    return { x: 1, y: 0, z: 0 };
  }
  return normalize3(cross3({ x: 0, y: 0, z: 1 }, axis));
}

export function perpendicularHorizontal(direction: Vector3): Vector3 {
  const result = cross3({ x: 0, y: 0, z: 1 }, direction);
  const length = length3(result);
  if (length < 1e-6) return { x: 1, y: 0, z: 0 };
  return normalize3(result);
}

export function add3(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub3(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale3(vector: Vector3, scalar: number): Vector3 {
  return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar };
}

export function cross3(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function length3(vector: Vector3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function normalize3(vector: Vector3): Vector3 {
  const length = length3(vector);
  if (length < 1e-9) return { x: 1, y: 0, z: 0 };
  return scale3(vector, 1 / length);
}

export function distance3(a: Vector3, b: Vector3): number {
  return length3(sub3(a, b));
}
