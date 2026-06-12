import type { Point2D } from '@/domain/geometry/types';
import { dot2D, midpoint2D, normalize2D, perpendicular2D, sub2D } from '@/domain/geometry/point';
import type { Annotation, Dimension, Member, Opening, ProjectData } from './types';
import { getLinearMemberLength } from './editTransformPoints';

export function translatePoint(point: Point2D, dx: number, dy: number): Point2D {
  return { x: point.x + dx, y: point.y + dy };
}

export function scalePoint(point: Point2D, origin: Point2D, sx: number, sy: number): Point2D {
  return {
    x: origin.x + (point.x - origin.x) * sx,
    y: origin.y + (point.y - origin.y) * sy,
  };
}

export function reflectPoint(point: Point2D, axisStart: Point2D, axisDir: Point2D): Point2D {
  const v = sub2D(point, axisStart);
  const proj = dot2D(v, axisDir);
  return {
    x: 2 * (axisStart.x + axisDir.x * proj) - point.x,
    y: 2 * (axisStart.y + axisDir.y * proj) - point.y,
  };
}

export function transformMember(member: Member, transformPoint: (point: Point2D) => Point2D) {
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

export function transformAnnotation(
  annotation: Annotation,
  transformPoint: (point: Point2D) => Point2D,
) {
  const next = transformPoint({ x: annotation.x, y: annotation.y });
  annotation.x = next.x;
  annotation.y = next.y;
  if (annotation.points && annotation.points.length > 0) {
    annotation.points = annotation.points.map((p) => transformPoint(p));
  }
}

export function transformDimension(
  dimension: Dimension,
  transformPoint: (point: Point2D) => Point2D,
) {
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

export function transformOpening(
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

export function applyPointTransformToSelection(
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
