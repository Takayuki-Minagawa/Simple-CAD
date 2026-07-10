import type { Point3D } from '@/domain/geometry/types';
import type { Material, Member, Opening, ProjectData, Section } from '@/domain/structural/types';
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
import { resolveLengthUnit } from './units';
import type { ResolvedSolid, StepEntity } from './types';
import { asRef, asRefList, asString } from './step';
import { quantizePoint3D } from '@/domain/geometry/precision';
import { normalizeProjectCoordinates } from '@/domain/geometry/projectCoordinates';
import {
  columnAxisOffsetToWorld,
  effectiveLinearAxisOffset,
  linearAxisOffsetToWorld,
  slabAxisOffsetToWorld,
} from '@/domain/structural/eccentricity';
import { getBeamRectSize, getWallThickness } from '@/domain/structural/memberShape';
import { recoverMemberRoll } from '@/domain/structural/localAxis';
import {
  decodeIfcMemberMetadata,
  decodeIfcOpeningMetadata,
  type IfcMemberMetadata,
} from './simpleCadMetadata';
import { migrateLegacyMaterials } from '@/domain/migration';

const MATERIAL_ID = 'MAT-IFC';
const SUPPORTED_ELEMENT_TYPES = ['IFCCOLUMN', 'IFCBEAM', 'IFCWALL', 'IFCSLAB'];

