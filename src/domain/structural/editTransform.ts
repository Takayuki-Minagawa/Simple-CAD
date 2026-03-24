import type { Point2D } from '@/domain/geometry/types';
import { dot2D, midpoint2D, normalize2D, perpendicular2D, sub2D } from '@/domain/geometry/point';
import { collectAllIds, generateId, prefixFor } from '@/domain/idGenerator';
import type { Annotation, Dimension, Member, Opening, ProjectData } from './types';

export interface ArraySelectionOptions {
  columns: number;
  rows: number;
  colSpacing: number;
  rowSpacing: number;
}

export interface SelectionBounds {
  min: Point2D;
  max: Point2D;
  width: number;
  height: number;
  center: Point2D;
}

export type TransformAnchor = 'min' | 'center' | 'max';

export interface CopySelectionOptions {
  dx: number;
  dy: number;
  count?: number;
}

export interface StretchSelectionOptions {
  targetWidth: number;
  targetHeight: number;
  anchorX: TransformAnchor;
  anchorY: TransformAnchor;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function translatePoint(point: Point2D, dx: number, dy: number): Point2D {
  return { x: point.x + dx, y: point.y + dy };
}

function scalePoint(point: Point2D, origin: Point2D, sx: number, sy: number): Point2D {
  return {
    x: origin.x + (point.x - origin.x) * sx,
    y: origin.y + (point.y - origin.y) * sy,
  };
}

function isPointListEmpty(points: Point2D[]): boolean {
  return points.length === 0;
}

function getMemberPoints(member: Member): Point2D[] {
  if (member.type === 'slab') {
    return member.polygon.map((point) => ({ x: point.x, y: point.y }));
  }

  return [
    { x: member.start.x, y: member.start.y },
    { x: member.end.x, y: member.end.y },
  ];
}

function getDimensionPoints(dimension: Dimension): Point2D[] {
  return [dimension.start, dimension.end];
}

function getAnnotationPoints(annotation: Annotation): Point2D[] {
  if (annotation.points && annotation.points.length > 0) {
    return annotation.points.map((p) => ({ x: p.x, y: p.y }));
  }
  return [{ x: annotation.x, y: annotation.y }];
}

function getSelectionPoints(data: ProjectData, ids: string[]): Point2D[] {
  const selectedIds = new Set(ids);
  const points: Point2D[] = [];

  for (const member of data.members) {
    if (selectedIds.has(member.id)) {
      points.push(...getMemberPoints(member));
    }
  }

  for (const annotation of data.annotations) {
    if (selectedIds.has(annotation.id)) {
      points.push(...getAnnotationPoints(annotation));
    }
  }

  for (const dimension of data.dimensions) {
    if (selectedIds.has(dimension.id)) {
      points.push(...getDimensionPoints(dimension));
    }
  }

  return points;
}

export function getSelectionBounds(data: ProjectData, ids: string[]): SelectionBounds | null {
  const points = getSelectionPoints(data, ids);
  if (isPointListEmpty(points)) return null;

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (const point of points.slice(1)) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY },
    width: maxX - minX,
    height: maxY - minY,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
}

function getLinearMemberLength(member: Member): number | null {
  if (member.type === 'slab') return null;
  return Math.hypot(member.end.x - member.start.x, member.end.y - member.start.y);
}

function transformMember(member: Member, transformPoint: (point: Point2D) => Point2D) {
  if (member.type === 'slab') {
    member.polygon = member.polygon.map((point) => transformPoint(point));
    return;
  }

  const start = transformPoint({ x: member.start.x, y: member.start.y });
  const end = transformPoint({ x: member.end.x, y: member.end.y });

  member.start.x = start.x;
  member.start.y = start.y;
  member.end.x = end.x;
  member.end.y = end.y;
}

function transformAnnotation(annotation: Annotation, transformPoint: (point: Point2D) => Point2D) {
  const next = transformPoint({ x: annotation.x, y: annotation.y });
  annotation.x = next.x;
  annotation.y = next.y;
  if (annotation.points && annotation.points.length > 0) {
    annotation.points = annotation.points.map((p) => transformPoint(p));
  }
}

function transformDimension(dimension: Dimension, transformPoint: (point: Point2D) => Point2D) {
  const start = transformPoint(dimension.start);
  const end = transformPoint(dimension.end);
  let nextOffset = dimension.offset;

  const originalDir = normalize2D(sub2D(dimension.end, dimension.start));
  if (originalDir.x !== 0 || originalDir.y !== 0) {
    const originalPerp = perpendicular2D(originalDir);
    const originalMid = midpoint2D(dimension.start, dimension.end);
    const controlPoint = {
      x: originalMid.x + originalPerp.x * dimension.offset,
      y: originalMid.y + originalPerp.y * dimension.offset,
    };
    const transformedControl = transformPoint(controlPoint);
    const nextDir = normalize2D(sub2D(end, start));
    if (nextDir.x !== 0 || nextDir.y !== 0) {
      const nextPerp = perpendicular2D(nextDir);
      const nextMid = midpoint2D(start, end);
      nextOffset = dot2D(sub2D(transformedControl, nextMid), nextPerp);
    }
  }

  dimension.start = start;
  dimension.end = end;
  dimension.offset = Number.isFinite(nextOffset) ? nextOffset : dimension.offset;
}

