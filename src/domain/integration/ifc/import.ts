import type { Point3D } from '@/domain/geometry/types';
import type { Member, ProjectData, Section } from '@/domain/structural/types';
import { validateProject } from '@/domain/validation';
import type { ValidationError } from '@/domain/validation';
import { add3, applyTransform2D, scale3 } from './geometry';
import { createDefaultSheets, createDefaultViews } from './projectDefaults';
import { resolveElementName, resolveIfcElement, resolveProjectName } from './resolve';
import { parseIfcEntities } from './step';
import {
  buildStoryHeights,
  collectIfcStories,
  resolveElementStoryId,
  resolveStoryMembership,
} from './stories';
import { resolveLengthUnitScale } from './units';
import type { ResolvedSolid, StepEntity } from './types';

const MATERIAL_ID = 'MAT-IFC';
const SUPPORTED_ELEMENT_TYPES = ['IFCCOLUMN', 'IFCBEAM', 'IFCWALL', 'IFCSLAB'];

export function importIfc(
  rawContent: string,
): { ok: true; data: ProjectData } | { ok: false; errors: ValidationError[] } {
  let entities: Map<number, StepEntity>;
  try {
    entities = parseIfcEntities(rawContent);
  } catch (error) {
    return {
      ok: false,
      errors: [{ level: 'error', message: `IFC parse error: ${String(error)}` }],
    };
  }

  const supportedElements = [...entities.values()].filter((entity) =>
    SUPPORTED_ELEMENT_TYPES.includes(entity.type),
  );
  if (supportedElements.length === 0) {
    return {
      ok: false,
      errors: [{ level: 'error', message: 'No supported IFC elements were found.' }],
    };
  }

  // Resolve the IFC length unit; we work internally in mm (3-3).
  const unitScale = resolveLengthUnitScale(entities);

  const storyMembership = resolveStoryMembership(entities);
  const rawStories = collectIfcStories(entities);
  const inferredStories = rawStories.length > 0 ? rawStories : [{ id: '1F', name: '1F', elevation: 0 }];
  const builtStories = buildStoryHeights(inferredStories, supportedElements, storyMembership, entities);
  const stories =
    unitScale === 1
      ? builtStories
      : builtStories.map((s) => ({ ...s, elevation: s.elevation * unitScale, height: s.height * unitScale }));

  const sections = new Map<string, Section>();
  const members: Member[] = [];

  for (const entity of supportedElements) {
    const resolved = resolveIfcElement(entity, entities);
    if (!resolved) continue;

    const scaled = unitScale === 1 ? resolved : scaleResolvedSolid(resolved, unitScale);
    const storyId = resolveElementStoryId(entity.id, stories, storyMembership, scaled, entities);
    if (!storyId) continue;

    const member = convertElement(entity, scaled, storyId, sections);
    if (member) members.push(member);
  }

  if (members.length === 0) {
    return {
      ok: false,
      errors: [{ level: 'error', message: 'Failed to extract supported IFC members.' }],
    };
  }

  const views = createDefaultViews(stories, members);
  const sheets = createDefaultSheets('IFC Import', stories);
  const project: ProjectData = {
    schemaVersion: '1.0.0',
    project: {
      id: `ifc-${Date.now()}`,
      name: resolveProjectName(entities) ?? 'IFC Import',
      unit: 'mm',
    },
    stories,
    grids: [],
    materials: [{ id: MATERIAL_ID, name: 'IFC Default', type: 'concrete' }],
    sections: [...sections.values()],
    members,
    openings: [],
    annotations: [],
    dimensions: [],
    views,
    sheets,
    issues: [],
  };

  const validation = validateProject(project);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  return { ok: true, data: project };
}

/** Scale a resolved solid from source units into millimetres (3-3). */
function scaleResolvedSolid(resolved: ResolvedSolid, scale: number): ResolvedSolid {
  const profile =
    resolved.profile.kind === 'rectangle'
      ? { kind: 'rectangle' as const, xDim: resolved.profile.xDim * scale, yDim: resolved.profile.yDim * scale }
      : {
          kind: 'polyline' as const,
          points: resolved.profile.points.map((p) => ({ x: p.x * scale, y: p.y * scale })),
        };
  return {
    profile,
    depth: resolved.depth * scale,
    transform: {
      ...resolved.transform,
      origin: {
        x: resolved.transform.origin.x * scale,
        y: resolved.transform.origin.y * scale,
        z: resolved.transform.origin.z * scale,
      },
    },
  };
}

