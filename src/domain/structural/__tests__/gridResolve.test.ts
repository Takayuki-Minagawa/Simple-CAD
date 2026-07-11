import { describe, it, expect } from 'vitest';
import { gridIntersection, applyGridGeometry } from '../gridResolve';
import type { Grid, ProjectData } from '../types';

const grids: Grid[] = [
  { id: 'gx1', axis: 'X', name: 'X1', position: 0 },
  { id: 'gx2', axis: 'X', name: 'X2', position: 6000 },
  { id: 'gy1', axis: 'Y', name: 'Y1', position: 0 },
  { id: 'gy2', axis: 'Y', name: 'Y2', position: 4000 },
];

describe('gridIntersection', () => {
  it('resolves an X/Y pair regardless of order', () => {
    expect(gridIntersection(grids, 'X2', 'Y2')).toEqual({ x: 6000, y: 4000 });
    expect(gridIntersection(grids, 'Y2', 'X2')).toEqual({ x: 6000, y: 4000 });
  });
  it('resolves stable grid IDs as well as names', () => {
    expect(gridIntersection(grids, 'gx2', 'gy2')).toEqual({ x: 6000, y: 4000 });
  });
  it('returns null for unknown or same-axis names', () => {
    expect(gridIntersection(grids, 'X1', 'X2')).toBeNull();
    expect(gridIntersection(grids, 'X1', 'ZZ')).toBeNull();
  });
});

describe('applyGridGeometry', () => {
  const base: ProjectData = {
    schemaVersion: '1.0.0',
    project: { id: 'p', name: 'p', unit: 'mm' },
    stories: [{ id: 's1', name: '1F', elevation: 0, height: 3000 }],
    grids,
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
        end: { x: 0, y: 0, z: 0 },
        gridRef: { startGrid: ['X1', 'Y1'], endGrid: ['X2', 'Y2'] },
      },
    ],
    openings: [],
    annotations: [],
    dimensions: [],
    sheets: [],
    views: [],
  };

  it('re-resolves member endpoints from grid positions', () => {
    const out = applyGridGeometry(base);
    const b = out.members[0];
    expect(b.type === 'beam' && b.start).toMatchObject({ x: 0, y: 0, z: 0 });
    expect(b.type === 'beam' && b.end).toMatchObject({ x: 6000, y: 4000, z: 0 });
  });

  it('follows when a grid moves', () => {
    const moved = { ...base, grids: grids.map((g) => (g.name === 'X2' ? { ...g, position: 8000 } : g)) };
    const out = applyGridGeometry(moved);
    const b = out.members[0];
    expect(b.type === 'beam' && b.end?.x).toBe(8000);
  });

  it('re-resolves member endpoints referenced by grid IDs', () => {
    const byId = {
      ...base,
      members: [
        {
          ...base.members[0],
          gridRef: { startGrid: ['gx1', 'gy1'], endGrid: ['gx2', 'gy2'] },
        },
      ],
    } as ProjectData;
    const out = applyGridGeometry(byId);
    const beam = out.members[0];
    expect(beam.type === 'beam' && beam.end).toMatchObject({ x: 6000, y: 4000, z: 0 });
  });

  it('returns the same reference when no member has a gridRef', () => {
    const noRef = { ...base, members: [{ ...base.members[0], gridRef: undefined }] };
    expect(applyGridGeometry(noRef)).toBe(noRef);
  });
});
