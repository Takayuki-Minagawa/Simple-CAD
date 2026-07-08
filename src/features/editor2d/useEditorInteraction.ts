import { useState, useCallback } from 'react';
import { isCreationTool, useProjectStore, useEditorStore } from '@/app/store';
import { collectAllIds } from '@/domain/idGenerator';
import type { EditorTool } from '@/app/store';
import { useI18n } from '@/i18n';
import type { Point2D } from '@/domain/geometry/types';
import {
  findSnap,
  buildSnapCandidatesFromMembers,
  buildSnapCandidatesFromConstructionLines,
} from '@/domain/geometry/snap';
import type { SnapResult, SnapCandidate } from '@/domain/geometry/snap';
import type { ProjectData } from '@/domain/structural/types';
import { snapPointToGrid } from '@/domain/geometry/transform';
import { constrainPointToAngle } from '@/domain/geometry/angleConstraint';
import { getEntityBoundsList, selectByRectangle } from '@/domain/structural/editTransform';
import { getEventCandidateIds, pickSelectionCandidate } from './selectionCycle';
import {
  createBeamMemberFromPoints,
  createColumnMemberAt,
  createConstructionLineFromPoints,
  createDimensionFromPoints,
  createSlabMemberFromPoints,
  createSplineAnnotation,
  createTextAnnotationAt,
  createWallMemberFromPoints,
} from './drawingEntities';
import { showPrompt } from '@/app/browserDialogs';

export interface DrawState {
  /** Points collected so far for multi-click tools */
  points: Point2D[];
  /** Current mouse position (world coords) for preview */
  previewPos: Point2D | null;
  /** Active snap result */
  snapResult: SnapResult | null;
  /** Active angle-constraint step (deg) when polar/ortho/shift is engaged; null otherwise. */
  angleStep?: number | null;
  /** Source member selected for the extend tool. */
  extendMemberId?: string | null;
}

export interface RectSelectState {
  /** Start point in world coords */
  start: Point2D | null;
  /** Current end point in world coords */
  end: Point2D | null;
}

export function createEmptyDrawState(): DrawState {
  return {
    points: [],
    previewPos: null,
    snapResult: null,
    angleStep: null,
    extendMemberId: null,
  };
}

export function hasActiveDrawingState(drawState: DrawState): boolean {
  return drawState.points.length > 0 || Boolean(drawState.extendMemberId);
}

export function canCompleteDrawing(tool: EditorTool, pointCount: number): boolean {
  return (tool === 'slab' && pointCount >= 3) || (tool === 'spline' && pointCount >= 2);
}

function supportsAngleConstraint(tool: EditorTool): boolean {
  return (
    tool === 'beam' ||
    tool === 'wall' ||
    tool === 'slab' ||
    tool === 'dimension' ||
    tool === 'xline' ||
    tool === 'spline'
  );
}

/**
 * Resolve the active angle constraint for the current draw, combining:
 *  - Shift key (legacy 45° rounding),
 *  - ortho mode (90° steps),
 *  - polar tracking (configurable step).
 * Returns the angle step in degrees, or null when no constraint applies.
 */
export function resolveAngleConstraintStep(
  tool: EditorTool,
  points: Point2D[],
  shiftKey: boolean,
  opts: { orthoMode: boolean; polarTrackingEnabled: boolean; polarAngleStep: number },
): number | null {
  if (points.length === 0 || !supportsAngleConstraint(tool)) return null;
  if (shiftKey) return 45;
  if (opts.orthoMode) return 90;
  if (opts.polarTrackingEnabled) return opts.polarAngleStep > 0 ? opts.polarAngleStep : 45;
  return null;
}

function applyAngleConstraint(points: Point2D[], pos: Point2D, stepDegrees = 45): Point2D {
  return constrainPointToAngle(points[points.length - 1], pos, stepDegrees);
}

/**
 * Build the full snap-candidate list (members + grid intersections +
 * construction lines) for the active story. Shared between drawing snap
 * (`getSnapPos`) and edit-handle drag snap so both behave identically.
 *
 * `excludeId` removes a member from the candidates to prevent a dragged
 * handle from snapping onto its own member (self-snap).
 */
