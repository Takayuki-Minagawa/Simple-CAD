import { describe, expect, it } from 'vitest';
import { constrainPointToAngle } from '../angleConstraint';

describe('constrainPointToAngle', () => {
  it('keeps points on the nearest horizontal axis', () => {
    const point = constrainPointToAngle({ x: 0, y: 0 }, { x: 100, y: 20 });
    expect(point.x).toBeCloseTo(Math.hypot(100, 20));
    expect(point.y).toBeCloseTo(0);
  });

  it('keeps points on the nearest diagonal axis', () => {
    const point = constrainPointToAngle({ x: 0, y: 0 }, { x: 100, y: 80 });
    const distance = Math.hypot(100, 80);
    const expected = distance / Math.sqrt(2);
    expect(point.x).toBeCloseTo(expected);
    expect(point.y).toBeCloseTo(expected);
  });

  it('uses the supplied origin', () => {
    const point = constrainPointToAngle({ x: 10, y: 20 }, { x: 10, y: 120 });
    expect(point.x).toBeCloseTo(10);
    expect(point.y).toBeCloseTo(120);
  });
});
