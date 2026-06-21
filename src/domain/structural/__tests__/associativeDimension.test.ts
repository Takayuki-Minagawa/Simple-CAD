import { describe, it, expect } from 'vitest';
import { recomputeAssociativeDimensions } from '../associativeDimension';
import type { ProjectData } from '../types';

function makeData(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    schemaVersion: '1.0.0',
    project: { id: 'p', name: 'p', unit: 'mm' },
    stories: [{ id: 's1', name: '1F', elevation: 0, height: 3000 }],
    grids: [],
    materials: [{ id: 'm', name: 'C', type: 'concrete' }],
    sections: [{ id: 'sec', kind: 'rc_beam_rect', width: 300, depth: 600 }],
    members: [
      {
        id: 'b1',
        type: 'beam',
        story: 's1',
        sectionId: 'sec',
        materialId: 'm',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 5000, y: 0, z: 0 },
      },
    ],
    openings: [],
    annotations: [],
    dimensions: [
      {
        id: 'd1',
        story: 's1',
        start: { x: 0, y: 0 },
        end: { x: 5000, y: 0 },
        offset: 500,
        associative: true,
        refMemberIds: ['b1'],
      },
    ],
    sheets: [],
    views: [],
    ...overrides,
  };
}

describe('recomputeAssociativeDimensions', () => {
  it('follows the referenced member endpoints after a move', () => {
    const data = makeData();
    // Move the beam end out to 8000.
    data.members[0] = { ...data.members[0], end: { x: 8000, y: 0, z: 0 } } as never;
    const out = recomputeAssociativeDimensions(data);
    expect(out.dimensions[0].end).toEqual({ x: 8000, y: 0 });
    expect(out.dimensions[0].start).toEqual({ x: 0, y: 0 });
  });

  it('leaves non-associative dimensions untouched (same reference)', () => {
    const data = makeData({
      dimensions: [
        { id: 'd1', story: 's1', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, offset: 0 },
      ],
    });
    expect(recomputeAssociativeDimensions(data)).toBe(data);
  });
});
