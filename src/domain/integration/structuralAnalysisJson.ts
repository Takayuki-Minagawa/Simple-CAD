import type { Point2D, Point3D } from '@/domain/geometry/types';
import type {
  Grid,
  Material,
  Member,
  PlanView,
  ProjectData,
  Section,
  Sheet,
  Story,
  View,
} from '@/domain/structural/types';
import { validateProject } from '@/domain/validation';
import type { ValidationError } from '@/domain/validation';

export const STRUCTURAL_ANALYSIS_SCHEMA = 'simple-cad.structural-analysis/v1';

export interface StructuralAnalysisMeta {
  source: 'Simple-CAD';
  projectId: string;
  projectName: string;
  unit: 'mm';
  generatedAt: string;
}

export interface StructuralAnalysisNode {
  id: string;
  x: number;
  y: number;
  z: number;
  storyId?: string;
}

export interface StructuralAnalysisLinearMember {
  id: string;
  type: 'column' | 'beam' | 'wall';
  storyId: string;
  sectionId: string;
  materialId: string;
  startNodeId: string;
  endNodeId: string;
  height?: number;
  thickness?: number;
  rotation?: number;
  tags?: string[];
}

export interface StructuralAnalysisAreaMember {
  id: string;
  type: 'slab';
  storyId: string;
  sectionId: string;
  materialId: string;
  nodeIds: string[];
  level: number;
  rotation?: number;
  tags?: string[];
}

export interface StructuralAnalysisOpening {
  id: string;
  memberId: string;
  type: 'door' | 'window' | 'void';
  position: Point3D;
  width: number;
  height: number;
}

export interface StructuralAnalysisModel {
  schema: typeof STRUCTURAL_ANALYSIS_SCHEMA;
  meta: StructuralAnalysisMeta;
  stories: Story[];
  grids: Grid[];
  materials: Material[];
  sections: Section[];
  nodes: StructuralAnalysisNode[];
  linearMembers: StructuralAnalysisLinearMember[];
  areaMembers: StructuralAnalysisAreaMember[];
  openings: StructuralAnalysisOpening[];
}

export function exportStructuralAnalysisModel(data: ProjectData): StructuralAnalysisModel {
  const nodes: StructuralAnalysisNode[] = [];
  const nodeIds = new Map<string, string>();

  const ensureNode = (point: Point3D, storyId?: string) => {
    const key = `${point.x}:${point.y}:${point.z}`;
    const existing = nodeIds.get(key);
    if (existing) return existing;

    const id = `N-${String(nodes.length + 1).padStart(4, '0')}`;
    nodes.push({
      id,
      x: point.x,
      y: point.y,
      z: point.z,
      storyId,
    });
    nodeIds.set(key, id);
    return id;
  };

  const linearMembers: StructuralAnalysisLinearMember[] = [];
  const areaMembers: StructuralAnalysisAreaMember[] = [];

  for (const member of data.members) {
    if (member.type === 'slab') {
      areaMembers.push({
        id: member.id,
        type: 'slab',
        storyId: member.story,
        sectionId: member.sectionId,
        materialId: member.materialId,
        nodeIds: member.polygon.map((point) =>
          ensureNode({ x: point.x, y: point.y, z: member.level }, member.story),
        ),
        level: member.level,
        rotation: member.rotation,
        tags: member.tags,
      });
      continue;
    }

    linearMembers.push({
      id: member.id,
      type: member.type,
      storyId: member.story,
      sectionId: member.sectionId,
      materialId: member.materialId,
      startNodeId: ensureNode(member.start, member.story),
      endNodeId: ensureNode(member.end, member.story),
      height: member.type === 'wall' ? member.height : undefined,
      thickness: member.type === 'wall' ? member.thickness : undefined,
      rotation: member.rotation,
      tags: member.tags,
    });
  }

  return {
    schema: STRUCTURAL_ANALYSIS_SCHEMA,
    meta: {
      source: 'Simple-CAD',
      projectId: data.project.id,
      projectName: data.project.name,
      unit: data.project.unit,
      generatedAt: new Date().toISOString(),
    },
    stories: data.stories,
    grids: data.grids,
    materials: data.materials,
    sections: data.sections,
    nodes,
    linearMembers,
    areaMembers,
    openings: data.openings,
  };
}

