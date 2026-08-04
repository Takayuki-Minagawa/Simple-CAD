import type { Point2D } from '@/domain/geometry/types';
import type { Member, Section } from './types';
import {
  columnAxisOffsetToWorld,
  effectiveLinearAxisOffset,
  linearAxisOffsetToWorld,
  slabAxisOffsetToWorld,
} from './eccentricity';

export const DEFAULT_COLUMN_WIDTH = 600;
export const DEFAULT_COLUMN_DEPTH = 600;
export const DEFAULT_BEAM_WIDTH = 300;
export const DEFAULT_BEAM_DEPTH = 600;
export const DEFAULT_SLAB_THICKNESS = 180;

export interface RectSize {
  width: number;
  depth: number;
}

export function getColumnRectSize(section: Section | undefined): RectSize {
  if (section?.kind === 's_pipe') {
    return { width: section.diameter, depth: section.diameter };
  }
  return {
    width: section && 'width' in section ? section.width : DEFAULT_COLUMN_WIDTH,
    depth: section && 'depth' in section ? section.depth : DEFAULT_COLUMN_DEPTH,
  };
}

export function getBeamRectSize(section: Section | undefined): RectSize {
  if (section?.kind === 's_pipe') {
    return { width: section.diameter, depth: section.diameter };
  }
  return {
    width: section && 'width' in section ? section.width : DEFAULT_BEAM_WIDTH,
    depth: section && 'depth' in section ? section.depth : DEFAULT_BEAM_DEPTH,
  };
}

export function getWallThickness(
  member: Member & { type: 'wall' },
  section: Section | undefined,
): number {
  return section && 'thickness' in section ? section.thickness : member.thickness;
}

export function getSlabThickness(section: Section | undefined): number {
  return section && 'thickness' in section ? section.thickness : DEFAULT_SLAB_THICKNESS;
}

export function getMemberPlanPolygon(
  member: Member,
  section: Section | undefined,
): Point2D[] | null {
  switch (member.type) {
    case 'column': {
      const { width, depth } = getColumnRectSize(section);
      const offset = columnAxisOffsetToWorld(member.axisOffset);
      return buildRotatedRectangle(
        { x: member.start.x + offset.x, y: member.start.y + offset.y },
        width,
        depth,
        member.rotation ?? 0,
      );
    }
    case 'beam': {
      const { width } = getBeamRectSize(section);
      return buildLinearMemberPolygon(
        { x: member.start.x, y: member.start.y },
        { x: member.end.x, y: member.end.y },
        width,
        effectiveLinearAxisOffset(member, width),
      );
    }
    case 'wall':
      return buildLinearMemberPolygon(
        { x: member.start.x, y: member.start.y },
        { x: member.end.x, y: member.end.y },
        getWallThickness(member, section),
        effectiveLinearAxisOffset(member, getWallThickness(member, section)),
      );
    case 'slab': {
      const offset = slabAxisOffsetToWorld(member.axisOffset);
      return member.polygon.map((point) => ({ x: point.x + offset.x, y: point.y + offset.y }));
    }
  }
}

export function buildLinearMemberPolygon(
  start: Point2D,
  end: Point2D,
  width: number,
  axisOffset?: { dx: number; dy: number },
): Point2D[] | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  // sqrt(dx²+dy²) instead of Math.hypot: identical IEEE754 result across
  // languages, so ports (e.g. the Python CLI renderer) match bit-for-bit.
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return null;

  const normal = {
    x: (-dy / length) * (width / 2),
    y: (dx / length) * (width / 2),
  };
  const offset = linearAxisOffsetToWorld(axisOffset, start, end);
  const ox = offset.x;
  const oy = offset.y;

  return [
    { x: start.x + normal.x + ox, y: start.y + normal.y + oy },
    { x: end.x + normal.x + ox, y: end.y + normal.y + oy },
    { x: end.x - normal.x + ox, y: end.y - normal.y + oy },
    { x: start.x - normal.x + ox, y: start.y - normal.y + oy },
  ];
}

export function buildRotatedRectangle(
  center: Point2D,
  width: number,
  depth: number,
  rotation: number,
): Point2D[] {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const corner = (x: number, y: number): Point2D => ({
    x: center.x + x * cos - y * sin,
    y: center.y + x * sin + y * cos,
  });

  return [
    corner(-halfWidth, -halfDepth),
    corner(halfWidth, -halfDepth),
    corner(halfWidth, halfDepth),
    corner(-halfWidth, halfDepth),
  ];
}

export function formatPointList(points: Point2D[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}
