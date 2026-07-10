import { describe, it, expect } from 'vitest';
import {
  quantize,
  quantizePoint2D,
  quantizePoint3D,
  equals2D,
  equals3D,
  approxEqual,
  pointKey2D,
  pointKey3D,
  segmentIntersection,
  isDegenerateSegment,
  GEOM_EPSILON,
  SpatialPointIndex3D,
  JOINT_MERGE_TOLERANCE,
  radiansToDisplayDegrees,
} from '../precision';

describe('quantize', () => {
  it('rounds to the default 0.001mm grid and clears FP noise', () => {
    expect(quantize(86.6025403784)).toBe(86.603);
    expect(quantize(100 * Math.cos(Math.PI / 6))).toBe(86.603);
  });

  it('normalizes -0 to 0', () => {
    expect(Object.is(quantize(-0.0000001), 0)).toBe(true);
  });

  it('respects a custom step', () => {
    expect(quantize(100.04, 0.1)).toBe(100);
    expect(quantize(100.06, 0.1)).toBe(100.1);
  });

  it('passes through non-finite values unchanged', () => {
    expect(quantize(Infinity)).toBe(Infinity);
    expect(Number.isNaN(quantize(NaN))).toBe(true);
  });
});

describe('radiansToDisplayDegrees', () => {
  it('hides radian-storage quantization noise at a practical UI precision', () => {
    expect(radiansToDisplayDegrees(0.523599)).toBe(30);
    expect(radiansToDisplayDegrees(-0.785398)).toBe(-45);
    expect(radiansToDisplayDegrees(Math.PI / 7)).toBe(25.7143);
  });
});

describe('quantizePoint', () => {
  it('quantizes 2D and 3D points', () => {
    expect(quantizePoint2D({ x: 1.00049, y: 2.0005 })).toEqual({ x: 1, y: 2.001 });
    expect(quantizePoint3D({ x: 0.0001, y: 0.0004, z: 0.0006 })).toEqual({
      x: 0,
      y: 0,
      z: 0.001,
    });
  });
});

describe('equality', () => {
  it('compares within epsilon', () => {
    expect(equals2D({ x: 1, y: 1 }, { x: 1 + GEOM_EPSILON / 2, y: 1 })).toBe(true);
    expect(equals2D({ x: 1, y: 1 }, { x: 1.001, y: 1 })).toBe(false);
    expect(equals3D({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(true);
    expect(approxEqual(1, 1 + GEOM_EPSILON / 2)).toBe(true);
  });
});

describe('pointKey', () => {
  it('maps near-coincident points to the same key', () => {
    expect(pointKey3D({ x: 100, y: 0, z: 0 })).toBe(pointKey3D({ x: 100.0000001, y: 0, z: 0 }));
    expect(pointKey2D({ x: 1, y: 2 })).toBe('1:2');
  });

  it('separates points beyond tolerance', () => {
    expect(pointKey3D({ x: 100, y: 0, z: 0 })).not.toBe(pointKey3D({ x: 100.5, y: 0, z: 0 }));
  });
});

describe('SpatialPointIndex3D', () => {
  it('matches points across spatial-cell boundaries within the 1mm joint tolerance', () => {
    const index = new SpatialPointIndex3D<string>();
    index.insert({ x: 0.99, y: -0.01, z: 0 }, 'joint');

    expect(JOINT_MERGE_TOLERANCE).toBe(1);
    expect(index.find({ x: 1.01, y: 0.01, z: 0 })).toBe('joint');
  });

  it('does not merge points beyond the configured Euclidean tolerance', () => {
    const index = new SpatialPointIndex3D<string>(1);
    index.insert({ x: 0, y: 0, z: 0 }, 'joint');

    expect(index.find({ x: 0.8, y: 0.8, z: 0 })).toBeUndefined();
  });

  it('returns every tolerance match even when proximity is non-transitive', () => {
    const index = new SpatialPointIndex3D<string>(1);
    index.insert({ x: 0, y: 0, z: 0 }, 'left');
    index.insert({ x: 0.9, y: 0, z: 0 }, 'center');
    index.insert({ x: 1.8, y: 0, z: 0 }, 'right');

    expect(index.findAll({ x: 0.9, y: 0, z: 0 }).sort()).toEqual([
      'center',
      'left',
      'right',
    ]);
  });
});

describe('segmentIntersection', () => {
  it('finds a crossing inside both segments', () => {
    const r = segmentIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    );
    expect(r).not.toBeNull();
    expect(r!.point).toEqual({ x: 5, y: 5 });
  });

  it('returns null for parallel segments', () => {
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 }),
    ).toBeNull();
  });

  it('returns null when the crossing is outside the bounds', () => {
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 0 }, { x: 5, y: 10 }),
    ).toBeNull();
  });

  it('returns the apparent (extended) intersection when bounds disabled', () => {
    const r = segmentIntersection(
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 5, y: 0 },
      { x: 5, y: 10 },
      false,
    );
    expect(r!.point).toEqual({ x: 5, y: 5 });
  });
});

describe('isDegenerateSegment', () => {
  it('detects coincident endpoints', () => {
    expect(isDegenerateSegment({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(true);
    expect(isDegenerateSegment({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe(false);
  });
});