function transformOpening(
  opening: Opening,
  transformPoint: (point: Point2D) => Point2D,
  widthScale = 1,
) {
  const next = transformPoint({ x: opening.position.x, y: opening.position.y });
  opening.position.x = next.x;
  opening.position.y = next.y;
  if (Number.isFinite(widthScale) && widthScale > 0) {
    opening.width *= widthScale;
  }
}

function applyPointTransformToSelection(
  data: ProjectData,
  ids: string[],
  transformPoint: (point: Point2D) => Point2D,
) {
  const selectedIds = new Set(ids);
  const selectedMembers = data.members.filter((member) => selectedIds.has(member.id));
  const selectedMemberMap = new Map(selectedMembers.map((member) => [member.id, member]));
  const originalMemberLengths = new Map(
    selectedMembers
      .map((member) => [member.id, getLinearMemberLength(member)] as const)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );

  for (const member of selectedMembers) {
    transformMember(member, transformPoint);
  }

  for (const opening of data.openings) {
    if (!selectedMemberMap.has(opening.memberId)) continue;
    const member = selectedMemberMap.get(opening.memberId)!;
    const originalLength = originalMemberLengths.get(opening.memberId);
    const nextLength = getLinearMemberLength(member);
    const widthScale =
      typeof originalLength === 'number' &&
      originalLength > 0 &&
      typeof nextLength === 'number' &&
      nextLength > 0
        ? nextLength / originalLength
        : 1;
    transformOpening(opening, transformPoint, widthScale);
  }

  for (const annotation of data.annotations) {
    if (selectedIds.has(annotation.id)) {
      transformAnnotation(annotation, transformPoint);
    }
  }

  for (const dimension of data.dimensions) {
    if (selectedIds.has(dimension.id)) {
      transformDimension(dimension, transformPoint);
    }
  }
}

function getTargetRange(min: number, max: number, targetSize: number, anchor: TransformAnchor) {
  if (anchor === 'min') {
    return { min, max: min + targetSize };
  }
  if (anchor === 'max') {
    return { min: max - targetSize, max };
  }

  const center = (min + max) / 2;
  return {
    min: center - targetSize / 2,
    max: center + targetSize / 2,
  };
}

function stretchAxis(
  value: number,
  min: number,
  max: number,
  targetSize: number,
  anchor: TransformAnchor,
) {
  const currentSize = max - min;
  if (currentSize === 0) return value;

  const targetRange = getTargetRange(min, max, targetSize, anchor);
  const ratio = (value - min) / currentSize;
  return targetRange.min + (targetRange.max - targetRange.min) * ratio;
}

export function translateSelection(data: ProjectData, ids: string[], dx: number, dy: number) {
  applyPointTransformToSelection(data, ids, (point) => translatePoint(point, dx, dy));
}

export function duplicateSelection(
  data: ProjectData,
  ids: string[],
  options: CopySelectionOptions,
): string[] {
  const selectedIds = new Set(ids);
  const selectedMembers = data.members.filter((member) => selectedIds.has(member.id));
  const selectedAnnotations = data.annotations.filter((annotation) => selectedIds.has(annotation.id));
  const selectedDimensions = data.dimensions.filter((dimension) => selectedIds.has(dimension.id));
  const openingsByMember = new Map<string, Opening[]>();
  const copyCount = Math.max(1, Math.floor(options.count ?? 1));
  const createdIds: string[] = [];
  const usedIds = collectAllIds(data);

  for (const opening of data.openings) {
    if (!selectedIds.has(opening.memberId)) continue;
    const list = openingsByMember.get(opening.memberId) ?? [];
    list.push(opening);
    openingsByMember.set(opening.memberId, list);
  }

  for (let index = 1; index <= copyCount; index++) {
    const pointTransform = (point: Point2D) =>
      translatePoint(point, options.dx * index, options.dy * index);
    const memberIdMap = new Map<string, string>();

    for (const member of selectedMembers) {
      const clone = deepClone(member);
      clone.id = generateId(prefixFor(member.type), usedIds);
      transformMember(clone, pointTransform);
      memberIdMap.set(member.id, clone.id);
      data.members.push(clone);
      createdIds.push(clone.id);
    }

    for (const annotation of selectedAnnotations) {
      const clone = deepClone(annotation);
      clone.id = generateId(annotation.type === 'spline' ? 'spl' : 'ann', usedIds);
      transformAnnotation(clone, pointTransform);
      data.annotations.push(clone);
      createdIds.push(clone.id);
    }

    for (const dimension of selectedDimensions) {
      const clone = deepClone(dimension);
      clone.id = generateId('dim', usedIds);
      transformDimension(clone, pointTransform);
      data.dimensions.push(clone);
      createdIds.push(clone.id);
    }

    for (const [memberId, openings] of openingsByMember) {
      const clonedMemberId = memberIdMap.get(memberId);
      if (!clonedMemberId) continue;
      for (const opening of openings) {
        const clone = deepClone(opening);
        clone.id = generateId('opn', usedIds);
        clone.memberId = clonedMemberId;
        transformOpening(clone, pointTransform);
        data.openings.push(clone);
      }
    }
  }

  return createdIds;
}

