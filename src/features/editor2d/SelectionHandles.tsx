import { useEffect, useRef, useState } from 'react';
import { useEditorStore, useProjectStore } from '@/app/store';
import { screenToWorld, snapPointToGrid } from '@/domain/geometry/transform';
import type { Point2D } from '@/domain/geometry/types';
import type { Member } from '@/domain/structural/types';
import { findSnap } from '@/domain/geometry/snap';
import { getSelectionHandles, type SelectionHandle } from './editableHandles';
import { buildEditorSnapCandidates } from './useEditorInteraction';

function updateLinearMemberPoint(member: Exclude<Member, { type: 'slab' }>, kind: SelectionHandle['kind'], point: Point2D): Partial<Member> {
  if (kind === 'member-point') {
    return {
      start: { ...member.start, x: point.x, y: point.y },
      end: { ...member.end, x: point.x, y: point.y },
    } as Partial<Member>;
  }
  if (kind === 'member-start') {
    return { start: { ...member.start, x: point.x, y: point.y } } as Partial<Member>;
  }
  return { end: { ...member.end, x: point.x, y: point.y } } as Partial<Member>;
}

function getHandleKey(handle: SelectionHandle): string {
  return `${handle.kind}-${handle.id}-${'vertexIndex' in handle ? handle.vertexIndex : 'point'}`;
}

/**
 * Snap an edit-drag point using the SAME full snapping pipeline as drawing
 * (endpoint / midpoint / intersection / perpendicular / nearest / grid).
 * The member being dragged is excluded from the candidates to avoid the handle
 * snapping onto its own geometry.
 */
function snapDragPoint(point: Point2D, excludeId?: string): Point2D {
  const { activeSnapModes, gridSpacing, snapEnabled, zoom, activeStory } = useEditorStore.getState();
  if (!snapEnabled) return point;

  const data = useProjectStore.getState().data;
  if (data) {
    const candidates = buildEditorSnapCandidates(data, activeStory, { excludeId });
    const snap = findSnap(point, candidates, activeSnapModes, gridSpacing, 15, zoom);
    if (snap) return snap.point;
  }

  // Fall back to grid snap when no entity snap matched.
  if (activeSnapModes.includes('grid')) {
    return snapPointToGrid(point, gridSpacing);
  }
  return point;
}

export function SelectionHandles() {
  const data = useProjectStore((s) => s.data);
  const updateMember = useProjectStore((s) => s.updateMember);
  const updateSlabVertex = useProjectStore((s) => s.updateSlabVertex);
  const updateDimension = useProjectStore((s) => s.updateDimension);
  const updateAnnotation = useProjectStore((s) => s.updateAnnotation);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const activeStory = useEditorStore((s) => s.activeStory);
  const zoom = useEditorStore((s) => s.zoom);
  const [dragging, setDragging] = useState<{ handle: SelectionHandle; svg: SVGSVGElement } | null>(null);
  const [dragPreviewPoint, setDragPreviewPoint] = useState<Point2D | null>(null);
  const dragPreviewPointRef = useRef<Point2D | null>(null);

  const handles = data ? getSelectionHandles(data, selectedIds, activeStory) : [];
  const radius = Math.max(35, 6 / zoom);

  useEffect(() => {
    if (!dragging) return;

    const toWorld = (e: MouseEvent): Point2D | null => {
      const svg = dragging.svg;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const pan = useEditorStore.getState().pan;
      const currentZoom = useEditorStore.getState().zoom;
      return screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, pan, currentZoom);
    };

    const applyDrag = (point: Point2D) => {
      const project = useProjectStore.getState().data;
      if (!project) return;
      const handle = dragging.handle;
      if (handle.kind === 'slab-vertex') {
        updateSlabVertex(handle.id, handle.vertexIndex, point);
        return;
      }
      if (handle.kind === 'dimension-start') {
        updateDimension(handle.id, { start: point });
        return;
      }
      if (handle.kind === 'dimension-end') {
        updateDimension(handle.id, { end: point });
        return;
      }
      if (handle.kind === 'annotation-point') {
        updateAnnotation(handle.id, { x: point.x, y: point.y });
        return;
      }
      if (handle.kind === 'annotation-vertex') {
        const annotation = project.annotations.find((item) => item.id === handle.id);
        if (!annotation?.points) return;
        const points = annotation.points.map((item, index) => (index === handle.vertexIndex ? point : item));
        updateAnnotation(handle.id, {
          points,
          ...(handle.vertexIndex === 0 ? { x: point.x, y: point.y } : {}),
        });
        return;
      }
      const member = project.members.find((item) => item.id === handle.id);
      if (!member || member.type === 'slab') return;
      updateMember(handle.id, updateLinearMemberPoint(member, handle.kind, point));
    };

    const excludeId = dragging.handle.id;

    const handleMove = (e: MouseEvent) => {
      const point = toWorld(e);
      if (!point) return;
      const snapped = snapDragPoint(point, excludeId);
      dragPreviewPointRef.current = snapped;
      setDragPreviewPoint(snapped);
    };

    const handleUp = (e: MouseEvent) => {
      const currentPoint = toWorld(e);
      const point = dragPreviewPointRef.current && currentPoint ? snapDragPoint(currentPoint, excludeId) : dragPreviewPointRef.current;
      if (point) applyDrag(point);
      dragPreviewPointRef.current = null;
      setDragPreviewPoint(null);
      setDragging(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, updateAnnotation, updateDimension, updateMember, updateSlabVertex]);

  if (!data || handles.length === 0) return null;

  return (
    <g className="selection-handles">
      {handles.map((handle) => {
        const key = getHandleKey(handle);
        const isDraggingHandle = dragging && getHandleKey(dragging.handle) === key;
        const point = isDraggingHandle && dragPreviewPoint ? dragPreviewPoint : handle.point;
        return (
          <circle
            key={key}
            cx={point.x}
            cy={point.y}
            r={radius}
            fill="#fff"
            stroke="var(--accent)"
            strokeWidth={Math.max(12, 2 / zoom)}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: 'move', pointerEvents: 'all' }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const svg = e.currentTarget.ownerSVGElement;
              if (svg) {
                dragPreviewPointRef.current = null;
                setDragPreviewPoint(null);
                setDragging({ handle, svg });
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        );
      })}
    </g>
  );
}
