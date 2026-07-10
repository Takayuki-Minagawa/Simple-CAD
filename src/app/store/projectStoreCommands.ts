import { deepClone } from '@/libs/clone';
import {
  hasDuplicateVertices,
  isDegenerate,
  isSimplePolygon,
} from '@/domain/geometry/measurement';
import { distance2D } from '@/domain/geometry/point';
import type { Point3D } from '@/domain/geometry/types';
import {
  GEOM_EPSILON,
  JOINT_MERGE_TOLERANCE,
  SpatialPointIndex3D,
  quantize,
  quantizePoint2D,
  quantizePoint3D,
} from '@/domain/geometry/precision';
import type {
  Dimension,
  Material,
  Member,
  Opening,
  ProjectData,
  Section,
} from '@/domain/structural/types';
import { resolveGridToken } from '@/domain/structural/gridResolve';

function finite(values: number[]): boolean {
  return values.every(Number.isFinite);
}

/**
 * Clone an update patch without JSON serialization dropping explicit
 * `undefined` values. Those values mean "clear this optional field" at the
 * store boundary.
 */
export function cloneUpdatePatch<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneUpdatePatch) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneUpdatePatch(nested)]),
    ) as T;
  }
  return value;
}

/** Semantic equality for JSON project values; a missing optional key and an
 * explicit `undefined` key represent the same persisted value. */
export function projectValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => projectValuesEqual(value, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).filter((key) => leftRecord[key] !== undefined).sort();
  const rightKeys = Object.keys(rightRecord).filter((key) => rightRecord[key] !== undefined).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && projectValuesEqual(leftRecord[key], rightRecord[key]),
    );
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

