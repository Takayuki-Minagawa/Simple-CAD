import { describe, expect, it } from 'vitest';
import { pickSelectionCandidate, uniqueCandidateIds } from '../selectionCycle';

describe('selection cycling', () => {
  it('deduplicates candidates while preserving hit order', () => {
    expect(uniqueCandidateIds(['beam-1', 'wall-1', 'beam-1', null, 'dim-1'])).toEqual([
      'beam-1',
      'wall-1',
      'dim-1',
    ]);
  });

  it('starts from the top candidate when nothing is selected', () => {
    expect(pickSelectionCandidate(['beam-1', 'wall-1'], [])).toBe('beam-1');
  });

  it('cycles from the current selected candidate', () => {
    expect(pickSelectionCandidate(['beam-1', 'wall-1', 'dim-1'], ['beam-1'])).toBe('wall-1');
    expect(pickSelectionCandidate(['beam-1', 'wall-1', 'dim-1'], ['dim-1'])).toBe('beam-1');
  });

  it('falls back to the top candidate when current selection is outside the hit stack', () => {
    expect(pickSelectionCandidate(['beam-1', 'wall-1'], ['col-1'])).toBe('beam-1');
  });
});
