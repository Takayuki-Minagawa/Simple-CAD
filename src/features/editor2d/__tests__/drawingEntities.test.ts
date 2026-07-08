import { describe, expect, it } from 'vitest';
import type { ProjectData } from '@/domain/structural/types';
import {
  createBeamMemberFromPoints,
  createColumnMemberAt,
  createConstructionLineFromPoints,
  createDimensionFromPoints,
  createSlabMemberFromPoints,
  defaultSectionId,
} from '../drawingEntities';

function project(): ProjectData {
  return {
    schemaVersion: '1.0.0',
    project: { id: 'P1', name: 'Test', unit: 'mm' },
    stories: [{ id: '1F', name: '1F', elevation: 0, height: 3000 }],
    grids: [],
    materials: [{ id: 'M1', name: 'Concrete', type: 'concrete' }],
    sections: [
      { id: 'C', kind: 'rc_column_rect', width: 600, depth: 600 },
      { id: 'B', kind: 'rc_beam_rect', width: 300, depth: 600 },
      { id: 'S', kind: 'rc_slab', thickness: 180 },
      { id: 'W', kind: 'rc_wall', thickness: 200 },
    ],
    members: [],
    openings: [],
    annotations: [],
    dimensions: [],
    sheets: [],
    views: [],
    issues: [],
  };
}

describe('drawingEntities', () => {
  it('uses kind-based default sections', () => {
    const data = project();
    expect(defaultSectionId(data, 'column')).toBe('C');
    expect(defaultSectionId(data, 'beam')).toBe('B');
    expect(defaultSectionId(data, 'slab')).toBe('S');
    expect(defaultSectionId(data, 'wall')).toBe('W');
  });

  it('creates column, beam, slab, and dimensions from draw points', () => {
    const data = project();
    const story = data.stories[0];
    const usedIds = new Set<string>();

    const column = createColumnMemberAt(data, '1F', 'up', { x: 1000, y: 2000 }, usedIds);
    expect(column).toMatchObject({
      type: 'column',
      start: { x: 1000, y: 2000, z: 0 },
      end: { x: 1000, y: 2000, z: 3000 },
    });

    const beam = createBeamMemberFromPoints(
      data,
      '1F',
      story,
      [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
      ],
      usedIds,
    );
    expect(beam).toMatchObject({
      type: 'beam',
      sectionId: 'B',
      start: { x: 0, y: 0, z: 3000 },
      end: { x: 4000, y: 0, z: 3000 },
    });

    const slab = createSlabMemberFromPoints(
      data,
      '1F',
      story,
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 0, y: 1000 },
      ],
      usedIds,
    );
    expect(slab.level).toBe(3000);
    expect(slab.polygon).toHaveLength(3);

    expect(
      createDimensionFromPoints(
        '1F',
        [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        usedIds,
      ),
    ).toMatchObject({
      offset: -1000,
    });
  });

  it('returns null for zero-length construction lines', () => {
    expect(
      createConstructionLineFromPoints(
        '1F',
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        new Set(),
      ),
    ).toBeNull();
  });
});
