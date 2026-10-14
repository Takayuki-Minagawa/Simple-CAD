import { describe, expect, it } from 'vitest';
import { cadToWorld, computeViewPose } from '../viewPresets';

const extents = { xMin: 0, xMax: 10000, yMin: 0, yMax: 6000, zMin: 0, zMax: 3000 };
const viewport = { width: 800, height: 600 };

describe('viewPresets', () => {
  it('maps CAD coordinates into the rotated, scaled scene frame', () => {
    expect(cadToWorld(1000, 2000, 3000)).toEqual([1, 3, -2]);
  });

  it('places the top view above the model center looking down with north up', () => {
    const pose = computeViewPose('top', extents, viewport, { orthographic: true });
    expect(pose.target).toEqual([5, 1.5, -3]);
    expect(pose.position[0]).toBeCloseTo(5);
    expect(pose.position[2]).toBeCloseTo(-3);
    expect(pose.position[1]).toBeGreaterThan(pose.target[1]);
    expect(pose.up).toEqual([0, 0, -1]);
  });

  it('places front and right views on their axes', () => {
    const front = computeViewPose('front', extents, viewport, { orthographic: true });
    expect(front.position[2]).toBeGreaterThan(front.target[2]);
    expect(front.position[0]).toBeCloseTo(front.target[0]);
    const right = computeViewPose('right', extents, viewport, { orthographic: true });
    expect(right.position[0]).toBeGreaterThan(right.target[0]);
    expect(right.position[1]).toBeCloseTo(right.target[1]);
  });

  it('fits the bounding sphere into the shorter viewport side for orthographic cameras', () => {
    const pose = computeViewPose('iso', extents, viewport, { orthographic: true });
    const radius = Math.sqrt(10 * 10 + 6 * 6 + 3 * 3) / 2;
    expect(pose.orthoZoom).toBeCloseTo(600 / (2 * radius * 1.1));
  });

  it('moves a perspective camera far enough back to see the whole model', () => {
    const pose = computeViewPose('iso', extents, viewport, { orthographic: false, fovDeg: 50 });
    const distance = Math.hypot(
      pose.position[0] - pose.target[0],
      pose.position[1] - pose.target[1],
      pose.position[2] - pose.target[2],
    );
    const radius = Math.sqrt(10 * 10 + 6 * 6 + 3 * 3) / 2;
    expect(distance).toBeGreaterThan(radius / Math.sin((25 * Math.PI) / 180));
  });

  it('never degenerates for an empty model', () => {
    const pose = computeViewPose('top', { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 }, viewport, {
      orthographic: true,
    });
    expect(Number.isFinite(pose.orthoZoom)).toBe(true);
    expect(pose.orthoZoom).toBeGreaterThan(0);
  });
});
