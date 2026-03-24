import { describe, it, expect } from 'vitest';
import { worldToScreen, screenToWorld, snapToGrid } from '../transform';

describe('worldToScreen / screenToWorld', () => {
  it('round-trips correctly', () => {
    const pan = { x: 400, y: 300 };
    const zoom = 0.05;
    const world = { x: 4000, y: 3000 };

    const screen = worldToScreen(world, pan, zoom);
    const back = screenToWorld(screen, pan, zoom);

    expect(back.x).toBeCloseTo(world.x, 6);
    expect(back.y).toBeCloseTo(world.y, 6);
  });

  it('respects Y-axis inversion', () => {
    const pan = { x: 0, y: 0 };
    const zoom = 1;

    const screen = worldToScreen({ x: 100, y: 200 }, pan, zoom);
    expect(screen.x).toBe(100);
    expect(screen.y).toBe(-200); // Y inverted
  });
});

describe('snapToGrid', () => {
  it('snaps to nearest grid line', () => {
    expect(snapToGrid(1250, 1000)).toBe(1000);
    expect(snapToGrid(1500, 1000)).toBe(2000);
    expect(snapToGrid(1750, 1000)).toBe(2000);
    expect(snapToGrid(-300, 1000)).toBeCloseTo(0);
    expect(snapToGrid(-600, 1000)).toBe(-1000);
  });
});