function convertElement(
  entity: StepEntity,
  resolved: ResolvedSolid,
  storyId: string,
  sections: Map<string, Section>,
): Member | null {
  switch (entity.type) {
    case 'IFCCOLUMN':
      return convertLinearElement(entity, resolved, storyId, sections, 'column', 'rc_column_rect');
    case 'IFCBEAM':
      return convertLinearElement(entity, resolved, storyId, sections, 'beam', 'rc_beam_rect');
    case 'IFCWALL': {
      if (resolved.profile.kind !== 'rectangle') return null;
      const sectionId = ensureSection(sections, {
        id: '',
        kind: 'rc_wall',
        thickness: resolved.profile.xDim,
      });
      const { start, end } = extrusionSpan(resolved);
      return {
        id: resolveElementName(entity),
        type: 'wall',
        story: storyId,
        sectionId,
        materialId: MATERIAL_ID,
        start,
        end,
        height: resolved.profile.yDim,
        thickness: resolved.profile.xDim,
      };
    }
    case 'IFCSLAB': {
      if (resolved.profile.kind !== 'polyline') return null;
      const sectionId = ensureSection(sections, {
        id: '',
        kind: 'rc_slab',
        thickness: resolved.depth,
      });
      const polygon = resolved.profile.points.map((point) =>
        applyTransform2D(resolved.transform, point),
      );
      return {
        id: resolveElementName(entity),
        type: 'slab',
        story: storyId,
        sectionId,
        materialId: MATERIAL_ID,
        polygon,
        level: resolved.transform.origin.z + resolved.depth,
      };
    }
    default:
      return null;
  }
}

function convertLinearElement(
  entity: StepEntity,
  resolved: ResolvedSolid,
  storyId: string,
  sections: Map<string, Section>,
  type: 'column' | 'beam',
  kind: 'rc_column_rect' | 'rc_beam_rect',
): Member | null {
  if (resolved.profile.kind !== 'rectangle') return null;
  const sectionId = ensureSection(sections, {
    id: '',
    kind,
    width: resolved.profile.xDim,
    depth: resolved.profile.yDim,
  });
  const { start, end } = extrusionSpan(resolved);
  // Recover in-plane rotation for columns from the placement x-axis (B5 / 3-8).
  // Beams encode their direction in start/end, so rotation stays implicit there.
  let rotation: number | undefined;
  if (type === 'column') {
    const x = resolved.transform.xAxis;
    const angle = Math.atan2(x.y, x.x);
    if (Math.abs(angle) > 1e-6) rotation = angle;
  }
  return {
    id: resolveElementName(entity),
    type,
    story: storyId,
    sectionId,
    materialId: MATERIAL_ID,
    start,
    end,
    ...(rotation !== undefined ? { rotation } : {}),
  };
}

function extrusionSpan(resolved: ResolvedSolid): { start: Point3D; end: Point3D } {
  const start = resolved.transform.origin;
  return {
    start,
    end: add3(start, scale3(resolved.transform.zAxis, resolved.depth)),
  };
}

function ensureSection(sections: Map<string, Section>, section: Section): string {
  const key = JSON.stringify(section);
  const existing = [...sections.values()].find((item) => JSON.stringify(item) === key);
  if (existing) return existing.id;

  const id =
    section.kind === 'rc_column_rect'
      ? `SEC-C${section.width}x${section.depth}`
      : section.kind === 'rc_beam_rect'
        ? `SEC-B${section.width}x${section.depth}`
        : section.kind === 's_column_h'
          ? `SEC-HC${section.width}x${section.depth}`
          : section.kind === 's_beam_h'
            ? `SEC-HB${section.width}x${section.depth}`
            : section.kind === 's_pipe'
              ? `SEC-P${section.diameter}`
              : section.kind === 'rc_wall'
                ? `SEC-W${section.thickness}`
                : `SEC-S${section.thickness}`;

  const next = { ...section, id };
  sections.set(id, next);
  return id;
}
