import { deepClone } from '@/libs/clone';
import {
  hasDuplicateVertices,
  isDegenerate,
  isSimplePolygon,
} from '@/domain/geometry/measurement';
import { distance2D } from '@/domain/geometry/point';
import type { Point3D } from '@/domain/geometry/types';
import { GEOM_EPSILON, quantize, quantizePoint2D, quantizePoint3D } from '@/domain/geometry/precision';
import type {
  Dimension,
  Material,
  Member,
  Opening,
  ProjectData,
  Section,
} from '@/domain/structural/types';

function finite(values: number[]): boolean {
  return values.every(Number.isFinite);
}

export function normalizeMember(member: Member): Member {
  const next = deepClone(member);
  if (next.type === 'slab') {
    next.polygon = next.polygon.map(quantizePoint2D);
    next.level = quantize(next.level);
  } else {
    next.start = quantizePoint3D(next.start);
    next.end = quantizePoint3D(next.end);
    if (next.type === 'wall') {
      next.height = quantize(next.height);
      next.thickness = quantize(next.thickness);
    }
  }
  // Rotation is expressed in degrees and must not inherit the coordinate grid.
  if (next.rotation != null) next.rotation = quantize(next.rotation, 1e-6);
  if (next.axisOffset) {
    next.axisOffset = {
      dx: quantize(next.axisOffset.dx),
      dy: quantize(next.axisOffset.dy),
    };
  }
  return next;
}

export function isValidMemberGeometry(member: Member): boolean {
  if (member.type === 'slab') {
    return (
      !member.releases &&
      !member.rigidZones &&
      !member.localAxis &&
      member.polygon.length >= 3 &&
      member.polygon.every((point) => finite([point.x, point.y])) &&
      !hasDuplicateVertices(member.polygon) &&
      isSimplePolygon(member.polygon) &&
      !isDegenerate(member.polygon) &&
      Number.isFinite(member.level)
    );
  }

  if (!finite([
    member.start.x,
    member.start.y,
    member.start.z,
    member.end.x,
    member.end.y,
    member.end.z,
  ])) {
    return false;
  }
  const dx = member.end.x - member.start.x;
  const dy = member.end.y - member.start.y;
  const dz = member.end.z - member.start.z;
  if (Math.hypot(dx, dy, dz) <= GEOM_EPSILON) return false;
  const length = Math.hypot(dx, dy, dz);
  if (member.rigidZones) {
    const start = member.rigidZones.start ?? 0;
    const end = member.rigidZones.end ?? 0;
    if (!finite([start, end]) || start < 0 || end < 0 || start + end >= length) return false;
  }
  if (member.localAxis) {
    if (!Number.isFinite(member.localAxis.rotation)) return false;
    const reference = member.localAxis.referenceVector;
    if (reference) {
      if (!finite([reference.x, reference.y, reference.z])) return false;
      const referenceLength = Math.hypot(reference.x, reference.y, reference.z);
      const crossLength = Math.hypot(
        dy * reference.z - dz * reference.y,
        dz * reference.x - dx * reference.z,
        dx * reference.y - dy * reference.x,
      );
      if (
        referenceLength <= Number.EPSILON ||
        crossLength / (length * referenceLength) <= 1e-9
      ) return false;
    }
  }
  if (member.type === 'wall') {
    return Math.hypot(dx, dy) > GEOM_EPSILON && member.height > 0 && member.thickness > 0;
  }
  return true;
}

function optionalFinite(values: Array<number | undefined>): boolean {
  return values.every((value) => value === undefined || Number.isFinite(value));
}

