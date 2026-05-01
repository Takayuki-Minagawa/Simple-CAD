import { describe, expect, it } from 'vitest';
import type { ProjectData } from '@/domain/structural/types';
import { getSelectionHandles } from '../editableHandles';

const baseProject: ProjectData = {
  schemaVersion: '1.0',
  project: { id: 'p1', name: 'Test', unit: 'mm' },
  stories: [{ id: '1F', name: '1F', elevation: 0, height: 3000 }],
  grids: [],
  materials: [],
  sections: [],
  members: [
    {
      id: 'beam-1',
      type: 'beam',
      story: '1F',
      sectionId: 's',
      materialId: 'm',
      start: { x: 0, y: 0, z: 3000 },
      end: { x: 1000, y: 0, z: 3000 },
    },
    {
      id: 'slab-1',
      type: 'slab',
      story: '1F',
      sectionId: 's',
      materialId: 'm',
      polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }],
      level: 3000,
    },
  ],
  openings: [],
  annotations: [{ id: 'note-1', type: 'text', story: '1F', x: 200, y: 300, text: 'A' }],
  dimensions: [{ id: 'dim-1', story: '1F', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, offset: -500 }],
  sheets: [],
  views: [],
};

describe('getSelectionHandles', () => {
  it('returns endpoints for selected linear members and dimensions', () => {
    const handles = getSelectionHandles(baseProject, ['beam-1', 'dim-1'], '1F');
    expect(handles.map((handle) => handle.kind)).toEqual([
      'member-start',
      'member-end',
      'dimension-start',
      'dimension-end',
    ]);
  });

  it('returns slab vertex and annotation point handles', () => {
    const handles = getSelectionHandles(baseProject, ['slab-1', 'note-1'], '1F');
    expect(handles.filter((handle) => handle.kind === 'slab-vertex')).toHaveLength(3);
    expect(handles.some((handle) => handle.kind === 'annotation-point')).toBe(true);
  });
});
