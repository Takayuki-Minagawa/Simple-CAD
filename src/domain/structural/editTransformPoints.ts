import type { Point2D } from '@/domain/geometry/types';
import type { Annotation, Dimension, Member, ProjectData } from './types';

export function getMemberPoints(member: Member): Point2D[] {
  if (member.type === 'slab') {
    return member.polygon.map((point) => ({ x: point.x, y: point.y }));
  }

  return [
    { x: member.start.x, y: member.start.y },
    { x: member.end.x, y: member.end.y },
  ];
}

export function getDimensionPoints(dimension: Dimension): Point2D[] {
  return [dimension.start, dimension.end];
}

export function getAnnotationPoints(annotation: Annotation): Point2D[] {
  if (annotation.points && annotation.points.length > 0) {
    return annotation.points.map((p) => ({ x: p.x, y: p.y }));
  }
  return [{ x: annotation.x, y: annotation.y }];
}

export function getSelectionPoints(data: ProjectData, ids: string[]): Point2D[] {
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

export function getLinearMemberLength(member: Member): number | null {
  if (member.type === 'slab') return null;
  return Math.hypot(member.end.x - member.start.x, member.end.y - member.start.y);
}