export function isValidMaterial(material: Material): boolean {
  if (!material.id.trim() || !material.name.trim()) return false;
  if (!optionalFinite([
    material.elasticModulus,
    material.shearModulus,
    material.poissonRatio,
    material.unitWeight,
    material.Fc,
    material.F,
    material.Fy,
    material.referenceStrength,
    material.moistureContent,
    material.allowableBendingStress,
    material.allowableCompressionStress,
    material.allowableShearStress,
  ])) return false;
  if (
    [
      material.elasticModulus,
      material.shearModulus,
      material.Fc,
      material.F,
      material.Fy,
      material.referenceStrength,
      material.allowableBendingStress,
      material.allowableCompressionStress,
      material.allowableShearStress,
    ].some((value) => value !== undefined && value <= 0)
  ) return false;
  if (material.unitWeight !== undefined && material.unitWeight < 0) return false;
  if (
    material.poissonRatio !== undefined &&
    (material.poissonRatio < 0 || material.poissonRatio >= 0.5)
  ) return false;

  const owns = (property: keyof Material) =>
    Object.prototype.hasOwnProperty.call(material, property);
  switch (material.type) {
    case 'concrete':
      return ![
        'F',
        'Fy',
        'referenceStrength',
        'moistureContent',
        'allowableBendingStress',
        'allowableCompressionStress',
        'allowableShearStress',
      ].some((property) => owns(property as keyof Material));
    case 'steel':
      return ![
        'Fc',
        'referenceStrength',
        'moistureContent',
        'allowableBendingStress',
        'allowableCompressionStress',
        'allowableShearStress',
      ].some((property) => owns(property as keyof Material));
    case 'wood':
      return (
        !['Fc', 'F', 'Fy'].some((property) => owns(property as keyof Material)) &&
        (material.moistureContent === undefined ||
          (material.moistureContent >= 0 && material.moistureContent <= 100))
      );
    case 'other':
      return ![
        'Fc',
        'F',
        'Fy',
        'referenceStrength',
        'moistureContent',
        'allowableBendingStress',
        'allowableCompressionStress',
        'allowableShearStress',
      ].some((property) => owns(property as keyof Material));
  }
}

export function isValidSection(section: Section): boolean {
  if (!section.id.trim()) return false;
  switch (section.kind) {
    case 'rc_column_rect':
    case 'rc_beam_rect': {
      if (!finite([section.width, section.depth]) || section.width <= 0 || section.depth <= 0)
        return false;
      if (section.cover !== undefined && (!Number.isFinite(section.cover) || section.cover < 0))
        return false;
      const rebar = section.rebar;
      return !rebar || (
        optionalFinite([rebar.mainDiameter, rebar.mainCount, rebar.hoopDiameter, rebar.hoopSpacing]) &&
        [rebar.mainDiameter, rebar.mainCount, rebar.hoopDiameter, rebar.hoopSpacing]
          .every((value) => value === undefined || value >= 0)
      );
    }
    case 'rc_slab':
      return Number.isFinite(section.thickness) && section.thickness > 0 &&
        (section.cover === undefined || (Number.isFinite(section.cover) && section.cover >= 0));
    case 'rc_wall':
      return Number.isFinite(section.thickness) && section.thickness > 0 &&
        (section.cover === undefined || (Number.isFinite(section.cover) && section.cover >= 0));
    case 's_column_h':
    case 's_beam_h': {
      const tw = section.tw;
      const tf = section.tf;
      return finite([section.width, section.depth]) && section.width > 0 && section.depth > 0 &&
        (tw === undefined || (Number.isFinite(tw) && tw > 0 && tw < section.width)) &&
        (tf === undefined || (Number.isFinite(tf) && tf > 0 && tf * 2 < section.depth));
    }
    case 's_pipe':
      return finite([section.diameter, section.thickness]) && section.diameter > 0 &&
        section.thickness > 0 && section.thickness * 2 < section.diameter;
  }
}

export function normalizeProjectMemberGeometry(data: ProjectData): boolean {
  const members = data.members.map(normalizeMember);
  if (!members.every(isValidMemberGeometry)) return false;
  data.members = members;
  return true;
}

export function shiftMemberToStory(member: Member, elevationDelta: number): Member {
  const next = deepClone(member);
  if (next.type === 'slab') {
    next.level = quantize(next.level + elevationDelta);
  } else {
    next.start.z = quantize(next.start.z + elevationDelta);
    next.end.z = quantize(next.end.z + elevationDelta);
  }
  return next;
}

export function mergeMemberUpdate(member: Member, updates: Partial<Member>): Member | null {
  if (updates.type != null && updates.type !== member.type) return null;
  const candidate = normalizeMember({ ...member, ...deepClone(updates) } as Member);
  return isValidMemberGeometry(candidate) ? candidate : null;
}

export function normalizeDimension(dimension: Dimension): Dimension | null {
  const next = deepClone(dimension);
  next.start = quantizePoint2D(next.start);
  next.end = quantizePoint2D(next.end);
  next.offset = quantize(next.offset);
  if (
    !finite([next.start.x, next.start.y, next.end.x, next.end.y, next.offset]) ||
    distance2D(next.start, next.end) <= GEOM_EPSILON
  ) {
    return null;
  }
  return next;
}