export function normalizeProjectMemberGeometry(
  data: ProjectData,
  memberIds?: Iterable<string>,
): boolean {
  const selected = memberIds ? new Set(memberIds) : null;
  const members = data.members.map((member) =>
    selected === null || selected.has(member.id) ? normalizeMember(member) : member,
  );
  if (
    !members.every(
      (member) => selected !== null && !selected.has(member.id) || isValidMemberGeometry(member),
    )
  ) return false;
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
  const candidate = normalizeMember({ ...member, ...cloneUpdatePatch(updates) } as Member);
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

function memberAnalysisNodes(member: Member): Array<{ storyId: string; position: Point3D }> {
  if (member.type === 'slab') {
    return member.polygon.map((point) => ({
      storyId: member.story,
      position: { ...point, z: member.level },
    }));
  }
  return [
    { storyId: member.story, position: member.start },
    { storyId: member.story, position: member.end },
  ];
}

function sameAnalysisNode(
  left: { storyId: string; position: Point3D },
  right: { storyId: string; position: Point3D },
): boolean {
  return left.storyId === right.storyId &&
    Math.hypot(
      left.position.x - right.position.x,
      left.position.y - right.position.y,
      left.position.z - right.position.z,
  ) <= JOINT_MERGE_TOLERANCE;
}

interface AnalysisNodeMapping {
  from: { storyId: string; position: Point3D };
  to: { storyId: string; position: Point3D };
}

function memberAnalysisNodeMappings(before: Member, after: Member): AnalysisNodeMapping[] {
  const from = memberAnalysisNodes(before);
  const to = memberAnalysisNodes(after);
  if (from.length !== to.length) return [];
  return from.map((node, index) => ({ from: node, to: to[index] }));
}

/**
 * Move point-based analysis data with member joints when every owner of the
 * old joint moves to the same new joint. Points shared by an unchanged member
 * or diaphragm master remain in place; divergent edits remain untouched and
 * are rejected by the final reference-validation gate.
 */
export function reconcileAnalysisPointsForMembers(
  before: ProjectData,
  after: ProjectData,
  changedMemberIds: Iterable<string>,
) {
  const changed = new Set(changedMemberIds);
  if (changed.size === 0) return;
  const beforeById = new Map(before.members.map((member) => [member.id, member]));
  const mappings = after.members.flatMap((member) => {
    if (!changed.has(member.id)) return [];
    const previous = beforeById.get(member.id);
    return previous ? memberAnalysisNodeMappings(previous, member) : [];
  });
  if (mappings.length === 0) return;

  const fixedNodes = [
    ...after.members
      .filter((member) => !changed.has(member.id))
      .flatMap(memberAnalysisNodes),
    ...(after.diaphragms ?? []).flatMap((diaphragm) =>
      diaphragm.masterPosition
        ? [{ storyId: diaphragm.storyId, position: diaphragm.masterPosition }]
        : [],
    ),
  ];

  const fixedByStory = new Map<string, SpatialPointIndex3D<boolean>>();
  for (const node of fixedNodes) {
    const index = fixedByStory.get(node.storyId) ??
      new SpatialPointIndex3D<boolean>(JOINT_MERGE_TOLERANCE);
    index.insert(node.position, true);
    fixedByStory.set(node.storyId, index);
  }
  const mappingsByStory = new Map<
    string,
    SpatialPointIndex3D<AnalysisNodeMapping>
  >();
  for (const mapping of mappings) {
    const index = mappingsByStory.get(mapping.from.storyId) ??
      new SpatialPointIndex3D<AnalysisNodeMapping>(JOINT_MERGE_TOLERANCE);
    index.insert(mapping.from.position, mapping);
    mappingsByStory.set(mapping.from.storyId, index);
  }

  const reconcile = (item: { storyId: string; position: Point3D }) => {
    if (fixedByStory.get(item.storyId)?.find(item.position)) return;
    const targets = (mappingsByStory.get(item.storyId)?.findAll(item.position) ?? [])
      .map((mapping) => mapping.to);
    if (targets.length === 0) return;
    const target = targets[0];
    if (!targets.every((candidate) => sameAnalysisNode(target, candidate))) return;
    item.storyId = target.storyId;
    item.position = { ...target.position };
  };

  for (const support of after.supports ?? []) reconcile(support);
  for (const load of after.nodalLoads ?? []) reconcile(load);
  for (const mass of after.masses ?? []) reconcile(mass);
}

function removeMemberReferences(
  data: ProjectData,
  deletedMemberIds: Set<string>,
  deletedMembers: Member[],
) {
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

  const deletedNodes = deletedMembers.flatMap(memberAnalysisNodes);
  if (deletedNodes.length > 0) {
    const retainedNodes = [
      ...data.members.flatMap(memberAnalysisNodes),
      ...(data.diaphragms ?? []).flatMap((diaphragm) =>
        diaphragm.masterPosition
          ? [{ storyId: diaphragm.storyId, position: diaphragm.masterPosition }]
          : [],
      ),
    ];
    const isNewlyOrphaned = (item: { storyId: string; position: Point3D }) =>
      deletedNodes.some((node) => sameAnalysisNode(item, node)) &&
      !retainedNodes.some((node) => sameAnalysisNode(item, node));
    if (data.supports) data.supports = data.supports.filter((item) => !isNewlyOrphaned(item));
    if (data.nodalLoads) {
      data.nodalLoads = data.nodalLoads.filter((item) => !isNewlyOrphaned(item));
    }
    if (data.masses) data.masses = data.masses.filter((item) => !isNewlyOrphaned(item));
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
  const deletedMembers = data.members.filter((member) => deletedIds.has(member.id));
  const deletedMemberIds = new Set(deletedMembers.map((member) => member.id));
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
  removeMemberReferences(data, deletedMemberIds, deletedMembers);

  const after =
    data.members.length +
    data.openings.length +
    data.annotations.length +
    data.dimensions.length +
    (data.constructionLines?.length ?? 0);
  return before !== after;
}

export function renameGridReferences(
  data: ProjectData,
  gridsBeforeRename: ProjectData['grids'],
  gridId: string,
  nextName: string,
) {
  for (const member of data.members) {
    if (!member.gridRef) continue;
    for (const key of ['startGrid', 'endGrid'] as const) {
      const pair = member.gridRef[key];
      if (!pair) continue;
      member.gridRef[key] = pair.map((token) => {
        // Stable ID references never need rewriting. A colliding grid name
        // must not steal a token that resolves to another grid's exact ID.
        if (token === gridId) return token;
        return resolveGridToken(gridsBeforeRename, token)?.id === gridId ? nextName : token;
      }) as [string, string];
    }
  }
}

export function detachGridReferences(
  data: ProjectData,
  gridsBeforeDelete: ProjectData['grids'],
  gridId: string,
) {
  const referencesGrid = (pair: [string, string] | undefined) =>
    pair?.some((token) => resolveGridToken(gridsBeforeDelete, token)?.id === gridId) ?? false;
  for (const member of data.members) {
    if (!member.gridRef) continue;
    if (referencesGrid(member.gridRef.startGrid)) {
      member.gridRef.startGrid = undefined;
    }
    if (referencesGrid(member.gridRef.endGrid)) {
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
  if (distance2D(origin, point) <= GEOM_EPSILON) return false;
  let memberChanged = false;
  for (const member of data.members) {
    if (storyId && member.story !== storyId) continue;
    if (member.type === 'slab') continue;
    const startMatches = distance2D(member.start, origin) <= tolerance;
    const endMatches = distance2D(member.end, origin) <= tolerance;
    if (startMatches) {
      member.start.x = point.x;
      member.start.y = point.y;
      memberChanged = true;
    }
    if (endMatches) {
      member.end.x = point.x;
      member.end.y = point.y;
      memberChanged = true;
    }
  }
  if (!memberChanged) return false;
  const moveAnalysisPoint = (itemStoryId: string, position: Point3D) => {
    if (storyId && itemStoryId !== storyId) return;
    if (distance2D(position, origin) > tolerance) return;
    position.x = point.x;
    position.y = point.y;
  };
  for (const support of data.supports ?? []) moveAnalysisPoint(support.storyId, support.position);
  for (const load of data.nodalLoads ?? []) moveAnalysisPoint(load.storyId, load.position);
  for (const mass of data.masses ?? []) moveAnalysisPoint(mass.storyId, mass.position);
  for (const diaphragm of data.diaphragms ?? []) {
    if (diaphragm.masterPosition) moveAnalysisPoint(diaphragm.storyId, diaphragm.masterPosition);
  }
  return true;
}