export function exportStructuralAnalysisJson(data: ProjectData): string {
  return JSON.stringify(exportStructuralAnalysisModel(data), null, 2);
}

export function importStructuralAnalysisJson(
  rawContent: string,
): { ok: true; data: ProjectData } | { ok: false; errors: ValidationError[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    return {
      ok: false,
      errors: [{ level: 'error', message: `JSON parse error: ${String(error)}` }],
    };
  }

  const validationErrors = validateStructuralAnalysisModel(parsed);
  if (validationErrors.length > 0) {
    return { ok: false, errors: validationErrors };
  }

  const project = structuralAnalysisModelToProject(parsed as StructuralAnalysisModel);
  const result = validateProject(project);
  if (!result.ok) {
    return { ok: false, errors: result.errors };
  }

  return { ok: true, data: project };
}

function validateStructuralAnalysisModel(value: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isRecord(value)) {
    return [{ level: 'error', message: 'Structural analysis JSON must be an object.' }];
  }

  if (value.schema !== STRUCTURAL_ANALYSIS_SCHEMA) {
    errors.push({
      level: 'error',
      message: `Unsupported structural analysis schema: ${String(value.schema)}`,
      path: '/schema',
    });
  }

  const collections = [
    'stories',
    'grids',
    'materials',
    'sections',
    'nodes',
    'linearMembers',
    'areaMembers',
    'openings',
  ] as const;
  for (const key of collections) {
    if (!Array.isArray(value[key])) {
      errors.push({
        level: 'error',
        message: `${key} must be an array.`,
        path: `/${key}`,
      });
    }
  }

  if (!isRecord(value.meta)) {
    errors.push({
      level: 'error',
      message: 'meta must be an object.',
      path: '/meta',
    });
  } else {
    if (typeof value.meta.projectId !== 'string' || value.meta.projectId.length === 0) {
      errors.push({ level: 'error', message: 'meta.projectId is required.', path: '/meta/projectId' });
    }
    if (typeof value.meta.projectName !== 'string' || value.meta.projectName.length === 0) {
      errors.push({ level: 'error', message: 'meta.projectName is required.', path: '/meta/projectName' });
    }
    if (value.meta.unit !== 'mm') {
      errors.push({ level: 'error', message: 'meta.unit must be "mm".', path: '/meta/unit' });
    }
  }

  if (Array.isArray(value.nodes)) {
    for (let index = 0; index < value.nodes.length; index++) {
      const node = value.nodes[index];
      if (!isRecord(node)) {
        errors.push({ level: 'error', message: 'Node must be an object.', path: `/nodes/${index}` });
        continue;
      }
      if (typeof node.id !== 'string' || node.id.length === 0) {
        errors.push({ level: 'error', message: 'Node id is required.', path: `/nodes/${index}/id` });
      }
      if (!isFiniteNumber(node.x) || !isFiniteNumber(node.y) || !isFiniteNumber(node.z)) {
        errors.push({
          level: 'error',
          message: 'Node coordinates must be finite numbers.',
          path: `/nodes/${index}`,
        });
      }
    }
  }

  return errors;
}

