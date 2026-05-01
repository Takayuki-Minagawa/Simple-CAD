import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEventCandidateIds, pickSelectionCandidate, uniqueCandidateIds } from '../selectionCycle';

const originalElementsFromPoint = document.elementsFromPoint;

describe('selection cycling', () => {
  afterEach(() => {
    document.elementsFromPoint = originalElementsFromPoint;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

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

  it('collects candidate ids from the DOM hit stack and target fallback', () => {
    const beam = document.createElement('div');
    beam.dataset.id = 'beam-1';
    const beamChild = document.createElement('span');
    beam.appendChild(beamChild);
    const wall = document.createElement('div');
    wall.dataset.id = 'wall-1';
    document.body.append(beam, wall);

    document.elementsFromPoint = vi.fn(() => [beamChild, wall]) as typeof document.elementsFromPoint;

    const event = { clientX: 10, clientY: 20, target: beamChild } as unknown as Parameters<
      typeof getEventCandidateIds
    >[0];

    expect(getEventCandidateIds(event)).toEqual(['beam-1', 'wall-1']);
    expect(document.elementsFromPoint).toHaveBeenCalledWith(10, 20);
  });
});
