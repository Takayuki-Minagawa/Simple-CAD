import { describe, expect, it } from 'vitest';
import { canCompleteDrawing } from '../useEditorInteraction';

describe('canCompleteDrawing', () => {
  it('requires three slab points', () => {
    expect(canCompleteDrawing('slab', 2)).toBe(false);
    expect(canCompleteDrawing('slab', 3)).toBe(true);
  });

  it('requires two spline points', () => {
    expect(canCompleteDrawing('spline', 1)).toBe(false);
    expect(canCompleteDrawing('spline', 2)).toBe(true);
  });

  it('does not complete fixed-point tools', () => {
    expect(canCompleteDrawing('beam', 2)).toBe(false);
    expect(canCompleteDrawing('column', 1)).toBe(false);
  });
});
