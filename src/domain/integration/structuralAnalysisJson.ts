import type { Point3D } from '@/domain/geometry/types';
import type {
  AnalysisResultsMetadata,
  AreaLoad,
  Diaphragm,
  Grid,
  LoadCase,
  LoadCombination,
  LumpedMass,
  Material,
  Member,
  MemberLoad,
  NodalLoad,
  ProjectData,
  Section,
  Story,
  StructuralSupport,
} from '@/domain/structural/types';
import { validateProject } from '@/domain/validation';
import type { ValidationError } from '@/domain/validation';
import {
  JOINT_MERGE_TOLERANCE,
  SpatialPointIndex3D,
  quantizePoint3D,
} from '@/domain/geometry/precision';
import { validateGeometry, validateReferences } from '@/domain/validation';
import { normalizeProjectCoordinates } from '@/domain/geometry/projectCoordinates';
import { createDefaultSheets, createDefaultViews } from '@/domain/structural/projectDefaults';
import { nowIsoString } from '@/domain/time';
import {
  computeStructuralAnalysisLoads,
  type StructuralAnalysisLoads,
} from './structuralAnalysisLoads';
import { validateStructuralAnalysisModel } from './structuralAnalysisValidation';

export const STRUCTURAL_ANALYSIS_SCHEMA = 'simple-cad.structural-analysis/v1';
export type {
  StructuralAnalysisLoads,
  StructuralAnalysisMemberLoad,
} from './structuralAnalysisLoads';

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
  /**
   * Axis-line eccentricity in member-local coordinates (mm), passed through so
   * the analysis model can offset the member axis from the drawn centreline
   * (2-6). Only emitted when the source member declares an offset, so members
   * without eccentricity stay byte-identical to before.
   */
  axisOffset?: { dx: number; dy: number };
  releases?: Member['releases'];
  rigidZones?: Member['rigidZones'];
  localAxis?: Member['localAxis'];
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

export interface StructuralAnalysisSupport extends Omit<StructuralSupport, 'position'> {
  nodeId: string;
}

export interface StructuralAnalysisNodalLoad extends Omit<NodalLoad, 'position'> {
  nodeId: string;
}

export interface StructuralAnalysisLumpedMass extends Omit<LumpedMass, 'position'> {
  nodeId: string;
}

export interface StructuralAnalysisDiaphragm extends Omit<Diaphragm, 'masterPosition'> {
  masterNodeId?: string;
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
   * Load cases declared on the project, passed through for the analysis engine
   * (2-7). Optional / only emitted when present.
   */
  loadCases?: LoadCase[];
  /**
   * Auto-computed self-weight + superimposed area loads (2-7). Optional and
   * additive: omitted entirely when nothing could be derived.
   */
  loads?: StructuralAnalysisLoads;
  supports?: StructuralAnalysisSupport[];
  nodalLoads?: StructuralAnalysisNodalLoad[];
  memberLoads?: MemberLoad[];
  areaLoads?: AreaLoad[];
  loadCombinations?: LoadCombination[];
  masses?: StructuralAnalysisLumpedMass[];
  diaphragms?: StructuralAnalysisDiaphragm[];
  analysisResults?: AnalysisResultsMetadata;
  /**
   * Non-fatal warnings raised while exporting (e.g. a missing section that was
   * substituted with a fallback dimension). Surfaced so callers don't silently
   * ship magic numbers (B7 / 2-8).
   */
  warnings?: string[];
}

