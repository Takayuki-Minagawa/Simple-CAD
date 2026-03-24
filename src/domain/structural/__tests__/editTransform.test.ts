import { describe, expect, it } from 'vitest';
import type { ProjectData } from '@/domain/structural/types';
import {
  duplicateSelection,
  getSelectionBounds,
  scaleSelection,
  stretchSelection,
  translateSelection,
} from '../editTransform';

function createProject(): ProjectData {
  return {
    schemaVersion: '1.0.0',
    project: { id: 'P-1', name: 'Test', unit: 'mm' },
    stories: [{ id: '1F', name: '1F', elevation: 0, height: 3000 }],
    grids: [],
    materials: [{ id: 'MAT-1', name: 'Concrete', type: 'concrete' }],
    sections: [{ id: 'SEC-WALL', kind: 'rc_wall', thickness: 200 }],
    members: [
      {
        id: 'WALL-1',
        type: 'wall',
        story: '1F',
        sectionId: 'SEC-WALL',
        materialId: 'MAT-1',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 4000, y: 0, z: 0 },
        height: 3000,
        thickness: 200,
      },
    ],
    openings: [
      {
        id: 'OPEN-1',
        memberId: 'WALL-1',
        type: 'window',
        position: { x: 1000, y: 0, z: 1200 },
        width: 1000,
        height: 1200,
      },
    ],
    annotations: [
      {
        id: 'ANN-1',
        type: 'text',
        story: '1F',
        x: 4000,
        y: 2000,
        text: 'Note',
      },
    ],
    dimensions: [
      {
        id: 'DIM-1',
        story: '1F',
        start: { x: 0, y: 0 },
        end: { x: 4000, y: 0 },
        offset: 500,
      },
    ],
    sheets: [],
    views: [],
    issues: [],
  };
}

describe('editTransform', () => {
  it('computes bounds for mixed selections', () => {
    const project = createProject();
    const bounds = getSelectionBounds(project, ['WALL-1', 'ANN-1', 'DIM-1']);

    expect(bounds).toMatchObject({
      min: { x: 0, y: 0 },
      max: { x: 4000, y: 2000 },
      width: 4000,
      height: 2000,
      center: { x: 2000, y: 1000 },
    });
  });

  it('translates selected entities and attached openings', () => {
    const project = createProject();

    translateSelection(project, ['WALL-1', 'ANN-1', 'DIM-1'], 1000, 500);

    expect(project.members[0]).toMatchObject({
      start: { x: 1000, y: 500, z: 0 },
      end: { x: 5000, y: 500, z: 0 },
    });
    expect(project.openings[0].position).toMatchObject({ x: 2000, y: 500, z: 1200 });
    expect(project.annotations[0]).toMatchObject({ x: 5000, y: 2500 });
    expect(project.dimensions[0]).toMatchObject({
      start: { x: 1000, y: 500 },
      end: { x: 5000, y: 500 },
      offset: 500,
    });
  });

  it('duplicates members, annotations, dimensions, and member openings', () => {
    const project = createProject();

    const createdIds = duplicateSelection(project, ['WALL-1', 'ANN-1', 'DIM-1'], {
      dx: 1000,
      dy: 200,
      count: 2,
    });

    expect(createdIds).toHaveLength(6);
    expect(project.members).toHaveLength(3);
    expect(project.annotations).toHaveLength(3);
    expect(project.dimensions).toHaveLength(3);
    expect(project.openings).toHaveLength(3);

    expect(project.members[1]).toMatchObject({
      start: { x: 1000, y: 200, z: 0 },
      end: { x: 5000, y: 200, z: 0 },
    });
    expect(project.members[2]).toMatchObject({
      start: { x: 2000, y: 400, z: 0 },
      end: { x: 6000, y: 400, z: 0 },
    });
    expect(project.openings[1].position).toMatchObject({ x: 2000, y: 200, z: 1200 });
    expect(project.openings[2].position).toMatchObject({ x: 3000, y: 400, z: 1200 });
  });

  it('scales geometry, dimension offsets, and opening widths', () => {
    const project = createProject();

    scaleSelection(project, ['WALL-1', 'ANN-1', 'DIM-1'], { x: 0, y: 0 }, 2, 2);

    expect(project.members[0]).toMatchObject({
      start: { x: 0, y: 0, z: 0 },
      end: { x: 8000, y: 0, z: 0 },
    });
    expect(project.openings[0]).toMatchObject({
      position: { x: 2000, y: 0, z: 1200 },
      width: 2000,
    });
    expect(project.annotations[0]).toMatchObject({ x: 8000, y: 4000 });
    expect(project.dimensions[0]).toMatchObject({
      start: { x: 0, y: 0 },
      end: { x: 8000, y: 0 },
      offset: 1000,
    });
  });

  it('applies parametric stretch from selection bounds', () => {
    const project = createProject();

    stretchSelection(project, ['WALL-1', 'ANN-1', 'DIM-1'], {
      targetWidth: 8000,
      targetHeight: 4000,
      anchorX: 'center',
      anchorY: 'center',
    });

    expect(project.members[0]).toMatchObject({
      start: { x: -2000, y: -1000, z: 0 },
      end: { x: 6000, y: -1000, z: 0 },
    });
    expect(project.openings[0]).toMatchObject({
      position: { x: 0, y: -1000, z: 1200 },
      width: 2000,
    });
    expect(project.annotations[0]).toMatchObject({ x: 6000, y: 3000 });
    expect(project.dimensions[0]).toMatchObject({
      start: { x: -2000, y: -1000 },
      end: { x: 6000, y: -1000 },
      offset: 1000,
    });
  });
});