export function normalizeOpening(opening: Opening): Opening | null {
  const next = deepClone(opening);
  next.position = quantizePoint3D(next.position);
  next.width = quantize(next.width);
  next.height = quantize(next.height);
  return finite([
    next.position.x,
    next.position.y,
    next.position.z,
    next.width,
    next.height,
  ]) && next.width > 0 && next.height > 0
    ? next
    : null;
}

export function constrainOpeningToHost(opening: Opening, member: Member): Opening {
  if (member.type !== 'wall') return opening;
  const dx = member.end.x - member.start.x;
  const dy = member.end.y - member.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= GEOM_EPSILON) return opening;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((opening.position.x - member.start.x) * dx +
        (opening.position.y - member.start.y) * dy) /
        lengthSquared,
    ),
  );
  return {
    ...opening,
    position: {
      ...opening.position,
      x: quantize(member.start.x + dx * t),
      y: quantize(member.start.y + dy * t),
    },
  };
}

export function constrainProjectOpenings(data: ProjectData): ProjectData {
  if (data.openings.length === 0) return data;
  const memberById = new Map(data.members.map((member) => [member.id, member]));
  data.openings = data.openings.map((opening) => {
    const host = memberById.get(opening.memberId);
    return host ? constrainOpeningToHost(opening, host) : opening;
  });
  return data;
}

function removeMemberReferences(data: ProjectData, deletedMemberIds: Set<string>) {
  data.openings = data.openings.filter((opening) => !deletedMemberIds.has(opening.memberId));
  data.dimensions = data.dimensions.map((dimension) => {
    if (!dimension.refMemberIds?.some((id) => deletedMemberIds.has(id))) return dimension;
    const refMemberIds = dimension.refMemberIds.filter((id) => !deletedMemberIds.has(id));
    return refMemberIds.length > 0
      ? { ...dimension, refMemberIds }
      : { ...dimension, associative: false, refMemberIds: undefined };
  });
  if (data.groups) {
    data.groups = data.groups
      .map((group) => ({
        ...group,
        memberIds: group.memberIds.filter((id) => !deletedMemberIds.has(id)),
      }))
      .filter((group) => group.memberIds.length > 0);
  }
  if (data.memberLoads) {
    data.memberLoads = data.memberLoads.filter((load) => !deletedMemberIds.has(load.memberId));
  }
  if (data.areaLoads) {
    data.areaLoads = data.areaLoads.filter((load) => !deletedMemberIds.has(load.memberId));
  }
  if (data.diaphragms) {
    data.diaphragms = data.diaphragms.map((diaphragm) => ({
      ...diaphragm,
      memberIds: diaphragm.memberIds?.filter((id) => !deletedMemberIds.has(id)),
    }));
  }
  if (data.analysisResults?.memberResults) {
    data.analysisResults.memberResults = data.analysisResults.memberResults.filter(
      (result) => !deletedMemberIds.has(result.memberId),
    );
  }
}

export function deleteEntitiesInProject(data: ProjectData, ids: Iterable<string>): boolean {
  const deletedIds = new Set(ids);
  if (deletedIds.size === 0) return false;
  const deletedMemberIds = new Set(
    data.members.filter((member) => deletedIds.has(member.id)).map((member) => member.id),
  );
  const before =
    data.members.length +
    data.openings.length +
    data.annotations.length +
    data.dimensions.length +
    (data.constructionLines?.length ?? 0);

  data.members = data.members.filter((member) => !deletedIds.has(member.id));
  data.openings = data.openings.filter((opening) => !deletedIds.has(opening.id));
  data.annotations = data.annotations.filter((annotation) => !deletedIds.has(annotation.id));
  data.dimensions = data.dimensions.filter((dimension) => !deletedIds.has(dimension.id));
  if (data.constructionLines) {
    data.constructionLines = data.constructionLines.filter((line) => !deletedIds.has(line.id));
  }
  removeMemberReferences(data, deletedMemberIds);

  const after =
    data.members.length +
    data.openings.length +
    data.annotations.length +
    data.dimensions.length +
    (data.constructionLines?.length ?? 0);
  return before !== after;
}

export function renameGridReferences(data: ProjectData, previousName: string, nextName: string) {
  if (previousName === nextName) return;
  for (const member of data.members) {
    if (!member.gridRef) continue;
    for (const key of ['startGrid', 'endGrid'] as const) {
      const pair = member.gridRef[key];
      if (!pair) continue;
      member.gridRef[key] = pair.map((name) =>
        name === previousName ? nextName : name,
      ) as [string, string];
    }
  }
}