function structuralAnalysisModelToProject(model: StructuralAnalysisModel): ProjectData {
  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]));
  const storyMap = new Map(model.stories.map((story) => [story.id, story]));
  const sectionMap = new Map(model.sections.map((section) => [section.id, section]));

  const members: Member[] = [];

  for (const member of model.linearMembers) {
    const startNode = nodeMap.get(member.startNodeId);
    const endNode = nodeMap.get(member.endNodeId);
    if (!startNode || !endNode) continue;

    if (member.type === 'wall') {
      const story = storyMap.get(member.storyId);
      const section = sectionMap.get(member.sectionId);
      const thickness =
        member.thickness ??
        (section && 'thickness' in section ? section.thickness : 200);
      const height = member.height ?? story?.height ?? Math.max(endNode.z - startNode.z, 3000);

      members.push({
        id: member.id,
        type: 'wall',
        story: member.storyId,
        sectionId: member.sectionId,
        materialId: member.materialId,
        start: { x: startNode.x, y: startNode.y, z: startNode.z },
        end: { x: endNode.x, y: endNode.y, z: endNode.z },
        height,
        thickness,
        rotation: member.rotation,
        tags: member.tags,
      });
      continue;
    }

    members.push({
      id: member.id,
      type: member.type,
      story: member.storyId,
      sectionId: member.sectionId,
      materialId: member.materialId,
      start: { x: startNode.x, y: startNode.y, z: startNode.z },
      end: { x: endNode.x, y: endNode.y, z: endNode.z },
      rotation: member.rotation,
      tags: member.tags,
    });
  }

  for (const member of model.areaMembers) {
    const polygon = member.nodeIds
      .map((nodeId) => nodeMap.get(nodeId))
      .filter((node): node is StructuralAnalysisNode => Boolean(node))
      .map((node) => ({ x: node.x, y: node.y }));
    if (polygon.length < 3) continue;

    members.push({
      id: member.id,
      type: member.type,
      story: member.storyId,
      sectionId: member.sectionId,
      materialId: member.materialId,
      polygon,
      level: member.level,
      rotation: member.rotation,
      tags: member.tags,
    });
  }

  const views = createDefaultViews(model.stories, members);
  const sheets = createDefaultSheets(model.meta.projectName, model.stories);

  return {
    schemaVersion: '1.0.0',
    project: {
      id: model.meta.projectId,
      name: model.meta.projectName,
      unit: model.meta.unit,
    },
    stories: model.stories,
    grids: model.grids,
    materials: model.materials,
    sections: model.sections,
    members,
    openings: model.openings,
    annotations: [],
    dimensions: [],
    views,
    sheets,
    issues: [],
  };
}

function createDefaultViews(stories: Story[], members: Member[]): View[] {
  const views: View[] = stories.map((story) => {
    const extents = computeStoryExtents(story.id, members);
    return {
      id: `VIEW-${story.id}-PLAN`,
      type: 'plan',
      story: story.id,
      center: extents.center,
      width: extents.width,
      height: extents.height,
      rotation: 0,
    } satisfies PlanView;
  });

  if (stories.length > 0) {
    views.push({
      id: 'VIEW-3D-001',
      type: 'model3d',
      story: stories[0].id,
    });
  }

  return views;
}

function createDefaultSheets(projectName: string, stories: Story[]): Sheet[] {
  return stories.map((story, index) => ({
    id: `S-${String(index + 1).padStart(3, '0')}`,
    name: `${story.name}平面図`,
    paperSize: 'A1',
    scale: '1:100',
    viewIds: [`VIEW-${story.id}-PLAN`],
    titleBlockTemplate: 'standard',
    titleBlock: {
      projectName,
      drawingTitle: `${story.name}平面図`,
      issueDate: new Date().toISOString().slice(0, 10),
    },
  }));
}

function computeStoryExtents(storyId: string, members: Member[]): {
  center: Point2D;
  width: number;
  height: number;
} {
  const points: Point2D[] = [];
  for (const member of members) {
    if (member.story !== storyId) continue;
    if (member.type === 'slab') {
      points.push(...member.polygon);
      continue;
    }
    points.push(
      { x: member.start.x, y: member.start.y },
      { x: member.end.x, y: member.end.y },
    );
  }

  if (points.length === 0) {
    return {
      center: { x: 4000, y: 3000 },
      width: 14000,
      height: 11000,
    };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    },
    width: Math.max(maxX - minX + 4000, 8000),
    height: Math.max(maxY - minY + 4000, 6000),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
