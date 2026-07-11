import type { Point3D } from '@/domain/geometry/types';
import type { LocalAxisDefinition } from './types';

export interface MemberLocalAxes {
  /** Cross-section local x-axis. */
  x: Point3D;
  /** Cross-section local y-axis. */
  y: Point3D;
  /** Member/extrusion local z-axis (start to end). */
  z: Point3D;
}

/**
 * Resolve a stable right-handed member basis shared by IFC and the 3D viewer.
 * `referenceVector` defines local y after projection normal to the member, and
 * localAxis.rotation is additive to the legacy member.rotation roll.
 */
export function resolveMemberLocalAxes(
  start: Point3D,
  end: Point3D,
  memberRotation = 0,
  localAxis?: LocalAxisDefinition,
): MemberLocalAxes {
  const z = normalize(subtract(end, start), { x: 0, y: 0, z: 1 });
  let y: Point3D;

  if (localAxis?.referenceVector) {
    y = projectedNormal(localAxis.referenceVector, z);
  } else if (Math.abs(z.z) > 0.999) {
    const x = projectedNormal({ x: 1, y: 0, z: 0 }, z);
    y = normalize(cross(z, x), { x: 0, y: 1, z: 0 });
  } else {
    y = projectedNormal({ x: 0, y: 0, z: 1 }, z);
  }

  let x = normalize(cross(y, z), { x: 1, y: 0, z: 0 });
  y = normalize(cross(z, x), y);
  const roll = memberRotation + (localAxis?.rotation ?? 0);
  if (roll) {
    const baseX = x;
    const baseY = y;
    const cos = Math.cos(roll);
    const sin = Math.sin(roll);
    x = add(scale(baseX, cos), scale(baseY, sin));
    y = add(scale(baseY, cos), scale(baseX, -sin));
  }
  return { x: normalize(x, x), y: normalize(y, y), z };
}

/** Recover legacy roll from an IFC local-x direction against the default basis. */
export function recoverMemberRoll(
  start: Point3D,
  end: Point3D,
  actualLocalX: Point3D,
): number {
  const base = resolveMemberLocalAxes(start, end);
  const x = normalize(actualLocalX, base.x);
  return Math.atan2(dot(x, base.y), dot(x, base.x));
}

function projectedNormal(vector: Point3D, axis: Point3D): Point3D {
  const projected = add(vector, scale(axis, -dot(vector, axis)));
  if (length(projected) > 1e-9) return normalize(projected, { x: 0, y: 1, z: 0 });
  const fallback = Math.abs(axis.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  return normalize(add(fallback, scale(axis, -dot(fallback, axis))), fallback);
}

function subtract(a: Point3D, b: Point3D): Point3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: Point3D, b: Point3D): Point3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(vector: Point3D, scalar: number): Point3D {
  return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar };
}

function dot(a: Point3D, b: Point3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Point3D, b: Point3D): Point3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function length(vector: Point3D): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize(vector: Point3D, fallback: Point3D): Point3D {
  const magnitude = length(vector);
  return magnitude > 1e-12 ? scale(vector, 1 / magnitude) : fallback;
}