export function scaleSelection(
  data: ProjectData,
  ids: string[],
  origin: Point2D,
  scaleX: number,
  scaleY: number,
) {
  applyPointTransformToSelection(data, ids, (point) =>
    scalePoint(point, origin, scaleX, scaleY),
  );
}

export function stretchSelection(
  data: ProjectData,
  ids: string[],
  options: StretchSelectionOptions,
): SelectionBounds | null {
  const bounds = getSelectionBounds(data, ids);
  if (!bounds) return null;

  applyPointTransformToSelection(data, ids, (point) => ({
    x: stretchAxis(point.x, bounds.min.x, bounds.max.x, options.targetWidth, options.anchorX),
    y: stretchAxis(point.y, bounds.min.y, bounds.max.y, options.targetHeight, options.anchorY),
  }));

  return bounds;
}

// ── Offset (parallel copy) ──

export function offsetSelection(
  data: ProjectData,
  ids: string[],
  distance: number,
): string[] {
  const selectedIds = new Set(ids);
  const createdIds: string[] = [];
  const usedIds = collectAllIds(data);

  for (const member of [...data.members]) {
    if (!selectedIds.has(member.id)) continue;
    if (member.type === 'slab') continue;

    const isZeroLength =
      member.start.x === member.end.x && member.start.y === member.end.y;

    if (isZeroLength) {
      // Zero-length members (e.g. point columns): offset in X direction
      const clone = deepClone(member);
      clone.id = generateId(prefixFor(member.type), usedIds);
      clone.start.x += distance;
      clone.end.x += distance;
      data.members.push(clone);
      createdIds.push(clone.id);
    } else {
      // Normal linear members: offset perpendicular
      const dir = normalize2D(sub2D(
        { x: member.end.x, y: member.end.y },
        { x: member.start.x, y: member.start.y },
      ));
      const perp = perpendicular2D(dir);
      const dx = perp.x * distance;
      const dy = perp.y * distance;

      const clone = deepClone(member);
      clone.id = generateId(prefixFor(member.type), usedIds);
      clone.start.x += dx;
      clone.start.y += dy;
      clone.end.x += dx;
      clone.end.y += dy;
      data.members.push(clone);
      createdIds.push(clone.id);
    }
  }

  return createdIds;
}

// ── Mirror ──

function reflectPoint(point: Point2D, axisStart: Point2D, axisDir: Point2D): Point2D {
  const v = sub2D(point, axisStart);
  const proj = dot2D(v, axisDir);
  return {
    x: 2 * (axisStart.x + axisDir.x * proj) - point.x,
    y: 2 * (axisStart.y + axisDir.y * proj) - point.y,
  };
}

export function mirrorSelection(
  data: ProjectData,
  ids: string[],
  axisStart: Point2D,
  axisEnd: Point2D,
  copy: boolean,
): string[] {
  const axisDir = normalize2D(sub2D(axisEnd, axisStart));
  if (axisDir.x === 0 && axisDir.y === 0) return [];

  const mirrorTransform = (point: Point2D): Point2D => reflectPoint(point, axisStart, axisDir);

  if (!copy) {
    applyPointTransformToSelection(data, ids, mirrorTransform);
    return [];
  }

  // copy mode: duplicate then mirror the copies
  const selectedIds = new Set(ids);
  const createdIds: string[] = [];
  const memberIdMap = new Map<string, string>();
  const usedIds = collectAllIds(data);

  for (const member of [...data.members]) {
    if (!selectedIds.has(member.id)) continue;
    const clone = deepClone(member);
    clone.id = generateId(prefixFor(member.type), usedIds);
    transformMember(clone, mirrorTransform);
    memberIdMap.set(member.id, clone.id);
    data.members.push(clone);
    createdIds.push(clone.id);
  }

  for (const annotation of [...data.annotations]) {
    if (!selectedIds.has(annotation.id)) continue;
    const clone = deepClone(annotation);
    clone.id = generateId(annotation.type === 'spline' ? 'spl' : 'ann', usedIds);
    transformAnnotation(clone, mirrorTransform);
    data.annotations.push(clone);
    createdIds.push(clone.id);
  }

  for (const dimension of [...data.dimensions]) {
    if (!selectedIds.has(dimension.id)) continue;
    const clone = deepClone(dimension);
    clone.id = generateId('dim', usedIds);
    transformDimension(clone, mirrorTransform);
    data.dimensions.push(clone);
    createdIds.push(clone.id);
  }

  for (const opening of [...data.openings]) {
    if (!selectedIds.has(opening.memberId)) continue;
    const clonedMemberId = memberIdMap.get(opening.memberId);
    if (!clonedMemberId) continue;
    const clone = deepClone(opening);
    clone.id = generateId('opn', usedIds);
    clone.memberId = clonedMemberId;
    transformOpening(clone, mirrorTransform);
    data.openings.push(clone);
  }

  return createdIds;
}

