import { describe, it, expect } from 'vitest';
import { linearAxisOffsetToWorld, columnAxisOffsetToWorld } from '../eccentricity';

describe('linearAxisOffsetToWorld', () => {
  it('maps dx to the in-plan left perpendicular and dy to +Z (no along-axis term)', () => {
    // Axis along +X: left perpendicular is +Y.
    const d = linearAxisOffsetToWorld({ dx: 100, dy: 50 }, { x: 0, y: 0 }, { x: 1000, y: 0 });
    expect(d.x).toBeCloseTo(0, 9); // nothing along the axis
    expect(d.y).toBeCloseTo(100, 9); // perpendicular
    expect(d.z).toBeCloseTo(50, 9); // vertical
  });

  it('rotates the perpendicular with the axis direction', () => {
    // Axis along +Y: left perpendicular is -X.
    const d = linearAxisOffsetToWorld({ dx: 100, dy: 0 }, { x: 0, y: 0 }, { x: 0, y: 1000 });
    expect(d.x).toBeCloseTo(-100, 9);
    expect(d.y).toBeCloseTo(0, 9);
  });

  it('returns zero for missing/zero offset', () => {
    expect(linearAxisOffsetToWorld(undefined, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ x: 0, y: 0, z: 0 });
    expect(linearAxisOffsetToWorld({ dx: 0, dy: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('columnAxisOffsetToWorld', () => {
  it('maps dx,dy directly to world x,y', () => {
    expect(columnAxisOffsetToWorld({ dx: 30, dy: -40 })).toEqual({ x: 30, y: -40, z: 0 });
    expect(columnAxisOffsetToWorld(undefined)).toEqual({ x: 0, y: 0, z: 0 });
  });
});
