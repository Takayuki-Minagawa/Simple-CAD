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
import Ajv2020 from 'ajv/dist/2020';
import { pointKey3D } from '@/domain/geometry/precision';
import analysisSchema from '@/schemas/structuralAnalysis.schema.json';

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
  /**
   * Non-fatal warnings raised while exporting (e.g. a missing section that was
   * substituted with a fallback dimension). Surfaced so callers don't silently
   * ship magic numbers (B7 / 2-8).
   */
  warnings?: string[];
}

export function exportStructuralAnalysisModel(data: ProjectData): StructuralAnalysisModel {
  const nodes: StructuralAnalysisNode[] = [];
  const nodeIds = new Map<string, string>();
  const warnings: string[] = [];
  const sectionMap = new Map(data.sections.map((s) => [s.id, s] as const));

  // Tolerance-quantized node key so near-coincident nodes merge into one
  // analysis node instead of splitting the model (B3 / 2-4).
  const ensureNode = (point: Point3D, storyId?: string) => {
    const key = pointKey3D(point);
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
    // Warn when a member references a section that doesn't exist — downstream
    // consumers would otherwise fall back to a default thickness/dimension
    // without any signal (B7 / 2-8).
    if (!sectionMap.has(member.sectionId)) {
      warnings.push(
        `部材 ${member.id} (${member.type}) が参照する断面 ${member.sectionId} が見つかりません`,
      );
    }
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
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export function exportStructuralAnalysisJson(data: ProjectData): string {
  return JSON.stringify(exportStructuralAnalysisModel(data), null, 2);
}

export function importStructuralAnalysisJson(
  rawContent: string,
): { ok: true; data: ProjectData; warnings?: string[] } | { ok: false; errors: ValidationError[] } {
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

  const conversion = structuralAnalysisModelToProject(parsed as StructuralAnalysisModel);
  const result = validateProject(conversion.project);
  if (!result.ok) {
    return { ok: false, errors: result.errors };
  }

  return {
    ok: true,
    data: conversion.project,
    ...(conversion.warnings.length > 0 ? { warnings: conversion.warnings } : {}),
  };
}

const ajv = new Ajv2020({ allErrors: true });
const validateAnalysisSchema = ajv.compile(analysisSchema);

/**
 * Validate the structural-analysis JSON with the JSON Schema (3-6) plus
 * reference-integrity checks that schema alone cannot express (every member's
 * node references must resolve to a declared node).
 */
function validateStructuralAnalysisModel(value: unknown): ValidationError[] {
  // The schema enforces the unsupported-schema message ordering expectation of
  // the existing tests, so check the discriminator first for a friendly message.
  if (isRecord(value) && value.schema !== STRUCTURAL_ANALYSIS_SCHEMA) {
    return [
      {
        level: 'error',
        message: `Unsupported structural analysis schema: ${String(value.schema)}`,
        path: '/schema',
      },
    ];
  }

  const valid = validateAnalysisSchema(value);
  if (!valid) {
    return (validateAnalysisSchema.errors ?? []).map((e) => ({
      level: 'error' as const,
      message: `Schema: ${e.instancePath || '/'} ${e.message ?? 'unknown error'}`,
      path: e.instancePath || undefined,
    }));
  }

  // Reference integrity: node ids referenced by members must exist.
  const model = value as unknown as StructuralAnalysisModel;
  const errors: ValidationError[] = [];
  const nodeIds = new Set(model.nodes.map((n) => n.id));
  for (const m of model.linearMembers) {
    if (!nodeIds.has(m.startNodeId)) {
      errors.push({ level: 'error', message: `linearMember ${m.id} references missing startNode ${m.startNodeId}`, path: `/linearMembers` });
    }
    if (!nodeIds.has(m.endNodeId)) {
      errors.push({ level: 'error', message: `linearMember ${m.id} references missing endNode ${m.endNodeId}`, path: `/linearMembers` });
    }
  }

  return errors;
}

function structuralAnalysisModelToProject(model: StructuralAnalysisModel): {
  project: ProjectData;
  warnings: string[];
} {
  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]));
  const storyMap = new Map(model.stories.map((story) => [story.id, story]));
  const sectionMap = new Map(model.sections.map((section) => [section.id, section]));
  const warnings: string[] = [];

  const members: Member[] = [];

  for (const member of model.linearMembers) {
    const startNode = nodeMap.get(member.startNodeId);
    const endNode = nodeMap.get(member.endNodeId);
    if (!startNode || !endNode) {
      // Don't silently drop: surface a warning so import counts aren't reduced
      // without any signal (B6).
      const missing = [!startNode ? member.startNodeId : null, !endNode ? member.endNodeId : null]
        .filter(Boolean)
        .join(', ');
      warnings.push(`部材 ${member.id} を取り込めませんでした: 節点 ${missing} が存在しません`);
      continue;
    }

    if (member.type === 'wall') {
      const story = storyMap.get(member.storyId);
      const section = sectionMap.get(member.sectionId);
      const hasThickness =
        member.thickness !== undefined || (section && 'thickness' in section);
      const thickness =
        member.thickness ??
        (section && 'thickness' in section ? section.thickness : 200);
      if (!hasThickness) {
        warnings.push(`壁 ${member.id} の厚さが不明のため既定値 200mm を使用しました`);
      }
      const hasHeight = member.height !== undefined || story?.height !== undefined;
      const height = member.height ?? story?.height ?? Math.max(endNode.z - startNode.z, 3000);
      if (!hasHeight) {
        warnings.push(`壁 ${member.id} の高さが不明のため既定値を使用しました`);
      }

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
    const resolvedNodes = member.nodeIds.map((nodeId) => nodeMap.get(nodeId));
    const missing = member.nodeIds.filter((_, i) => !resolvedNodes[i]);
    if (missing.length > 0) {
      warnings.push(`スラブ ${member.id} の節点 ${missing.join(', ')} が存在しません`);
    }
    const polygon = resolvedNodes
      .filter((node): node is StructuralAnalysisNode => Boolean(node))
      .map((node) => ({ x: node.x, y: node.y }));
    if (polygon.length < 3) {
      warnings.push(`スラブ ${member.id} を取り込めませんでした: 有効な節点が ${polygon.length} 個のみ`);
      continue;
    }

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

  const project: ProjectData = {
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
    issues: warnings.map((message) => ({ level: 'warning' as const, message })),
  };

  return { project, warnings };
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
