import { describe, expect, it } from 'vitest';
import { recoverMemberRoll, resolveMemberLocalAxes } from '../localAxis';

function dot(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

describe('member local-axis basis', () => {
  it('builds a stable right-handed default basis for a horizontal member', () => {
    const axes = resolveMemberLocalAxes(
      { x: 0, y: 0, z: 0 },
      { x: 4000, y: 0, z: 0 },
    );
    expect(axes).toEqual({
      x: { x: 0, y: 1, z: 0 },
      y: { x: 0, y: 0, z: 1 },
      z: { x: 1, y: 0, z: 0 },
    });
  });

  it('projects a reference vector and adds legacy and explicit roll', () => {
    const start = { x: 100, y: 200, z: 300 };
    const end = { x: 3100, y: 2200, z: 1300 };
    const roll = 0.37;
    const axes = resolveMemberLocalAxes(start, end, 0.12, {
      rotation: 0.25,
      referenceVector: { x: 0, y: 0, z: 1 },
    });

    expect(dot(axes.x, axes.y)).toBeCloseTo(0, 12);
    expect(dot(axes.x, axes.z)).toBeCloseTo(0, 12);
    expect(dot(axes.y, axes.z)).toBeCloseTo(0, 12);
    expect(Math.hypot(axes.x.x, axes.x.y, axes.x.z)).toBeCloseTo(1, 12);
    expect(recoverMemberRoll(start, end, axes.x)).toBeCloseTo(roll, 12);
  });

  it('falls back safely when the reference vector is parallel to the member', () => {
    const axes = resolveMemberLocalAxes(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 3000 },
      0,
      { rotation: 0, referenceVector: { x: 0, y: 0, z: 5 } },
    );
    for (const axis of Object.values(axes)) {
      expect([axis.x, axis.y, axis.z].every(Number.isFinite)).toBe(true);
      expect(Math.hypot(axis.x, axis.y, axis.z)).toBeCloseTo(1, 12);
    }
  });
});
