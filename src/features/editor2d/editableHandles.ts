import type { Point2D } from '@/domain/geometry/types';
import type { ProjectData } from '@/domain/structural/types';
import { JOINT_MERGE_TOLERANCE } from '@/domain/geometry/precision';

export type SelectionHandle =
  | { kind: 'connected-joint'; id: string; point: Point2D }
  | { kind: 'slab-vertex'; id: string; vertexIndex: number; point: Point2D }
  | { kind: 'dimension-start' | 'dimension-end'; id: string; point: Point2D }
  | { kind: 'annotation-point'; id: string; point: Point2D }
  | { kind: 'annotation-vertex'; id: string; vertexIndex: number; point: Point2D }
  | { kind: 'opening-point'; id: string; point: Point2D };

export function getSelectionHandles(
  data: ProjectData,
  selectedIds: string[],
  activeStory: string | null,
): SelectionHandle[] {
  const selected = new Set(selectedIds);
  const inStory = (story: string) => !activeStory || story === activeStory;
  const handles: SelectionHandle[] = [];

  const addJoint = (id: string, point: Point2D) => {
    // One handle per shared joint; dragging it updates every coincident endpoint.
    const duplicate = handles.some(
      (handle) =>
        handle.kind === 'connected-joint' &&
        Math.hypot(handle.point.x - point.x, handle.point.y - point.y) <=
          JOINT_MERGE_TOLERANCE,
    );
    if (duplicate) return;
    handles.push({ kind: 'connected-joint', id, point });
  };

  for (const member of data.members) {
    if (!selected.has(member.id) || !inStory(member.story)) continue;
    if (member.type === 'slab') {
      member.polygon.forEach((point, vertexIndex) => {
        handles.push({ kind: 'slab-vertex', id: member.id, vertexIndex, point });
      });
      continue;
    }
    if (member.type === 'column') {
      addJoint(member.id, { x: member.start.x, y: member.start.y });
      continue;
    }
    addJoint(member.id, { x: member.start.x, y: member.start.y });
    addJoint(member.id, { x: member.end.x, y: member.end.y });
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

  for (const opening of data.openings) {
    if (!selected.has(opening.id)) continue;
    const host = data.members.find((member) => member.id === opening.memberId);
    if (!host || !inStory(host.story)) continue;
    handles.push({
      kind: 'opening-point',
      id: opening.id,
      point: { x: opening.position.x, y: opening.position.y },
    });
  }

  return handles;
}
