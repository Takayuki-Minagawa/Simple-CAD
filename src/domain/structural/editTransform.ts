import type { Point2D } from '@/domain/geometry/types';
import { normalize2D, perpendicular2D, sub2D } from '@/domain/geometry/point';
import { collectAllIds, generateId, prefixFor } from '@/domain/idGenerator';
import { deepClone } from '@/libs/clone';
import type { ProjectData } from './types';
import { getAnnotationPoints, getMemberPoints, getSelectionPoints } from './editTransformPoints';
import {
  applyPointTransformToSelection,
  reflectPoint,
  scalePoint,
  translatePoint,
} from './editTransformApply';
import { cloneSelectionWithTransform } from './editSelectionClone';

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

function isPointListEmpty(points: Point2D[]): boolean {
  return points.length === 0;
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
  const copyCount = Math.max(1, Math.floor(options.count ?? 1));
  const createdIds: string[] = [];
  const usedIds = collectAllIds(data);

  for (let index = 1; index <= copyCount; index++) {
    const pointTransform = (point: Point2D) =>
      translatePoint(point, options.dx * index, options.dy * index);
    createdIds.push(...cloneSelectionWithTransform(data, ids, pointTransform, usedIds));
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
  applyPointTransformToSelection(data, ids, (point) => scalePoint(point, origin, scaleX, scaleY));
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

export function offsetSelection(data: ProjectData, ids: string[], distance: number): string[] {
  const selectedIds = new Set(ids);
  const createdIds: string[] = [];
  const usedIds = collectAllIds(data);

  for (const member of [...data.members]) {
    if (!selectedIds.has(member.id)) continue;
    if (member.type === 'slab') continue;

    const isZeroLength = member.start.x === member.end.x && member.start.y === member.end.y;

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
      const dir = normalize2D(
        sub2D({ x: member.end.x, y: member.end.y }, { x: member.start.x, y: member.start.y }),
      );
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

  return cloneSelectionWithTransform(data, ids, mirrorTransform);
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
    let minX = pts[0].x,
      minY = pts[0].y,
      maxX = pts[0].x,
      maxY = pts[0].y;
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
    let aMinX = aPts[0].x,
      aMinY = aPts[0].y,
      aMaxX = aPts[0].x,
      aMaxY = aPts[0].y;
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
  let minX = entities[0].minX,
    minY = entities[0].minY;
  let maxX = entities[0].maxX,
    maxY = entities[0].maxY;
  for (const e of entities.slice(1)) {
    minX = Math.min(minX, e.minX);
    minY = Math.min(minY, e.minY);
    maxX = Math.max(maxX, e.maxX);
    maxY = Math.max(maxY, e.maxY);
  }
  return { minX, minY, maxX, maxY };
}