export function buildEditorSnapCandidates(
  data: ProjectData,
  activeStory: string | null,
  options: { includeMembers?: boolean; excludeId?: string } = {},
): SnapCandidate[] {
  const { includeMembers = true, excludeId } = options;

  const candidates: SnapCandidate[] = includeMembers
    ? buildSnapCandidatesFromMembers(
        data.members
          .filter((m) => !activeStory || m.story === activeStory)
          .filter((m) => m.id !== excludeId)
          .map((m) => ({
            id: m.id,
            type: m.type,
            start: m.type !== 'slab' ? m.start : undefined,
            end: m.type !== 'slab' ? m.end : undefined,
            polygon: m.type === 'slab' ? m.polygon : undefined,
          })),
      )
    : [];

  // Grid intersections as endpoints.
  for (const gx of data.grids.filter((g) => g.axis === 'X')) {
    for (const gy of data.grids.filter((g) => g.axis === 'Y')) {
      candidates.push({
        id: `${gx.id}-${gy.id}`,
        endpoints: [{ x: gx.position, y: gy.position }],
        midpoints: [],
      });
    }
  }

  // Construction lines (xline / ray) as clipped pseudo-edges.
  const constructionLines = (data.constructionLines ?? []).filter(
    (l) => !activeStory || l.story === activeStory,
  );
  candidates.push(
    ...buildSnapCandidatesFromConstructionLines(
      constructionLines.map((l) => ({
        id: l.id,
        type: l.type,
        origin: l.origin,
        direction: l.direction,
      })),
    ),
  );

  return candidates;
}

function isSelectableId(id: string, layerLocked: Record<string, boolean>): boolean {
  const data = useProjectStore.getState().data;
  if (!data) return true;
  const member = data.members.find((m) => m.id === id);
  if (member) return !layerLocked[`member-${member.type}`];
  if (data.annotations.some((a) => a.id === id)) return !layerLocked.annotation;
  if (data.dimensions.some((d) => d.id === id)) return !layerLocked.dimension;
  return true;
}

