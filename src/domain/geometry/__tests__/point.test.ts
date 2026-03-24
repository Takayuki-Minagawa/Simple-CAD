import { describe, it, expect } from 'vitest';
import { add2D, sub2D, distance2D, midpoint2D, distance3D, midpoint3D } from '../point';

describe('2D point operations', () => {
  it('adds two points', () => {
    expect(add2D({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
  });

  it('subtracts two points', () => {
    expect(sub2D({ x: 5, y: 7 }, { x: 2, y: 3 })).toEqual({ x: 3, y: 4 });
  });

  it('calculates distance', () => {
    expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('calculates midpoint', () => {
    expect(midpoint2D({ x: 0, y: 0 }, { x: 4, y: 6 })).toEqual({ x: 2, y: 3 });
  });
});

describe('3D point operations', () => {
  it('calculates 3D distance', () => {
    expect(distance3D({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 2 })).toBe(3);
  });

  it('calculates 3D midpoint', () => {
    expect(midpoint3D({ x: 0, y: 0, z: 0 }, { x: 4, y: 6, z: 8 })).toEqual({
      x: 2,
      y: 3,
      z: 4,
    });
  });
});
