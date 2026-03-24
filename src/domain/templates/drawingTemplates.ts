import type { ProjectData } from '@/domain/structural/types';

export interface DrawingTemplate {
  key: string;
  labelEn: string;
  labelJa: string;
  create: () => ProjectData;
}

function createA1StructureTemplate(): ProjectData {
  const storyId = '1F';
  const viewId = `VIEW-${storyId}-PLAN`;
  return {
    schemaVersion: '1.0.0',
    project: { id: 'proj-001', name: 'Structure Project', unit: 'mm' },
    stories: [
      { id: '1F', name: '1F', elevation: 0, height: 3000 },
      { id: '2F', name: '2F', elevation: 3000, height: 3000 },
    ],
    grids: [],
    materials: [
      { id: 'MAT-RC-24', name: 'RC Fc24', type: 'concrete' },
      { id: 'MAT-SD390', name: 'SD390', type: 'steel' },
    ],
    sections: [
      { id: 'SEC-C600', kind: 'rc_column_rect', width: 600, depth: 600 },
      { id: 'SEC-C700', kind: 'rc_column_rect', width: 700, depth: 700 },
      { id: 'SEC-B300x600', kind: 'rc_beam_rect', width: 300, depth: 600 },
      { id: 'SEC-B350x700', kind: 'rc_beam_rect', width: 350, depth: 700 },
      { id: 'SEC-SLAB180', kind: 'rc_slab', thickness: 180 },
      { id: 'SEC-WALL200', kind: 'rc_wall', thickness: 200 },
    ],
    members: [],
    openings: [],
    annotations: [],
    dimensions: [],
    views: [
      {
        id: viewId,
        type: 'plan',
        story: storyId,
        center: { x: 4000, y: 3000 },
        width: 14000,
        height: 11000,
        rotation: 0,
      },
    ],
    sheets: [
      {
        id: 'S-001',
        name: '1F Plan',
        paperSize: 'A1',
        scale: '1:100',
        viewIds: [viewId],
        titleBlockTemplate: 'standard',
        titleBlock: {
          projectName: 'Structure Project',
          drawingTitle: '1F Plan',
          issueDate: new Date().toISOString().slice(0, 10),
        },
      },
    ],
    issues: [],
  };
}

function createA3DetailTemplate(): ProjectData {
  const storyId = '1F';
  const viewId = `VIEW-${storyId}-PLAN`;
  return {
    schemaVersion: '1.0.0',
    project: { id: 'proj-001', name: 'Detail Drawing', unit: 'mm' },
    stories: [{ id: storyId, name: storyId, elevation: 0, height: 3000 }],
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
    views: [
      {
        id: viewId,
        type: 'plan',
        story: storyId,
        center: { x: 2000, y: 1500 },
        width: 8000,
        height: 6000,
        rotation: 0,
      },
    ],
    sheets: [
      {
        id: 'S-001',
        name: 'Detail',
        paperSize: 'A3',
        scale: '1:50',
        viewIds: [viewId],
        titleBlockTemplate: 'compact',
        titleBlock: {
          projectName: 'Detail Drawing',
          drawingTitle: 'Detail',
          issueDate: new Date().toISOString().slice(0, 10),
        },
      },
    ],
    issues: [],
  };
}

function createBlankA1Template(): ProjectData {
  const storyId = '1F';
  const viewId = `VIEW-${storyId}-PLAN`;
  return {
    schemaVersion: '1.0.0',
    project: { id: 'proj-001', name: 'New Project', unit: 'mm' },
    stories: [{ id: storyId, name: storyId, elevation: 0, height: 3000 }],
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
    views: [
      {
        id: viewId,
        type: 'plan',
        story: storyId,
        center: { x: 4000, y: 3000 },
        width: 14000,
        height: 11000,
        rotation: 0,
      },
    ],
    sheets: [
      {
        id: 'S-001',
        name: '1F Plan',
        paperSize: 'A1',
        scale: '1:100',
        viewIds: [viewId],
        titleBlockTemplate: 'minimal',
        titleBlock: {
          projectName: 'New Project',
          drawingTitle: '1F Plan',
        },
      },
    ],
    issues: [],
  };
}

export const drawingTemplates: DrawingTemplate[] = [
  {
    key: 'a1-structure',
    labelEn: 'A1 Structure (1:100)',
    labelJa: 'A1 構造図 (1:100)',
    create: createA1StructureTemplate,
  },
  {
    key: 'a3-detail',
    labelEn: 'A3 Detail (1:50)',
    labelJa: 'A3 詳細図 (1:50)',
    create: createA3DetailTemplate,
  },
  {
    key: 'blank-a1',
    labelEn: 'Blank A1',
    labelJa: '白紙 A1',
    create: createBlankA1Template,
  },
];