// ── Array (rectangular) ──

export function arraySelection(
  data: ProjectData,
  ids: string[],
  options: ArraySelectionOptions,
): string[] {
  const createdIds: string[] = [];
  const cols = Math.max(1, Math.floor(options.columns));
  const rows = Math.max(1, Math.floor(options.rows));

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      if (col === 0 && row === 0) continue; // skip original position
      const dx = col * options.colSpacing;
      const dy = row * options.rowSpacing;
      const newIds = duplicateSelection(data, ids, { dx, dy, count: 1 });
      createdIds.push(...newIds);
    }
  }

  return createdIds;
}

// ── Bounding box helpers for rectangle selection ──

export interface EntityBounds {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function getEntityBoundsList(data: ProjectData, storyId: string | null): EntityBounds[] {
  const result: EntityBounds[] = [];

  for (const member of data.members) {
    if (storyId && member.story !== storyId) continue;
    const pts = getMemberPoints(member);
    if (pts.length === 0) continue;
    let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y;
    for (const p of pts.slice(1)) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    result.push({ id: member.id, minX, minY, maxX, maxY });
  }

  for (const annotation of data.annotations) {
    if (storyId && annotation.story !== storyId) continue;
    const aPts = getAnnotationPoints(annotation);
    if (aPts.length === 0) continue;
    let aMinX = aPts[0].x, aMinY = aPts[0].y, aMaxX = aPts[0].x, aMaxY = aPts[0].y;
    for (const p of aPts.slice(1)) {
      aMinX = Math.min(aMinX, p.x);
      aMinY = Math.min(aMinY, p.y);
      aMaxX = Math.max(aMaxX, p.x);
      aMaxY = Math.max(aMaxY, p.y);
    }
    result.push({ id: annotation.id, minX: aMinX, minY: aMinY, maxX: aMaxX, maxY: aMaxY });
  }

  for (const dimension of data.dimensions) {
    if (storyId && dimension.story !== storyId) continue;
    result.push({
      id: dimension.id,
      minX: Math.min(dimension.start.x, dimension.end.x),
      minY: Math.min(dimension.start.y, dimension.end.y),
      maxX: Math.max(dimension.start.x, dimension.end.x),
      maxY: Math.max(dimension.start.y, dimension.end.y),
    });
  }

  return result;
}

/**
 * Returns IDs of entities inside (window) or intersecting (crossing) the selection rectangle.
 */
export function selectByRectangle(
  entities: EntityBounds[],
  rectMinX: number,
  rectMinY: number,
  rectMaxX: number,
  rectMaxY: number,
  mode: 'window' | 'crossing',
): string[] {
  const ids: string[] = [];
  for (const e of entities) {
    if (mode === 'window') {
      // Fully enclosed
      if (e.minX >= rectMinX && e.maxX <= rectMaxX && e.minY >= rectMinY && e.maxY <= rectMaxY) {
        ids.push(e.id);
      }
    } else {
      // Crossing: any overlap
      if (e.maxX >= rectMinX && e.minX <= rectMaxX && e.maxY >= rectMinY && e.minY <= rectMaxY) {
        ids.push(e.id);
      }
    }
  }
  return ids;
}

// ── Compute all-entity bounds (for zoom extents) ──

export function getAllEntityBounds(
  data: ProjectData,
  storyId: string | null,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const entities = getEntityBoundsList(data, storyId);
  if (entities.length === 0) return null;
  let minX = entities[0].minX, minY = entities[0].minY;
  let maxX = entities[0].maxX, maxY = entities[0].maxY;
  for (const e of entities.slice(1)) {
    minX = Math.min(minX, e.minX);
    minY = Math.min(minY, e.minY);
    maxX = Math.max(maxX, e.maxX);
    maxY = Math.max(maxY, e.maxY);
  }
  return { minX, minY, maxX, maxY };
}