export function useEditorInteraction() {
  const [drawState, setDrawState] = useState<DrawState>(createEmptyDrawState);

  const [rectSelect, setRectSelect] = useState<RectSelectState>({
    start: null,
    end: null,
  });

  const getSnapPos = useCallback((worldPos: Point2D): { pos: Point2D; snap: SnapResult | null } => {
    const data = useProjectStore.getState().data;
    const {
      snapEnabled,
      activeSnapModes,
      gridSpacing,
      zoom,
      activeStory,
      activeTool,
      drawInputAssist,
      snapToMembersWhileDrawing,
    } = useEditorStore.getState();

    if (!snapEnabled || !data) return { pos: worldPos, snap: null };

    const useMemberSnaps =
      !drawInputAssist || snapToMembersWhileDrawing || !isCreationTool(activeTool);
    const candidates = buildEditorSnapCandidates(data, activeStory, {
      includeMembers: useMemberSnaps,
    });

    const snap = findSnap(worldPos, candidates, activeSnapModes, gridSpacing, 15, zoom);
    if (snap) return { pos: snap.point, snap };

    // Fall back to grid snap
    const gridPos = snapPointToGrid(worldPos, gridSpacing);
    return { pos: gridPos, snap: null };
  }, []);

  const handleDrawingClick = useCallback((tool: EditorTool, pos: Point2D) => {
    const store = useProjectStore.getState();
    const { activeStory, columnPlacementDirection } = useEditorStore.getState();
    if (!store.data || !activeStory) return;

    const story = store.data.stories.find((s) => s.id === activeStory);
    if (!story) return;

    const usedIds = collectAllIds(store.data);

    switch (tool) {
      case 'column': {
        const member = createColumnMemberAt(
          store.data,
          activeStory,
          columnPlacementDirection,
          pos,
          usedIds,
        );
        if (!member) return;
        store.addMember(member);
        break;
      }

      case 'beam': {
        setDrawState((prev) => {
          const pts = [...prev.points, pos];
          if (pts.length >= 2) {
            const member = createBeamMemberFromPoints(
              store.data!,
              activeStory,
              story,
              [pts[0], pts[1]],
              usedIds,
            );
            store.addMember(member);
            return createEmptyDrawState();
          }
          return { ...prev, points: pts };
        });
        break;
      }

      case 'wall': {
        setDrawState((prev) => {
          const pts = [...prev.points, pos];
          if (pts.length >= 2) {
            const member = createWallMemberFromPoints(
              store.data!,
              activeStory,
              story,
              [pts[0], pts[1]],
              usedIds,
            );
            store.addMember(member);
            return createEmptyDrawState();
          }
          return { ...prev, points: pts };
        });
        break;
      }

      case 'slab': {
        setDrawState((prev) => {
          const pts = [...prev.points, pos];
          return { ...prev, points: pts };
        });
        break;
      }

      case 'dimension': {
        setDrawState((prev) => {
          const pts = [...prev.points, pos];
          if (pts.length >= 2) {
            const dim = createDimensionFromPoints(activeStory, [pts[0], pts[1]], usedIds);
            store.addDimension(dim);
            return createEmptyDrawState();
          }
          return { ...prev, points: pts };
        });
        break;
      }

      case 'annotation': {
        const text = showPrompt(useI18n.getState().t.promptAnnotationText);
        if (!text) break;
        store.addAnnotation(createTextAnnotationAt(activeStory, pos, text, usedIds));
        break;
      }

      case 'xline': {
        setDrawState((prev) => {
          const pts = [...prev.points, pos];
          if (pts.length >= 2) {
            const cl = createConstructionLineFromPoints(activeStory, [pts[0], pts[1]], usedIds);
            if (cl) {
              store.addConstructionLine(cl);
            }
            return createEmptyDrawState();
          }
          return { ...prev, points: pts };
        });
        break;
      }

      case 'spline': {
        setDrawState((prev) => {
          const pts = [...prev.points, pos];
          return { ...prev, points: pts };
        });
        break;
      }
    }
  }, []);

  const handleClick = useCallback(
    (worldPos: Point2D, e: React.MouseEvent) => {
      const { activeTool, setSelectedIds, toggleSelection, layerLocked } =
        useEditorStore.getState();

      if (activeTool === 'select') {
        const candidateIds = getEventCandidateIds(e).filter((id) =>
          isSelectableId(id, layerLocked),
        );
        const useCycle = !(e.shiftKey || e.ctrlKey || e.metaKey);
        const id = useCycle
          ? pickSelectionCandidate(candidateIds, useEditorStore.getState().selectedIds)
          : (candidateIds[0] ?? null);
        if (!id) {
          setSelectedIds([]);
          return;
        }
        const data = useProjectStore.getState().data;

        // Group selection: if member belongs to a group, select all group members
        if (data) {
          const memberForGroup = data.members.find((m) => m.id === id);
          if (memberForGroup && data.groups && !(e.shiftKey || e.ctrlKey || e.metaKey)) {
            const group = data.groups.find((g) => g.memberIds.includes(id));
            if (group) {
              setSelectedIds(
                group.memberIds.filter((mid) => data.members.some((m) => m.id === mid)),
              );
              return;
            }
          }
        }

        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          toggleSelection(id);
        } else {
          setSelectedIds([id]);
        }
        return;
      }

      // Trim tool: click on a member to trim it at nearest intersection
      if (activeTool === 'trim') {
        const target = (e.target as SVGElement).closest('[data-id]');
        if (!target) return;
        const id = target.getAttribute('data-id')!;
        const store = useProjectStore.getState();
        if (!store.data) return;
        const member = store.data.members.find((m) => m.id === id);
        if (!member || member.type === 'slab') return;
        // Determine which side to keep based on click proximity to start/end
        const distToStart = Math.hypot(worldPos.x - member.start.x, worldPos.y - member.start.y);
        const distToEnd = Math.hypot(worldPos.x - member.end.x, worldPos.y - member.end.y);
        const side = distToEnd < distToStart ? 'start' : 'end';
        store.trimMember(id, worldPos, side);
        return;
      }

      // Extend tool: first click selects member, second click selects target
      if (activeTool === 'extend') {
        const target = (e.target as SVGElement).closest('[data-id]');
        if (!target) return;
        const id = target.getAttribute('data-id')!;
        setDrawState((prev) => {
          if (!prev.extendMemberId) {
            return { ...prev, extendMemberId: id, previewPos: null, snapResult: null };
          }
          useProjectStore.getState().extendMember(prev.extendMemberId, id);
          return createEmptyDrawState();
        });
        return;
      }

      const { orthoMode, polarTrackingEnabled, polarAngleStep } = useEditorStore.getState();
      const angleStep = resolveAngleConstraintStep(activeTool, drawState.points, e.shiftKey, {
        orthoMode,
        polarTrackingEnabled,
        polarAngleStep,
      });
      const { pos } = angleStep != null ? { pos: worldPos } : getSnapPos(worldPos);
      const drawPos =
        angleStep != null ? applyAngleConstraint(drawState.points, pos, angleStep) : pos;
      handleDrawingClick(activeTool, drawPos);
    },
    [drawState.points, getSnapPos, handleDrawingClick],
  );

  const completeDrawing = useCallback(() => {
    const { activeTool } = useEditorStore.getState();
    // Close slab polygon on double-click or Enter
    if (activeTool === 'slab') {
      setDrawState((prev) => {
        if (!canCompleteDrawing(activeTool, prev.points.length)) return prev;
        const store = useProjectStore.getState();
        const { activeStory } = useEditorStore.getState();
        if (!store.data || !activeStory) return prev;
        const story = store.data.stories.find((s) => s.id === activeStory);
        if (!story) return prev;

        const usedIds = collectAllIds(store.data);
        const member = createSlabMemberFromPoints(
          store.data,
          activeStory,
          story,
          prev.points,
          usedIds,
        );
        store.addMember(member);
        return createEmptyDrawState();
      });
    }

    // Close spline on double-click or Enter
    if (activeTool === 'spline') {
      setDrawState((prev) => {
        if (!canCompleteDrawing(activeTool, prev.points.length)) return prev;
        const store = useProjectStore.getState();
        const { activeStory } = useEditorStore.getState();
        if (!store.data || !activeStory) return prev;

        store.addAnnotation(
          createSplineAnnotation(activeStory, prev.points, collectAllIds(store.data)),
        );
        return createEmptyDrawState();
      });
    }
  }, []);

  const handleDoubleClick = useCallback(() => {
    completeDrawing();
  }, [completeDrawing]);

  const handleMouseMove = useCallback(
    (worldPos: Point2D, e: React.MouseEvent) => {
      const { activeTool, orthoMode, polarTrackingEnabled, polarAngleStep } =
        useEditorStore.getState();
      setDrawState((prev) => {
        const angleStep = resolveAngleConstraintStep(activeTool, prev.points, e.shiftKey, {
          orthoMode,
          polarTrackingEnabled,
          polarAngleStep,
        });
        const { pos, snap } =
          angleStep != null ? { pos: worldPos, snap: null } : getSnapPos(worldPos);
        const previewPos =
          angleStep != null ? applyAngleConstraint(prev.points, pos, angleStep) : pos;
        // Publish live draw context for the status bar (anchor / snap).
        const editor = useEditorStore.getState();
        editor.setDrawAnchor(prev.points.length > 0 ? prev.points[prev.points.length - 1] : null);
        editor.setActiveSnapPoint(snap ? snap.point : null);
        return {
          ...prev,
          previewPos,
          snapResult: snap,
          angleStep,
        };
      });
      // Update rect select end if dragging
      setRectSelect((prev) => {
        if (prev.start) {
          return { ...prev, end: worldPos };
        }
        return prev;
      });
    },
    [getSnapPos],
  );

  const handleMouseDown = useCallback((worldPos: Point2D, e: React.MouseEvent) => {
    const { activeTool } = useEditorStore.getState();
    if (activeTool === 'select' && e.button === 0) {
      // Start rect select only if clicking on empty area (not on an entity)
      const target = (e.target as SVGElement).closest('[data-id]');
      if (!target) {
        setRectSelect({ start: worldPos, end: worldPos });
      }
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setRectSelect((prev) => {
      if (prev.start && prev.end) {
        const minX = Math.min(prev.start.x, prev.end.x);
        const maxX = Math.max(prev.start.x, prev.end.x);
        const minY = Math.min(prev.start.y, prev.end.y);
        const maxY = Math.max(prev.start.y, prev.end.y);
        const width = maxX - minX;
        const height = maxY - minY;

        // Only process if drag was big enough (avoid accidental micro-drags)
        if (width > 50 || height > 50) {
          const data = useProjectStore.getState().data;
          const { activeStory } = useEditorStore.getState();
          if (data) {
            const entities = getEntityBoundsList(data, activeStory);
            // left-to-right = window, right-to-left = crossing
            const mode = prev.end.x >= prev.start.x ? 'window' : 'crossing';
            const ids = selectByRectangle(entities, minX, minY, maxX, maxY, mode);
            useEditorStore.getState().setSelectedIds(ids);
          }
        }
      }
      return { start: null, end: null };
    });
  }, []);

  /** Inject a coordinate point as if user clicked at that position. */
  const injectCoordinate = useCallback(
    (pos: Point2D) => {
      const { activeTool } = useEditorStore.getState();
      if (isCreationTool(activeTool)) {
        handleDrawingClick(activeTool, pos);
      }
    },
    [handleDrawingClick],
  );

  const resetDrawing = useCallback(() => {
    setDrawState(createEmptyDrawState());
    const editor = useEditorStore.getState();
    editor.setDrawAnchor(null);
    editor.setActiveSnapPoint(null);
  }, []);

  return {
    drawState,
    rectSelect,
    handleClick,
    handleDoubleClick,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    injectCoordinate,
    completeDrawing,
    resetDrawing,
  };
}