export function detachGridReferences(data: ProjectData, deletedTokens: Iterable<string>) {
  const deleted = new Set(deletedTokens);
  for (const member of data.members) {
    if (!member.gridRef) continue;
    if (member.gridRef.startGrid?.some((token) => deleted.has(token))) {
      member.gridRef.startGrid = undefined;
    }
    if (member.gridRef.endGrid?.some((token) => deleted.has(token))) {
      member.gridRef.endGrid = undefined;
    }
    if (!member.gridRef.startGrid && !member.gridRef.endGrid) member.gridRef = undefined;
  }
}

export function shiftStoryElevation(data: ProjectData, storyId: string, delta: number) {
  if (!Number.isFinite(delta) || Math.abs(delta) <= GEOM_EPSILON) return;
  const originalStoryNodes: Array<{ x: number; y: number; z: number }> = [];
  const shiftedMemberIds = new Set<string>();
  for (const member of data.members) {
    if (member.story !== storyId) continue;
    shiftedMemberIds.add(member.id);
    if (member.type === 'slab') {
      originalStoryNodes.push(
        ...member.polygon.map((point) => ({ x: point.x, y: point.y, z: member.level })),
      );
      member.level = quantize(member.level + delta);
    } else {
      originalStoryNodes.push({ ...member.start }, { ...member.end });
      member.start.z = quantize(member.start.z + delta);
      member.end.z = quantize(member.end.z + delta);
    }
  }
  for (const opening of data.openings) {
    if (shiftedMemberIds.has(opening.memberId)) {
      opening.position.z = quantize(opening.position.z + delta);
    }
  }
  for (const support of data.supports ?? []) {
    if (support.storyId === storyId) support.position.z = quantize(support.position.z + delta);
  }
  for (const load of data.nodalLoads ?? []) {
    if (load.storyId === storyId) load.position.z = quantize(load.position.z + delta);
  }
  for (const mass of data.masses ?? []) {
    if (mass.storyId === storyId) mass.position.z = quantize(mass.position.z + delta);
  }
  for (const diaphragm of data.diaphragms ?? []) {
    if (diaphragm.storyId === storyId && diaphragm.masterPosition) {
      diaphragm.masterPosition.z = quantize(diaphragm.masterPosition.z + delta);
    }
  }
  for (const result of data.analysisResults?.nodeDisplacements ?? []) {
    const belongsToStory = originalStoryNodes.some(
      (node) =>
        Math.hypot(
          node.x - result.position.x,
          node.y - result.position.y,
          node.z - result.position.z,
        ) <= 1,
    );
    if (belongsToStory) result.position.z = quantize(result.position.z + delta);
  }
}

export function moveConnectedJointInProject(
  data: ProjectData,
  origin: { x: number; y: number },
  target: { x: number; y: number },
  storyId: string | null,
  tolerance: number,
): boolean {
  const point = quantizePoint2D(target);
  let changed = false;
  for (const member of data.members) {
    if (storyId && member.story !== storyId) continue;
    if (member.type === 'slab') continue;
    const startMatches = distance2D(member.start, origin) <= tolerance;
    const endMatches = distance2D(member.end, origin) <= tolerance;
    if (startMatches) {
      member.start.x = point.x;
      member.start.y = point.y;
      changed = true;
    }
    if (endMatches) {
      member.end.x = point.x;
      member.end.y = point.y;
      changed = true;
    }
  }
  const moveAnalysisPoint = (itemStoryId: string, position: Point3D) => {
    if (storyId && itemStoryId !== storyId) return;
    if (distance2D(position, origin) > tolerance) return;
    position.x = point.x;
    position.y = point.y;
    changed = true;
  };
  for (const support of data.supports ?? []) {
    moveAnalysisPoint(support.storyId, support.position);
  }
  for (const load of data.nodalLoads ?? []) {
    moveAnalysisPoint(load.storyId, load.position);
  }
  for (const mass of data.masses ?? []) {
    moveAnalysisPoint(mass.storyId, mass.position);
  }
  for (const diaphragm of data.diaphragms ?? []) {
    if (diaphragm.masterPosition) moveAnalysisPoint(diaphragm.storyId, diaphragm.masterPosition);
  }
  return changed;
}
