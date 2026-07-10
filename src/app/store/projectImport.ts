import { collectAllIds } from '@/domain/idGenerator';
import { quantize, quantizePoint2D } from '@/domain/geometry/precision';
import type {
  Annotation,
  ConstructionLine,
  Grid,
  MemberType,
  ProjectData,
  Section,
} from '@/domain/structural/types';
import { deepClone } from '@/libs/clone';
import type {
  ProjectImportBatch,
  ProjectImportCategory,
  ProjectImportSummary,
} from './projectStoreTypes';
import {
  constrainOpeningToHost,
  isValidMaterial,
  isValidMemberGeometry,
  isValidSection,
  normalizeDimension,
  normalizeMember,
  normalizeOpening,
} from './projectStoreCommands';

const CATEGORIES: ProjectImportCategory[] = [
  'materials',
  'sections',
  'grids',
  'members',
  'openings',
  'annotations',
  'dimensions',
  'constructionLines',
];

const SECTION_KINDS: Record<MemberType, ReadonlyArray<Section['kind']>> = {
  column: ['rc_column_rect', 's_column_h', 's_pipe'],
  beam: ['rc_beam_rect', 's_beam_h', 's_pipe'],
  wall: ['rc_wall'],
  slab: ['rc_slab'],
};

export function createEmptyImportSummary(): ProjectImportSummary {
  return {
    added: Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<
      ProjectImportCategory,
      number
    >,
    skipped: Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<
      ProjectImportCategory,
      number
    >,
    remappedIds: {},
    warnings: [],
  };
}

function reserveUnique(preferred: string, used: Set<string>): string {
  if (!used.has(preferred)) {
    used.add(preferred);
    return preferred;
  }
  let suffix = 2;
  let candidate = `${preferred}-${suffix}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${preferred}-${suffix}`;
  }
  used.add(candidate);
  return candidate;
}

function planIds<T extends { id: string }>(
  items: T[],
  category: ProjectImportCategory,
  used: Set<string>,
  summary: ProjectImportSummary,
): { items: T[]; firstIdByOriginal: Map<string, string> } {
  const firstIdByOriginal = new Map<string, string>();
  const planned = items.map((item, index) => {
    const id = reserveUnique(item.id, used);
    if (!firstIdByOriginal.has(item.id)) firstIdByOriginal.set(item.id, id);
    if (id !== item.id) {
      summary.remappedIds[`${category}:${item.id}:${index}`] = id;
    }
    return { ...item, id };
  });
  return { items: planned, firstIdByOriginal };
}

function hasOnlyFiniteNumbers(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(hasOnlyFiniteNumbers);
  if (value && typeof value === 'object') {
    return Object.values(value).every(hasOnlyFiniteNumbers);
  }
  return true;
}

function validGrid(grid: Grid): boolean {
  return grid.id.trim().length > 0 && grid.name.trim().length > 0 && Number.isFinite(grid.position);
}

function normalizeAnnotation(annotation: Annotation): Annotation | null {
  if (!hasOnlyFiniteNumbers(annotation)) return null;
  const next = deepClone(annotation);
  next.x = quantize(next.x);
  next.y = quantize(next.y);
  if (next.points) next.points = next.points.map(quantizePoint2D);
  if (
    next.id.trim().length === 0 ||
    !Number.isFinite(next.x) ||
    !Number.isFinite(next.y) ||
    !hasOnlyFiniteNumbers(next)
  ) return null;
  return next;
}

function normalizeConstructionLine(line: ConstructionLine): ConstructionLine | null {
  if (!hasOnlyFiniteNumbers(line)) return null;
  const next = deepClone(line);
  next.origin = quantizePoint2D(next.origin);
  const length = Math.hypot(next.direction.x, next.direction.y);
  if (
    next.id.trim().length === 0 ||
    !Number.isFinite(length) ||
    length <= 1e-9 ||
    !hasOnlyFiniteNumbers(next)
  ) return null;
  next.direction = {
    x: next.direction.x / length,
    y: next.direction.y / length,
  };
  return next;
}

