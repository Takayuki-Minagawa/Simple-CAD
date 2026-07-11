import type { Point2D, Point3D } from '@/domain/geometry/types';
import type { Profile, Transform3D, Vector3, ResolvedSolid } from './types';

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

/** Exact/axis-aligned-safe world Z extents of an extruded IFC profile. */
export function resolvedSolidZExtents(solid: ResolvedSolid): { min: number; max: number } {
  const bounds = resolvedSolidWorldBounds(solid);
  return { min: bounds.min.z, max: bounds.max.z };
}

export function resolvedSolidWorldBounds(
  solid: ResolvedSolid,
): { min: Point3D; max: Point3D } {
  if (solid.profile.kind === 'hollowCircle') {
    return resolvedHollowCircleBounds({ ...solid, profile: solid.profile });
  }
  const profilePoints = profileExtentPoints(solid.profile).map((point) => {
    const placement = solid.profile.placement;
    if (!placement) return point;
    return {
      x:
        placement.origin.x +
        placement.xAxis.x * point.x +
        placement.yAxis.x * point.y,
      y:
        placement.origin.y +
        placement.xAxis.y * point.x +
        placement.yAxis.y * point.y,
    };
  });
  if (profilePoints.length === 0) {
    const end = add3(solid.transform.origin, scale3(solid.transform.zAxis, solid.depth));
    return {
      min: {
        x: Math.min(solid.transform.origin.x, end.x),
        y: Math.min(solid.transform.origin.y, end.y),
        z: Math.min(solid.transform.origin.z, end.z),
      },
      max: {
        x: Math.max(solid.transform.origin.x, end.x),
        y: Math.max(solid.transform.origin.y, end.y),
        z: Math.max(solid.transform.origin.z, end.z),
      },
    };
  }
  const values: Point3D[] = [];
  for (const point of profilePoints) {
    for (const depth of [0, solid.depth]) {
      values.push(
        add3(
          solid.transform.origin,
          add3(
            add3(
              scale3(solid.transform.xAxis, point.x),
              scale3(solid.transform.yAxis, point.y),
            ),
            scale3(solid.transform.zAxis, depth),
          ),
        ),
      );
    }
  }
  return {
    min: {
      x: Math.min(...values.map((point) => point.x)),
      y: Math.min(...values.map((point) => point.y)),
      z: Math.min(...values.map((point) => point.z)),
    },
    max: {
      x: Math.max(...values.map((point) => point.x)),
      y: Math.max(...values.map((point) => point.y)),
      z: Math.max(...values.map((point) => point.z)),
    },
  };
}

/** Exact axis-aligned bounds of a circular profile under an arbitrary basis. */
function resolvedHollowCircleBounds(
  solid: ResolvedSolid & { profile: Extract<Profile, { kind: 'hollowCircle' }> },
): { min: Point3D; max: Point3D } {
  const placement = solid.profile.placement ?? {
    origin: { x: 0, y: 0 },
    xAxis: { x: 1, y: 0 },
    yAxis: { x: 0, y: 1 },
  };
  const center = add3(
    solid.transform.origin,
    add3(
      scale3(solid.transform.xAxis, placement.origin.x),
      scale3(solid.transform.yAxis, placement.origin.y),
    ),
  );
  const endCenter = add3(center, scale3(solid.transform.zAxis, solid.depth));
  const profileX = add3(
    scale3(solid.transform.xAxis, placement.xAxis.x),
    scale3(solid.transform.yAxis, placement.xAxis.y),
  );
  const profileY = add3(
    scale3(solid.transform.xAxis, placement.yAxis.x),
    scale3(solid.transform.yAxis, placement.yAxis.y),
  );
  const radius = solid.profile.diameter / 2;
  const amplitude = (axis: keyof Point3D) =>
    radius * Math.hypot(profileX[axis], profileY[axis]);
  return {
    min: {
      x: Math.min(center.x, endCenter.x) - amplitude('x'),
      y: Math.min(center.y, endCenter.y) - amplitude('y'),
      z: Math.min(center.z, endCenter.z) - amplitude('z'),
    },
    max: {
      x: Math.max(center.x, endCenter.x) + amplitude('x'),
      y: Math.max(center.y, endCenter.y) + amplitude('y'),
      z: Math.max(center.z, endCenter.z) + amplitude('z'),
    },
  };
}

function profileExtentPoints(profile: Profile): Point2D[] {
  if (profile.kind === 'polyline') return profile.points;
  const halfWidth =
    profile.kind === 'hollowCircle'
      ? profile.diameter / 2
      : profile.kind === 'iShape'
        ? profile.overallWidth / 2
        : profile.xDim / 2;
  const halfDepth =
    profile.kind === 'hollowCircle'
      ? profile.diameter / 2
      : profile.kind === 'iShape'
        ? profile.overallDepth / 2
        : profile.yDim / 2;
  return [
    { x: -halfWidth, y: -halfDepth },
    { x: halfWidth, y: -halfDepth },
    { x: halfWidth, y: halfDepth },
    { x: -halfWidth, y: halfDepth },
  ];
}

/**
 * World-space displacement for a member-local axis eccentricity (2-6).
 *
 * `refDirection` is the placement's local x-axis (member direction for
 * beams/walls, rotated horizontal for columns) and `axis` is the local z (the
 * extrusion direction). The local y-axis = axis × x. The returned vector is
 * `dx · localX + dy · localY`, ready to add to the placement origin.
 */
export function localAxisOffset(
  axis: Vector3,
  refDirection: Vector3,
  dx: number,
  dy: number,
): Vector3 {
  const localX = normalize3(refDirection);
  const localY = normalize3(cross3(axis, localX));
  return add3(scale3(localX, dx), scale3(localY, dy));
}
