import type { Point2D } from '@/domain/geometry/types';
import type { ProjectData } from '@/domain/structural/types';

export type SelectionHandle =
  | { kind: 'member-start' | 'member-end' | 'member-point'; id: string; point: Point2D }
  | { kind: 'slab-vertex'; id: string; vertexIndex: number; point: Point2D }
  | { kind: 'dimension-start' | 'dimension-end'; id: string; point: Point2D }
  | { kind: 'annotation-point'; id: string; point: Point2D }
  | { kind: 'annotation-vertex'; id: string; vertexIndex: number; point: Point2D };

export function getSelectionHandles(
  data: ProjectData,
  selectedIds: string[],
  activeStory: string | null,
): SelectionHandle[] {
  const selected = new Set(selectedIds);
  const inStory = (story: string) => !activeStory || story === activeStory;
  const handles: SelectionHandle[] = [];

  for (const member of data.members) {
    if (!selected.has(member.id) || !inStory(member.story)) continue;
    if (member.type === 'slab') {
      member.polygon.forEach((point, vertexIndex) => {
        handles.push({ kind: 'slab-vertex', id: member.id, vertexIndex, point });
      });
      continue;
    }
    if (member.type === 'column') {
      handles.push({ kind: 'member-point', id: member.id, point: { x: member.start.x, y: member.start.y } });
      continue;
    }
    handles.push({ kind: 'member-start', id: member.id, point: { x: member.start.x, y: member.start.y } });
    handles.push({ kind: 'member-end', id: member.id, point: { x: member.end.x, y: member.end.y } });
  }

  for (const dimension of data.dimensions) {
    if (!selected.has(dimension.id) || !inStory(dimension.story)) continue;
    handles.push({ kind: 'dimension-start', id: dimension.id, point: dimension.start });
    handles.push({ kind: 'dimension-end', id: dimension.id, point: dimension.end });
  }

  for (const annotation of data.annotations) {
    if (!selected.has(annotation.id) || !inStory(annotation.story)) continue;
    if (annotation.type === 'spline' && annotation.points && annotation.points.length > 0) {
      annotation.points.forEach((point, vertexIndex) => {
        handles.push({ kind: 'annotation-vertex', id: annotation.id, vertexIndex, point });
      });
    } else {
      handles.push({ kind: 'annotation-point', id: annotation.id, point: { x: annotation.x, y: annotation.y } });
    }
  }

  return handles;
}
