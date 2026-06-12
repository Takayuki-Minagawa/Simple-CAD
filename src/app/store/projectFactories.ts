import type { ProjectData, PlanView, Sheet } from '@/domain/structural/types';

export function createDefaultPlanView(storyId: string): PlanView {
  return {
    id: `VIEW-${storyId}-PLAN`,
    type: 'plan',
    story: storyId,
    center: { x: 4000, y: 3000 },
    width: 14000,
    height: 11000,
    rotation: 0,
  };
}

export function createDefaultSheet(projectName: string, storyId: string, viewId: string, index = 1): Sheet {
  return {
    id: `S-${String(index).padStart(3, '0')}`,
    name: `${storyId}平面図`,
    paperSize: 'A1',
    scale: '1:100',
    viewIds: [viewId],
    titleBlockTemplate: 'standard',
    titleBlock: {
      projectName,
      drawingTitle: `${storyId}平面図`,
      issueDate: new Date().toISOString().slice(0, 10),
    },
  };
}

export function createEmptyProject(): ProjectData {
  const defaultStoryId = '1F';
  const defaultView = createDefaultPlanView(defaultStoryId);
  return {
    schemaVersion: '1.0.0',
    project: { id: 'proj-001', name: 'New Project', unit: 'mm' },
    stories: [{ id: defaultStoryId, name: defaultStoryId, elevation: 0, height: 3000 }],
    grids: [],
    materials: [{ id: 'MAT-RC-24', name: 'RC Fc24', type: 'concrete' }],
    sections: [
      { id: 'SEC-C600', kind: 'rc_column_rect', width: 600, depth: 600 },
      { id: 'SEC-B300x600', kind: 'rc_beam_rect', width: 300, depth: 600 },
      { id: 'SEC-SLAB180', kind: 'rc_slab', thickness: 180 },
      { id: 'SEC-WALL200', kind: 'rc_wall', thickness: 200 },
    ],
    members: [],
    openings: [],
    annotations: [],
    dimensions: [],
    sheets: [createDefaultSheet('New Project', defaultStoryId, defaultView.id)],
    views: [defaultView],
    issues: [],
  };
}