export function importIfc(
  rawContent: string,
):
  | { ok: true; data: ProjectData; warnings?: string[] }
  | { ok: false; errors: ValidationError[] } {
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
  const unitResolution = resolveLengthUnit(entities);
  const unitScale = unitResolution.scale;
  const warnings: string[] = [];
  if (unitResolution.status === 'missing') {
    warnings.push('IFCに長さ単位が定義されていないため mm と仮定しました');
  } else if (unitResolution.status === 'unsupported') {
    warnings.push('IFCの長さ単位を解決できないため mm と仮定しました');
  }

  const storyMembership = resolveStoryMembership(entities);
  const rawStories = collectIfcStories(entities);
  const inferredStories = rawStories.length > 0 ? rawStories : [{ id: '1F', name: '1F', elevation: 0 }];
  // buildStoryHeights scales source-unit elevations/extents into mm internally
  // (so its mm fallbacks stay correct); do NOT post-multiply here.
  const stories = buildStoryHeights(
    inferredStories,
    supportedElements,
    storyMembership,
    entities,
    unitScale,
  );
  const storyIdByEntityRef = new Map(
    rawStories.flatMap((story) =>
      story.sourceEntityId === undefined ? [] : [[story.sourceEntityId, story.id] as const],
    ),
  );

  const sections = new Map<string, Section>();
  const members: Member[] = [];
  const memberByEntityId = new Map<number, Member>();
  const materialResolution = resolveIfcMaterials(entities, warnings);
  const usedMemberIds = new Set<string>();

  for (const entity of supportedElements) {
    const resolved = resolveIfcElement(entity, entities);
    if (!resolved) {
      warnings.push(`${entity.type} #${entity.id} の押出形状を解決できないためスキップしました`);
      continue;
    }

    const scaled = unitScale === 1 ? resolved : scaleResolvedSolid(resolved, unitScale);
    const storyId = resolveElementStoryId(
      entity.id,
      stories,
      storyMembership,
      scaled,
      entities,
      storyIdByEntityRef,
    );
    if (!storyId) {
      warnings.push(`${entity.type} #${entity.id} の階を解決できないためスキップしました`);
      continue;
    }

    const materialId =
      materialResolution.memberMaterialIds.get(entity.id) ?? materialResolution.fallbackMaterialId;
    const memberId = reserveUniqueId(resolveElementName(entity), usedMemberIds, `IFC-${entity.id}`);
    const member = convertElement(entity, scaled, storyId, sections, materialId, memberId);
    if (member) {
      members.push(member);
      memberByEntityId.set(entity.id, member);
    } else {
      warnings.push(`${entity.type} #${entity.id} の断面形状に対応できないためスキップしました`);
    }
  }

  if (members.length === 0) {
    return {
      ok: false,
      errors: [{ level: 'error', message: 'Failed to extract supported IFC members.' }],
    };
  }

  const views = createDefaultViews(stories, members);
  const sheets = createDefaultSheets('IFC Import', stories);
  const openings = resolveIfcOpenings(
    entities,
    unitScale,
    memberByEntityId,
    sections,
    usedMemberIds,
    warnings,
  );
  const usedMaterialIds = new Set(members.map((member) => member.materialId));
  const materials = materialResolution.materials.filter((material) => usedMaterialIds.has(material.id));
  if (usedMaterialIds.has(materialResolution.fallbackMaterialId)) {
    materials.push({
      id: materialResolution.fallbackMaterialId,
      name: 'IFC Default',
      type: 'concrete',
    });
    warnings.push('材料関連付けの無いIFC部材には既定材料を割り当てました');
  }
  const project: ProjectData = {
    schemaVersion: '1.0.0',
    project: {
      id: `ifc-${Date.now()}`,
      name: resolveProjectName(entities) ?? 'IFC Import',
      unit: 'mm',
    },
    stories,
    grids: [],
    materials,
    sections: [...sections.values()],
    members,
    openings,
    annotations: [],
    dimensions: [],
    views,
    sheets,
    issues: warnings.map((message) => ({ level: 'warning', message })),
  };

  const normalizedProject = normalizeProjectCoordinates(project);
  const validation = validateProject(normalizedProject);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  return {
    ok: true,
    data: normalizedProject,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

/** Scale a resolved solid from source units into millimetres (3-3). */
function scaleResolvedSolid(resolved: ResolvedSolid, scale: number): ResolvedSolid {
  const profile = (() => {
    switch (resolved.profile.kind) {
      case 'rectangle':
        return {
          kind: 'rectangle' as const,
          xDim: resolved.profile.xDim * scale,
          yDim: resolved.profile.yDim * scale,
          ...(resolved.profile.sourceSectionId
            ? { sourceSectionId: resolved.profile.sourceSectionId }
            : {}),
          ...scaleProfilePlacement(resolved.profile.placement, scale),
        };
      case 'polyline':
        return {
          kind: 'polyline' as const,
          points: resolved.profile.points.map((p) => ({ x: p.x * scale, y: p.y * scale })),
          ...(resolved.profile.sourceSectionId
            ? { sourceSectionId: resolved.profile.sourceSectionId }
            : {}),
          ...scaleProfilePlacement(resolved.profile.placement, scale),
        };
      case 'iShape':
        return {
          kind: 'iShape' as const,
          overallWidth: resolved.profile.overallWidth * scale,
          overallDepth: resolved.profile.overallDepth * scale,
          webThickness: resolved.profile.webThickness * scale,
          flangeThickness: resolved.profile.flangeThickness * scale,
          ...(resolved.profile.sourceSectionId
            ? { sourceSectionId: resolved.profile.sourceSectionId }
            : {}),
          ...scaleProfilePlacement(resolved.profile.placement, scale),
        };
      case 'hollowCircle':
        return {
          kind: 'hollowCircle' as const,
          diameter: resolved.profile.diameter * scale,
          wallThickness: resolved.profile.wallThickness * scale,
          ...(resolved.profile.sourceSectionId
            ? { sourceSectionId: resolved.profile.sourceSectionId }
            : {}),
          ...scaleProfilePlacement(resolved.profile.placement, scale),
        };
    }
  })();
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

function scaleProfilePlacement(
  placement: import('./types').ProfilePlacement2D | undefined,
  scale: number,
): { placement?: import('./types').ProfilePlacement2D } {
  if (!placement) return {};
  return {
    placement: {
      ...placement,
      origin: { x: placement.origin.x * scale, y: placement.origin.y * scale },
    },
  };
}

function convertElement(
  entity: StepEntity,
  resolved: ResolvedSolid,
  storyId: string,
  sections: Map<string, Section>,
  materialId: string,
  memberId: string,
): Member | null {
  const metadata = decodeIfcMemberMetadata(asString(entity.args[3]));
  switch (entity.type) {
    case 'IFCCOLUMN':
      return convertLinearElement(
        resolved,
        storyId,
        sections,
        materialId,
        memberId,
        'column',
        metadata,
      );
    case 'IFCBEAM':
      return convertLinearElement(
        resolved,
        storyId,
        sections,
        materialId,
        memberId,
        'beam',
        metadata,
      );
    case 'IFCWALL': {
      if (resolved.profile.kind !== 'rectangle') return null;
      const sectionId = ensureSection(sections, {
        id: resolved.profile.sourceSectionId ?? '',
        kind: 'rc_wall',
        thickness: resolved.profile.xDim,
      });
      const rawSpan = extrusionSpan(resolved);
      const { start, end } = restoreLinearReferenceSpan(
        'wall',
        rawSpan,
        { id: sectionId, kind: 'rc_wall', thickness: resolved.profile.xDim },
        metadata,
      );
      const recoveredRoll = recoverMemberRoll(rawSpan.start, rawSpan.end, resolved.transform.xAxis);
      const rotation =
        metadata?.rotation ?? (Math.abs(recoveredRoll) > 1e-6 ? recoveredRoll : undefined);
      return {
        id: memberId,
        type: 'wall',
        story: storyId,
        sectionId,
        materialId,
        start,
        end,
        height: resolved.profile.yDim,
        thickness: resolved.profile.xDim,
        ...(rotation !== undefined ? { rotation } : {}),
        ...metadataProperties(metadata, false),
      };
    }
    case 'IFCSLAB': {
      if (resolved.profile.kind !== 'polyline') return null;
      const sectionId = ensureSection(sections, {
        id: resolved.profile.sourceSectionId ?? '',
        kind: 'rc_slab',
        thickness: resolved.depth,
      });
      let polygon = resolved.profile.points.map((point) =>
        applyTransform2D(resolved.transform, point),
      );
      if (metadata?.axisOffset) {
        const offset = slabAxisOffsetToWorld(metadata.axisOffset);
        polygon = polygon.map((point) => ({ x: point.x - offset.x, y: point.y - offset.y }));
      }
      return {
        id: memberId,
        type: 'slab',
        story: storyId,
        sectionId,
        materialId,
        polygon,
        level: resolved.transform.origin.z + resolved.depth,
        ...metadataProperties(metadata),
      };
    }
    default:
      return null;
  }
}

function convertLinearElement(
  resolved: ResolvedSolid,
  storyId: string,
  sections: Map<string, Section>,
  materialId: string,
  memberId: string,
  type: 'column' | 'beam',
  metadata: ReturnType<typeof decodeIfcMemberMetadata>,
): Member | null {
  let section: Section;
  switch (resolved.profile.kind) {
    case 'rectangle':
      section = {
        id: resolved.profile.sourceSectionId ?? '',
        kind: type === 'column' ? 'rc_column_rect' : 'rc_beam_rect',
        width: resolved.profile.xDim,
        depth: resolved.profile.yDim,
      };
      break;
    case 'iShape':
      section = {
        id: resolved.profile.sourceSectionId ?? '',
        kind: type === 'column' ? 's_column_h' : 's_beam_h',
        width: resolved.profile.overallWidth,
        depth: resolved.profile.overallDepth,
        tw: resolved.profile.webThickness,
        tf: resolved.profile.flangeThickness,
      };
      break;
    case 'hollowCircle':
      section = {
        id: resolved.profile.sourceSectionId ?? '',
        kind: 's_pipe',
        diameter: resolved.profile.diameter,
        thickness: resolved.profile.wallThickness,
      };
      break;
    default:
      return null;
  }
  const sectionId = ensureSection(sections, section);
  const rawSpan = extrusionSpan(resolved);
  const { start, end } = restoreLinearReferenceSpan(type, rawSpan, section, metadata);
  const recoveredRoll = recoverMemberRoll(rawSpan.start, rawSpan.end, resolved.transform.xAxis);
  const rotation = metadata?.rotation ?? (Math.abs(recoveredRoll) > 1e-6 ? recoveredRoll : undefined);
  return {
    id: memberId,
    type,
    story: storyId,
    sectionId,
    materialId,
    start,
    end,
    ...(rotation !== undefined ? { rotation } : {}),
    ...metadataProperties(metadata, false),
  };
}

function restoreLinearReferenceSpan(
  type: 'column' | 'beam' | 'wall',
  span: { start: Point3D; end: Point3D },
  section: Section,
  metadata: ReturnType<typeof decodeIfcMemberMetadata>,
): { start: Point3D; end: Point3D } {
  if (!metadata?.axisOffset && !metadata?.faceAlign) return span;
  const offset =
    type === 'column'
      ? columnAxisOffsetToWorld(metadata.axisOffset)
      : linearAxisOffsetToWorld(
          effectiveLinearAxisOffset(
            metadata,
            type === 'beam'
              ? getBeamRectSize(section).width
              : section.kind === 'rc_wall'
                ? section.thickness
                : 0,
          ),
          span.start,
          span.end,
        );
  return {
    start: { x: span.start.x - offset.x, y: span.start.y - offset.y, z: span.start.z - offset.z },
    end: { x: span.end.x - offset.x, y: span.end.y - offset.y, z: span.end.z - offset.z },
  };
}

function metadataProperties(
  metadata: IfcMemberMetadata | undefined,
  includeRotation = true,
): {
  rotation?: number;
  axisOffset?: NonNullable<Member['axisOffset']>;
  faceAlign?: NonNullable<Member['faceAlign']>;
  localAxis?: NonNullable<Member['localAxis']>;
  releases?: NonNullable<Member['releases']>;
  rigidZones?: NonNullable<Member['rigidZones']>;
} {
  if (!metadata) return {};
  return {
    ...(includeRotation && metadata.rotation !== undefined ? { rotation: metadata.rotation } : {}),
    ...(metadata.axisOffset ? { axisOffset: metadata.axisOffset } : {}),
    ...(metadata.faceAlign ? { faceAlign: metadata.faceAlign } : {}),
    ...(metadata.localAxis ? { localAxis: metadata.localAxis } : {}),
    ...(metadata.releases ? { releases: metadata.releases } : {}),
    ...(metadata.rigidZones ? { rigidZones: metadata.rigidZones } : {}),
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
  const sourceId = section.id.trim();
  if (sourceId) {
    const existingById = sections.get(sourceId);
    if (existingById && sectionSignature(existingById) === sectionSignature(section)) {
      return sourceId;
    }

    // A SECTION:<id> profile name is an explicit identity signal. Preserve it
    // even when another section has identical dimensions: equal geometry does
    // not imply equal engineering/master-data identity.
    const nextId = reserveUniqueId(sourceId, new Set(sections.keys()), sourceId);
    sections.set(nextId, { ...section, id: nextId });
    return nextId;
  }

  const key = sectionSignature(section);
  const existing = [...sections.values()].find((item) => sectionSignature(item) === key);
  if (existing) return existing.id;

  const generatedId =
    section.kind === 'rc_column_rect'
      ? `SEC-C${section.width}x${section.depth}`
      : section.kind === 'rc_beam_rect'
        ? `SEC-B${section.width}x${section.depth}`
        : section.kind === 's_column_h'
          ? `SEC-HC${section.width}x${section.depth}x${section.tw ?? 'NA'}x${section.tf ?? 'NA'}`
          : section.kind === 's_beam_h'
            ? `SEC-HB${section.width}x${section.depth}x${section.tw ?? 'NA'}x${section.tf ?? 'NA'}`
            : section.kind === 's_pipe'
              ? `SEC-P${section.diameter}x${section.thickness}`
              : section.kind === 'rc_wall'
                ? `SEC-W${section.thickness}`
                : `SEC-S${section.thickness}`;

  const nextId = reserveUniqueId(section.id || generatedId, new Set(sections.keys()), generatedId);
  const next = { ...section, id: nextId };
  sections.set(nextId, next);
  return nextId;
}

function sectionSignature(section: Section): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(section).filter(([property]) => property !== 'id')),
  );
}

function resolveIfcMaterials(
  entities: Map<number, StepEntity>,
  warnings: string[],
): { materials: Material[]; memberMaterialIds: Map<number, string>; fallbackMaterialId: string } {
  const materialsByEntityId = new Map<number, Material>();
  const usedMaterialIds = new Set<string>();
  for (const entity of entities.values()) {
    if (entity.type !== 'IFCMATERIAL') continue;
    const requestedId = asString(entity.args[0]) ?? `MAT-IFC-${entity.id}`;
    const id = reserveUniqueId(requestedId, usedMaterialIds, `MAT-IFC-${entity.id}`);
    const serialized = asString(entity.args[1]);
    let material: Material | null = null;
    if (serialized) {
      try {
        const parsed = JSON.parse(serialized) as Partial<Material>;
        const migrated = migrateLegacyMaterials({ materials: [parsed] }).materials[0] as Partial<Material>;
        if (
          typeof migrated.id === 'string' &&
          typeof migrated.name === 'string' &&
          ['concrete', 'steel', 'wood', 'other'].includes(migrated.type ?? '')
        ) {
          material = { ...(migrated as Material), id };
        }
      } catch {
        // Third-party descriptions are commonly plain text; fall through.
      }
    }
    if (!material) {
      const category = asString(entity.args[2]);
      const type: Material['type'] = ['concrete', 'steel', 'wood', 'other'].includes(category ?? '')
        ? (category as Material['type'])
        : 'other';
      material = { id, name: serialized || id, type };
    }
    // Keep a final explicit guard for discriminated material parsing. Besides
    // satisfying strict narrowing when the parser returns Material | null, it
    // prevents a future unsupported material branch from leaking into maps.
    if (material === null) {
      warnings.push(`IFC材料 #${entity.id} を解釈できないためスキップしました`);
      continue;
    }
    materialsByEntityId.set(entity.id, material);
  }

  const memberMaterialIds = new Map<number, string>();
  for (const relation of entities.values()) {
    if (relation.type !== 'IFCRELASSOCIATESMATERIAL') continue;
    const materialRef = asRef(relation.args[5]);
    const material = materialRef ? materialsByEntityId.get(materialRef) : undefined;
    if (!material) {
      warnings.push(`IFC材料関連 #${relation.id} の材料を解決できませんでした`);
      continue;
    }
    for (const objectRef of asRefList(relation.args[4])) {
      memberMaterialIds.set(objectRef, material.id);
    }
  }

  return {
    materials: [...materialsByEntityId.values()],
    memberMaterialIds,
    fallbackMaterialId: reserveUniqueId(MATERIAL_ID, usedMaterialIds, MATERIAL_ID),
  };
}

function resolveIfcOpenings(
  entities: Map<number, StepEntity>,
  unitScale: number,
  memberByEntityId: Map<number, Member>,
  sections: Map<string, Section>,
  usedSelectableIds: Set<string>,
  warnings: string[],
): Opening[] {
  const openings: Opening[] = [];
  for (const relation of entities.values()) {
    if (relation.type !== 'IFCRELVOIDSELEMENT') continue;
    const hostRef = asRef(relation.args[4]);
    const openingRef = asRef(relation.args[5]);
    const host = hostRef ? memberByEntityId.get(hostRef) : undefined;
    const memberId = host?.id;
    const openingEntity = openingRef ? entities.get(openingRef) : undefined;
    if (!memberId || !openingEntity || openingEntity.type !== 'IFCOPENINGELEMENT') {
      warnings.push(`IFC開口関連 #${relation.id} の参照先を解決できませんでした`);
      continue;
    }
    const rawResolved = resolveIfcElement(openingEntity, entities);
    if (!rawResolved) {
      warnings.push(`IFC開口 #${openingEntity.id} の形状を解決できませんでした`);
      continue;
    }
    const resolved = unitScale === 1 ? rawResolved : scaleResolvedSolid(rawResolved, unitScale);
    if (resolved.profile.kind !== 'rectangle') {
      warnings.push(`IFC開口 #${openingEntity.id} は矩形以外のためスキップしました`);
      continue;
    }
    const encodedName = resolveElementName(openingEntity);
    const nameMatch = encodedName.match(/^(door|window|void):(.*)$/);
    const metadata = decodeIfcOpeningMetadata(asString(openingEntity.args[3]));
    const hostType = hostRef ? entities.get(hostRef)?.type : undefined;
    const physicalPosition = openingPositionFromGeometry(resolved, hostType === 'IFCWALL');
    const derivedPosition = host
      ? openingReferencePosition(physicalPosition, host, sections.get(host.sectionId))
      : physicalPosition;
    openings.push({
      id: reserveUniqueId(
        metadata?.id || nameMatch?.[2] || encodedName,
        usedSelectableIds,
        `OPENING-${openingEntity.id}`,
      ),
      memberId,
      type: metadata?.type ?? (nameMatch?.[1] as Opening['type'] | undefined) ?? 'void',
      position: quantizePoint3D(metadata?.position ?? derivedPosition),
      width: metadata?.width ?? resolved.profile.xDim,
      height: metadata?.height ?? resolved.profile.yDim,
    });
  }
  return openings;
}

function openingReferencePosition(
  physicalPosition: Point3D,
  host: Member,
  section: Section | undefined,
): Point3D {
  const offset =
    host.type === 'wall'
      ? linearAxisOffsetToWorld(
          effectiveLinearAxisOffset(host, getWallThickness(host, section)),
          host.start,
          host.end,
        )
      : host.type === 'slab'
        ? slabAxisOffsetToWorld(host.axisOffset)
        : { x: 0, y: 0, z: 0 };
  return {
    x: physicalPosition.x - offset.x,
    y: physicalPosition.y - offset.y,
    // Slab openings are located in plan; their model Z follows the host level,
    // whereas a wall opening uses the lower-edge elevation from the void.
    z: host.type === 'slab' ? host.level : physicalPosition.z - offset.z,
  };
}

function openingPositionFromGeometry(resolved: ResolvedSolid, lowerEdge: boolean): Point3D {
  if (resolved.profile.kind !== 'rectangle') return resolved.transform.origin;
  const placement = resolved.profile.placement;
  const centerX = placement?.origin.x ?? 0;
  const centerY = placement?.origin.y ?? 0;
  // An IfcOpeningElement is commonly extruded beyond both faces of its host.
  // Its placement origin therefore lies on the beginning face, not on the
  // wall/slab reference plane. Move to the extrusion mid-plane before reading
  // the profile centre so metadata-free imports do not retain half the host
  // thickness plus the penetration allowance as a lateral shift.
  const extrusionCenter = add3(
    resolved.transform.origin,
    scale3(resolved.transform.zAxis, resolved.depth / 2),
  );
  const center = add3(
    extrusionCenter,
    add3(scale3(resolved.transform.xAxis, centerX), scale3(resolved.transform.yAxis, centerY)),
  );
  return lowerEdge
    ? add3(center, scale3(resolved.transform.yAxis, -resolved.profile.yDim / 2))
    : center;
}

function reserveUniqueId(preferred: string, used: Set<string>, fallback: string): string {
  const base = preferred.trim() || fallback;
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix++;
  const id = `${base}-${suffix}`;
  used.add(id);
  return id;
}
