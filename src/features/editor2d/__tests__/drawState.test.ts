import { describe, expect, it } from 'vitest';
import { createEmptyDrawState, hasActiveDrawingState } from '../useEditorInteraction';

describe('draw state helpers', () => {
  it('treats an extend source member as active drawing state', () => {
    expect(hasActiveDrawingState(createEmptyDrawState())).toBe(false);

    expect(
      hasActiveDrawingState({
        ...createEmptyDrawState(),
        extendMemberId: 'beam-001',
      }),
    ).toBe(true);
  });
});