export function exportStructuralAnalysisModel(data: ProjectData): StructuralAnalysisModel {
  const nodes: StructuralAnalysisNode[] = [];
  const nodeIndex = new SpatialPointIndex3D<string>(JOINT_MERGE_TOLERANCE);
  const warnings: string[] = [];
  const sectionMap = new Map(data.sections.map((s) => [s.id, s] as const));
  const materialMap = new Map(data.materials.map((m) => [m.id, m] as const));
  const storyIds = new Set(data.stories.map((story) => story.id));

  // Tolerance-quantized node key so near-coincident nodes merge into one
  // analysis node instead of splitting the model (B3 / 2-4).
  const ensureNode = (point: Point3D, storyId?: string) => {
    const normalized = quantizePoint3D(point);
    const existing = nodeIndex.find(normalized);
    if (existing) return existing;

    const id = `N-${String(nodes.length + 1).padStart(4, '0')}`;
    nodes.push({
      id,
      x: normalized.x,
      y: normalized.y,
      z: normalized.z,
      storyId,
    });
    nodeIndex.insert(normalized, id);
    return id;
  };

  for (const issue of [...validateReferences(data).errors, ...validateGeometry(data).errors]) {
    warnings.push(`Export validation: ${issue.message}`);
  }

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
      continue;
    }
    const section = sectionMap.get(member.sectionId)!;
    if (!isCompatibleSection(member, section)) {
      warnings.push(`部材 ${member.id} (${member.type}) と断面種別 ${section.kind} が互換でないためスキップしました`);
      continue;
    }
    if (!materialMap.has(member.materialId)) {
      warnings.push(`部材 ${member.id} が参照する材料 ${member.materialId} が見つからないためスキップしました`);
      continue;
    }
    if (!storyIds.has(member.story)) {
      warnings.push(`部材 ${member.id} が参照する階 ${member.story} が見つからないためスキップしました`);
      continue;
    }
    if (member.type === 'slab') {
      const nodeIds = member.polygon.map((point) =>
        ensureNode({ x: point.x, y: point.y, z: member.level }, member.story),
      );
      const uniqueNodeIds = [...new Set(nodeIds)];
      if (uniqueNodeIds.length < 3) {
        warnings.push(`スラブ ${member.id} は統合後の有効節点が3未満のためスキップしました`);
        continue;
      }
      areaMembers.push({
        id: member.id,
        type: 'slab',
        storyId: member.story,
        sectionId: member.sectionId,
        materialId: member.materialId,
        nodeIds: uniqueNodeIds,
        level: member.level,
        rotation: member.rotation,
        tags: member.tags,
      });
      continue;
    }

    const startNodeId = ensureNode(member.start, member.story);
    const endNodeId = ensureNode(member.end, member.story);
    if (startNodeId === endNodeId) {
      warnings.push(`部材 ${member.id} は節点統合許容差 ${JOINT_MERGE_TOLERANCE}mm 内で長さ0となるためスキップしました`);
      continue;
    }
    linearMembers.push({
      id: member.id,
      type: member.type,
      storyId: member.story,
      sectionId: member.sectionId,
      materialId: member.materialId,
      startNodeId,
      endNodeId,
      height: member.type === 'wall' ? member.height : undefined,
      thickness: member.type === 'wall' ? member.thickness : undefined,
      rotation: member.rotation,
      tags: member.tags,
      // Pass member-local eccentricity through only when present so members
      // without an offset stay byte-identical to the previous output (2-6).
      ...(member.axisOffset ? { axisOffset: member.axisOffset } : {}),
      ...(member.releases ? { releases: member.releases } : {}),
      ...(member.rigidZones ? { rigidZones: member.rigidZones } : {}),
      ...(member.localAxis ? { localAxis: member.localAxis } : {}),
    });
  }

  const exportedLinearIds = new Set(linearMembers.map((member) => member.id));
  const exportedAreaIds = new Set(areaMembers.map((member) => member.id));
  const exportedMemberIds = new Set([...exportedLinearIds, ...exportedAreaIds]);
  const loadCaseIds = new Set((data.loadCases ?? []).map((loadCase) => loadCase.id));
  const loadsRaw = computeStructuralAnalysisLoads(data, materialMap);
  const loads = loadsRaw
    ? {
        selfWeight: loadsRaw.selfWeight.filter((load) => exportedMemberIds.has(load.memberId)),
        areaLoads: loadsRaw.areaLoads.filter((load) => exportedAreaIds.has(load.memberId)),
      }
    : undefined;
  const supports = data.supports
    ?.filter((support) => storyIds.has(support.storyId))
    .map(({ position, ...support }) => ({
      ...support,
      nodeId: ensureNode(position, support.storyId),
    }));
  const nodalLoads = data.nodalLoads
    ?.filter((load) => storyIds.has(load.storyId) && loadCaseIds.has(load.loadCaseId))
    .map(({ position, ...load }) => ({
      ...load,
      nodeId: ensureNode(position, load.storyId),
    }));
  const masses = data.masses
    ?.filter((mass) => storyIds.has(mass.storyId))
    .map(({ position, ...mass }) => ({
      ...mass,
      nodeId: ensureNode(position, mass.storyId),
    }));
  const diaphragms = data.diaphragms
    ?.filter((diaphragm) => storyIds.has(diaphragm.storyId))
    .map(({ masterPosition, ...diaphragm }) => ({
      ...diaphragm,
      memberIds: diaphragm.memberIds?.filter((memberId) => exportedMemberIds.has(memberId)),
      ...(masterPosition
        ? { masterNodeId: ensureNode(masterPosition, diaphragm.storyId) }
        : {}),
    }));
  const openings = data.openings.filter((opening) => exportedMemberIds.has(opening.memberId));
  const memberLoads = data.memberLoads?.filter(
    (load) => exportedLinearIds.has(load.memberId) && loadCaseIds.has(load.loadCaseId),
  );
  const areaLoads = data.areaLoads?.filter(
    (load) => exportedAreaIds.has(load.memberId) && loadCaseIds.has(load.loadCaseId),
  );

  return {
    schema: STRUCTURAL_ANALYSIS_SCHEMA,
    meta: {
      source: 'Simple-CAD',
      projectId: data.project.id,
      projectName: data.project.name,
      unit: data.project.unit,
      generatedAt: nowIsoString(),
    },
    stories: data.stories,
    grids: data.grids,
    materials: data.materials,
    sections: data.sections,
    nodes,
    linearMembers,
    areaMembers,
    openings,
    ...(data.loadCases && data.loadCases.length > 0 ? { loadCases: data.loadCases } : {}),
    ...(loads && (loads.selfWeight.length > 0 || loads.areaLoads.length > 0) ? { loads } : {}),
    ...(supports && supports.length > 0 ? { supports } : {}),
    ...(nodalLoads && nodalLoads.length > 0 ? { nodalLoads } : {}),
    ...(memberLoads && memberLoads.length > 0 ? { memberLoads } : {}),
    ...(areaLoads && areaLoads.length > 0 ? { areaLoads } : {}),
    ...(data.loadCombinations && data.loadCombinations.length > 0
      ? { loadCombinations: data.loadCombinations }
      : {}),
    ...(masses && masses.length > 0 ? { masses } : {}),
    ...(diaphragms && diaphragms.length > 0 ? { diaphragms } : {}),
    ...(data.analysisResults ? { analysisResults: data.analysisResults } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export function exportStructuralAnalysisJson(data: ProjectData): string {
  return JSON.stringify(exportStructuralAnalysisModel(data), null, 2);
}

function isCompatibleSection(member: Member, section: Section): boolean {
  switch (member.type) {
    case 'column':
      return ['rc_column_rect', 's_column_h', 's_pipe'].includes(section.kind);
    case 'beam':
      return ['rc_beam_rect', 's_beam_h', 's_pipe'].includes(section.kind);
    case 'wall':
      return section.kind === 'rc_wall';
    case 'slab':
      return section.kind === 'rc_slab';
  }
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

  const validationErrors = validateStructuralAnalysisModel(parsed, STRUCTURAL_ANALYSIS_SCHEMA);
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

function structuralAnalysisModelToProject(model: StructuralAnalysisModel): {
  project: ProjectData;
  warnings: string[];
} {
  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]));
  const storyMap = new Map(model.stories.map((story) => [story.id, story]));
  const sectionMap = new Map(model.sections.map((section) => [section.id, section]));
  const warnings: string[] = [...(model.warnings ?? [])];

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
      const hasThickness = member.thickness !== undefined || (section && 'thickness' in section);
      const thickness =
        member.thickness ?? (section && 'thickness' in section ? section.thickness : 200);
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
        ...(member.axisOffset ? { axisOffset: member.axisOffset } : {}),
        ...(member.releases ? { releases: member.releases } : {}),
        ...(member.rigidZones ? { rigidZones: member.rigidZones } : {}),
        ...(member.localAxis ? { localAxis: member.localAxis } : {}),
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
      ...(member.axisOffset ? { axisOffset: member.axisOffset } : {}),
      ...(member.releases ? { releases: member.releases } : {}),
      ...(member.rigidZones ? { rigidZones: member.rigidZones } : {}),
      ...(member.localAxis ? { localAxis: member.localAxis } : {}),
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
      warnings.push(
        `スラブ ${member.id} を取り込めませんでした: 有効な節点が ${polygon.length} 個のみ`,
      );
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
    ...(model.loadCases && model.loadCases.length > 0 ? { loadCases: model.loadCases } : {}),
    ...(model.supports && model.supports.length > 0
      ? {
          supports: model.supports.flatMap(({ nodeId, ...support }) => {
            const node = nodeMap.get(nodeId);
            if (!node) return [];
            return [{ ...support, position: { x: node.x, y: node.y, z: node.z } }];
          }),
        }
      : {}),
    ...(model.nodalLoads && model.nodalLoads.length > 0
      ? {
          nodalLoads: model.nodalLoads.flatMap(({ nodeId, ...load }) => {
            const node = nodeMap.get(nodeId);
            if (!node) return [];
            return [{ ...load, position: { x: node.x, y: node.y, z: node.z } }];
          }),
        }
      : {}),
    ...(model.memberLoads && model.memberLoads.length > 0
      ? { memberLoads: model.memberLoads }
      : {}),
    ...(model.areaLoads && model.areaLoads.length > 0 ? { areaLoads: model.areaLoads } : {}),
    ...(model.loadCombinations && model.loadCombinations.length > 0
      ? { loadCombinations: model.loadCombinations }
      : {}),
    ...(model.masses && model.masses.length > 0
      ? {
          masses: model.masses.flatMap(({ nodeId, ...mass }) => {
            const node = nodeMap.get(nodeId);
            if (!node) return [];
            return [{ ...mass, position: { x: node.x, y: node.y, z: node.z } }];
          }),
        }
      : {}),
    ...(model.diaphragms && model.diaphragms.length > 0
      ? {
          diaphragms: model.diaphragms.map(({ masterNodeId, ...diaphragm }) => {
            const node = masterNodeId ? nodeMap.get(masterNodeId) : undefined;
            return {
              ...diaphragm,
              ...(node ? { masterPosition: { x: node.x, y: node.y, z: node.z } } : {}),
            };
          }),
        }
      : {}),
    ...(model.analysisResults ? { analysisResults: model.analysisResults } : {}),
  };

  return { project: normalizeProjectCoordinates(project), warnings };
}
