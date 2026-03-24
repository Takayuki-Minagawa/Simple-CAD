import { beforeEach, describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import { useProjectStore } from '@/app/store/projectStore';
import type { ProjectData } from '@/domain/structural/types';

describe('projectStore duplicateStory', () => {
  beforeEach(() => {
    const cloned = JSON.parse(JSON.stringify(sampleProject)) as ProjectData;
    useProjectStore.getState().loadProject(cloned);
  });

  it('duplicates story-linked data and shifts member elevations', () => {
    const createdId = useProjectStore.getState().duplicateStory('1F', {
      id: '3F',
      name: '3F',
      elevation: 6000,
      height: 3000,
    });

    const data = useProjectStore.getState().data!;
    const clonedColumn = data.members.find((member) => member.id === 'C-X1Y1-3F');
    const clonedOpening = data.openings.find((opening) => opening.id === 'OP-W1-3F');
    const clonedAnnotation = data.annotations.find((annotation) => annotation.id === 'NOTE-001-3F');
    const clonedDimension = data.dimensions.find((dimension) => dimension.id === 'DIM-X-001-3F');
    const clonedPlanView = data.views.find((view) => view.id === 'VIEW-3F-PLAN');
    const cloned3dView = data.views.find((view) => view.id === 'VIEW-3D-001-3F');
    const clonedSheet = data.sheets.find((sheet) => sheet.id === 'S-001-3F');

    expect(createdId).toBe('3F');
    expect(data.stories.some((story) => story.id === '3F')).toBe(true);
    expect(clonedColumn).toMatchObject({
      type: 'column',
      story: '3F',
      start: { x: 0, y: 0, z: 6000 },
      end: { x: 0, y: 0, z: 9000 },
    });
    expect(clonedOpening).toMatchObject({
      memberId: 'W-X3-Y1Y2-3F',
      position: { x: 8000, y: 3000, z: 6900 },
    });
    expect(clonedAnnotation?.story).toBe('3F');
    expect(clonedDimension?.story).toBe('3F');
    expect(clonedPlanView?.story).toBe('3F');
    expect(cloned3dView?.story).toBe('3F');
    expect(clonedSheet).toMatchObject({
      name: '3F平面図',
      viewIds: ['VIEW-3F-PLAN'],
    });
    expect(clonedSheet?.titleBlock?.drawingTitle).toBe('3F平面図');
  });
});
