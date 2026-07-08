import { getColumnVerticalSpan } from '@/domain/structural/placement';
import type {
  Annotation,
  BeamMember,
  ColumnMember,
  ConstructionLine,
  Dimension,
  ProjectData,
  SlabMember,
  Story,
  WallMember,
} from '@/domain/structural/types';
import type { Point2D } from '@/domain/geometry/types';
import type { ColumnPlacementDirection } from '@/domain/structural/placement';
import { generateId } from '@/domain/idGenerator';

export function defaultSectionId(
  data: ProjectData,
  type: 'column' | 'beam' | 'wall' | 'slab',
): string {
  const map = {
    column: 'rc_column_rect',
    beam: 'rc_beam_rect',
    wall: 'rc_wall',
    slab: 'rc_slab',
  } as const;
  return (
    data.sections.find((section) => section.kind === map[type])?.id ?? data.sections[0]?.id ?? ''
  );
}

export function defaultMaterialId(data: ProjectData): string {
  return data.materials[0]?.id ?? '';
}

export function createColumnMemberAt(
  data: ProjectData,
  activeStory: string,
  columnPlacementDirection: ColumnPlacementDirection,
  pos: Point2D,
  usedIds: Set<string>,
): ColumnMember | null {
  const span = getColumnVerticalSpan(data.stories, activeStory, columnPlacementDirection);
  if (!span) return null;
  return {
    id: generateId('col', usedIds),
    type: 'column',
    story: activeStory,
    sectionId: defaultSectionId(data, 'column'),
    materialId: defaultMaterialId(data),
    start: { x: pos.x, y: pos.y, z: span.startZ },
    end: { x: pos.x, y: pos.y, z: span.endZ },
    rotation: 0,
  };
}

export function createBeamMemberFromPoints(
  data: ProjectData,
  activeStory: string,
  story: Story,
  points: [Point2D, Point2D],
  usedIds: Set<string>,
): BeamMember {
  return {
    id: generateId('beam', usedIds),
    type: 'beam',
    story: activeStory,
    sectionId: defaultSectionId(data, 'beam'),
    materialId: defaultMaterialId(data),
    start: { x: points[0].x, y: points[0].y, z: story.elevation + story.height },
    end: { x: points[1].x, y: points[1].y, z: story.elevation + story.height },
    rotation: 0,
  };
}

export function createWallMemberFromPoints(
  data: ProjectData,
  activeStory: string,
  story: Story,
  points: [Point2D, Point2D],
  usedIds: Set<string>,
): WallMember {
  const sectionId = defaultSectionId(data, 'wall');
  const section = data.sections.find((item) => item.id === sectionId);
  const thickness = section && 'thickness' in section ? section.thickness : 200;
  return {
    id: generateId('wall', usedIds),
    type: 'wall',
    story: activeStory,
    sectionId,
    materialId: defaultMaterialId(data),
    start: { x: points[0].x, y: points[0].y, z: story.elevation },
    end: { x: points[1].x, y: points[1].y, z: story.elevation },
    height: story.height,
    thickness,
    rotation: 0,
  };
}

export function createDimensionFromPoints(
  activeStory: string,
  points: [Point2D, Point2D],
  usedIds: Set<string>,
): Dimension {
  return {
    id: generateId('dim', usedIds),
    story: activeStory,
    start: { x: points[0].x, y: points[0].y },
    end: { x: points[1].x, y: points[1].y },
    offset: -1000,
  };
}

export function createTextAnnotationAt(
  activeStory: string,
  pos: Point2D,
  text: string,
  usedIds: Set<string>,
): Annotation {
  return {
    id: generateId('ann', usedIds),
    type: 'text',
    story: activeStory,
    x: pos.x,
    y: pos.y,
    text,
  };
}

export function createConstructionLineFromPoints(
  activeStory: string,
  points: [Point2D, Point2D],
  usedIds: Set<string>,
): ConstructionLine | null {
  const dx = points[1].x - points[0].x;
  const dy = points[1].y - points[0].y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  return {
    id: generateId('xl', usedIds),
    story: activeStory,
    type: 'xline',
    origin: { x: points[0].x, y: points[0].y },
    direction: { x: dx / length, y: dy / length },
  };
}

export function createSlabMemberFromPoints(
  data: ProjectData,
  activeStory: string,
  story: Story,
  points: Point2D[],
  usedIds: Set<string>,
): SlabMember {
  return {
    id: generateId('slab', usedIds),
    type: 'slab',
    story: activeStory,
    sectionId: defaultSectionId(data, 'slab'),
    materialId: defaultMaterialId(data),
    polygon: points.map((point) => ({ x: point.x, y: point.y })),
    level: story.elevation + story.height,
  };
}

export function createSplineAnnotation(
  activeStory: string,
  points: Point2D[],
  usedIds: Set<string>,
): Annotation {
  return {
    id: generateId('spl', usedIds),
    type: 'spline',
    story: activeStory,
    x: points[0].x,
    y: points[0].y,
    text: '',
    points: points.map((point) => ({ x: point.x, y: point.y })),
  };
}
