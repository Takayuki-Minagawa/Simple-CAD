import { describe, expect, it } from 'vitest';
import {
  buildDisplacementMap,
  buildUtilizationMap,
  displacePoint,
  utilizationColor,
  utilizationRange,
} from '../analysisResults';

describe('analysis result helpers', () => {
  it('applies a matching nodal displacement at the requested scale', () => {
    const index = buildDisplacementMap([
      { position: { x: 100, y: 200, z: 300 }, dx: 1, dy: -2, dz: 3 },
    ]);
    expect(displacePoint({ x: 100, y: 200, z: 300 }, index, 10)).toEqual({
      x: 110,
      y: 180,
      z: 330,
      hasResult: true,
    });
    expect(displacePoint({ x: 100.5, y: 200, z: 300 }, index, 1).hasResult).toBe(true);
  });

  it('maps utilization by member and reports its range', () => {
    const results = [
      { memberId: 'B1', utilization: 0.4 },
      { memberId: 'B2', utilization: 1.2 },
    ];
    expect(buildUtilizationMap(results).get('B2')).toBe(1.2);
    expect(utilizationRange(results)).toEqual({ min: 0.4, max: 1.2 });
  });

  it('uses a green-amber-red utilization scale', () => {
    expect(utilizationColor(0)).toBe('#22c55e');
    expect(utilizationColor(1)).toBe('#f59e0b');
    expect(utilizationColor(1.5)).toBe('#dc2626');
  });
});