function keepValid<T>(
  items: T[],
  category: ProjectImportCategory,
  summary: ProjectImportSummary,
  predicate: (item: T) => boolean,
): T[] {
  return items.filter((item) => {
    if (predicate(item)) return true;
    summary.skipped[category] += 1;
    summary.warnings.push(`${category}: invalid item skipped`);
    return false;
  });
}

/** Mutates `data` with one completely remapped and validated import batch. */
export function applyProjectImport(
  data: ProjectData,
  batch: ProjectImportBatch,
): ProjectImportSummary {
  const summary = createEmptyImportSummary();
  const storyIds = new Set(data.stories.map((story) => story.id));
  const providedMaterialIds = new Set((batch.materials ?? []).map((item) => item.id));
  const providedSectionIds = new Set((batch.sections ?? []).map((item) => item.id));

  const validMaterials = keepValid(
    batch.materials ?? [],
    'materials',
    summary,
    (material) => hasOnlyFiniteNumbers(material) && isValidMaterial(material),
  ).map(deepClone);
  const materialPlan = planIds(
    validMaterials,
    'materials',
    new Set(data.materials.map((item) => item.id)),
    summary,
  );
  data.materials.push(...materialPlan.items);
  summary.added.materials += materialPlan.items.length;

  const validSections = keepValid(
    batch.sections ?? [],
    'sections',
    summary,
    (section) => hasOnlyFiniteNumbers(section) && isValidSection(section),
  ).map(deepClone);
  const sectionPlan = planIds(
    validSections,
    'sections',
    new Set(data.sections.map((item) => item.id)),
    summary,
  );
  data.sections.push(...sectionPlan.items);
  summary.added.sections += sectionPlan.items.length;

  const validGrids = keepValid(
    batch.grids ?? [],
    'grids',
    summary,
    validGrid,
  ).map((grid) => ({ ...deepClone(grid), position: quantize(grid.position) }));
  // Grid references share one token namespace: exact IDs take precedence over
  // names. Reserve both together so an imported ID cannot silently steal an
  // existing name reference (or vice versa).
  const usedGridTokens = new Set(data.grids.flatMap((item) => [item.id, item.name]));
  const gridPlan = planIds(validGrids, 'grids', usedGridTokens, summary);
  const gridNameMap = new Map<string, string>();
  gridPlan.items = gridPlan.items.map((grid, index) => {
    const source = validGrids[index];
    const name = source.id === source.name
      ? grid.id
      : reserveUnique(grid.name, usedGridTokens);
    if (!gridNameMap.has(grid.name)) gridNameMap.set(grid.name, name);
    if (name !== grid.name) summary.remappedIds[`gridNames:${grid.name}:${index}`] = name;
    return { ...grid, name };
  });
  data.grids.push(...gridPlan.items);
  summary.added.grids += gridPlan.items.length;

  const finiteMembers = keepValid(
    batch.members ?? [],
    'members',
    summary,
    (member) => member.id.trim().length > 0 && hasOnlyFiniteNumbers(member),
  );
  const normalizedMembers = keepValid(
    finiteMembers.map(normalizeMember),
    'members',
    summary,
    isValidMemberGeometry,
  );
  const selectableIds = collectAllIds(data);
  const memberPlan = planIds(normalizedMembers, 'members', selectableIds, summary);
  const materialIds = new Set(data.materials.map((item) => item.id));
  const sectionById = new Map(data.sections.map((item) => [item.id, item]));
  const gridTokens = new Set(data.grids.flatMap((grid) => [grid.id, grid.name]));
  for (const member of memberPlan.items) {
    const sourceSectionId = member.sectionId;
    const sourceMaterialId = member.materialId;
    member.sectionId = sectionPlan.firstIdByOriginal.get(member.sectionId) ?? member.sectionId;
    member.materialId = materialPlan.firstIdByOriginal.get(member.materialId) ?? member.materialId;
    if (member.gridRef) {
      for (const key of ['startGrid', 'endGrid'] as const) {
        const pair = member.gridRef[key];
        if (!pair) continue;
        member.gridRef[key] = pair.map(
          (token) =>
            gridPlan.firstIdByOriginal.get(token) ??
            gridNameMap.get(token) ??
            token,
        ) as [string, string];
      }
    }
    const section = sectionById.get(member.sectionId);
    const validReferences =
      storyIds.has(member.story) &&
      (!providedMaterialIds.has(sourceMaterialId) ||
        materialPlan.firstIdByOriginal.has(sourceMaterialId)) &&
      (!providedSectionIds.has(sourceSectionId) ||
        sectionPlan.firstIdByOriginal.has(sourceSectionId)) &&
      materialIds.has(member.materialId) &&
      section != null &&
      SECTION_KINDS[member.type].includes(section.kind) &&
      [member.gridRef?.startGrid, member.gridRef?.endGrid]
        .filter((pair): pair is [string, string] => pair != null)
        .every((pair) => pair.every((token) => gridTokens.has(token)));
    if (!validReferences) {
      summary.skipped.members += 1;
      summary.warnings.push(`members: "${member.id}" has invalid references`);
      continue;
    }
    data.members.push(member);
    summary.added.members += 1;
  }

  const intrinsicOpenings = (batch.openings ?? []).flatMap((opening) => {
      if (!hasOnlyFiniteNumbers(opening)) return [];
      const next = normalizeOpening(opening);
      return next ? [next] : [];
    });
  summary.skipped.openings += (batch.openings?.length ?? 0) - intrinsicOpenings.length;
  const normalizedOpenings = keepValid(
    intrinsicOpenings,
    'openings',
    summary,
    (opening) => opening.id.trim().length > 0,
  );
  const openingPlan = planIds(normalizedOpenings, 'openings', selectableIds, summary);
  const memberById = new Map(data.members.map((member) => [member.id, member]));
  for (const opening of openingPlan.items) {
    opening.memberId = memberPlan.firstIdByOriginal.get(opening.memberId) ?? opening.memberId;
    const host = memberById.get(opening.memberId);
    if (!host || (host.type !== 'wall' && host.type !== 'slab')) {
      summary.skipped.openings += 1;
      summary.warnings.push(`openings: "${opening.id}" has no valid host`);
      continue;
    }
    data.openings.push(constrainOpeningToHost(opening, host));
    summary.added.openings += 1;
  }

  const annotations = (batch.annotations ?? []).flatMap((annotation) => {
    const next = normalizeAnnotation(annotation);
    if (!next || !storyIds.has(next.story)) {
      summary.skipped.annotations += 1;
      return [];
    }
    return [next];
  });
  const annotationPlan = planIds(annotations, 'annotations', selectableIds, summary);
  data.annotations.push(...annotationPlan.items);
  summary.added.annotations += annotationPlan.items.length;

  const lines = (batch.constructionLines ?? []).flatMap((line) => {
    const next = normalizeConstructionLine(line);
    if (!next || !storyIds.has(next.story)) {
      summary.skipped.constructionLines += 1;
      return [];
    }
    return [next];
  });
  const linePlan = planIds(lines, 'constructionLines', selectableIds, summary);
  if (linePlan.items.length > 0) {
    if (!data.constructionLines) data.constructionLines = [];
    data.constructionLines.push(...linePlan.items);
  }
  summary.added.constructionLines += linePlan.items.length;

  const dimensions = (batch.dimensions ?? []).flatMap((dimension) => {
    if (!hasOnlyFiniteNumbers(dimension)) {
      summary.skipped.dimensions += 1;
      return [];
    }
    const next = normalizeDimension(dimension);
    if (!next || !storyIds.has(next.story)) {
      summary.skipped.dimensions += 1;
      return [];
    }
    return [next];
  });
  const dimensionPlan = planIds(dimensions, 'dimensions', selectableIds, summary);
  const finalMemberIds = new Set(data.members.map((member) => member.id));
  for (const dimension of dimensionPlan.items) {
    if (dimension.refMemberIds) {
      dimension.refMemberIds = dimension.refMemberIds.map(
        (id) => memberPlan.firstIdByOriginal.get(id) ?? id,
      );
    }
    if (
      dimension.refMemberIds?.some((id) => !finalMemberIds.has(id)) ||
      (dimension.associative && !dimension.refMemberIds?.length)
    ) {
      summary.skipped.dimensions += 1;
      summary.warnings.push(`dimensions: "${dimension.id}" has invalid member references`);
      continue;
    }
    data.dimensions.push(dimension);
    summary.added.dimensions += 1;
  }

  return summary;
}
