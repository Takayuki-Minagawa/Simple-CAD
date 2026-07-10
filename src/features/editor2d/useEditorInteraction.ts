import { useState, useCallback, useEffect, useRef } from 'react';
import { isCreationTool, useProjectStore, useEditorStore } from '@/app/store';
import { collectAllIds } from '@/domain/idGenerator';
import type { EditorTool, LayerName } from '@/app/store';
import { useI18n } from '@/i18n';
import type { Point2D } from '@/domain/geometry/types';
import {
  findSnap,
  buildSnapCandidatesFromMembers,
  buildSnapCandidatesFromConstructionLines,
} from '@/domain/geometry/snap';
import type { SnapResult, SnapCandidate } from '@/domain/geometry/snap';
import type { ProjectData } from '@/domain/structural/types';
import { constrainPointToAngle } from '@/domain/geometry/angleConstraint';
import { getEntityBoundsList, selectByRectangle } from '@/domain/structural/editTransform';
import { getEventCandidateIds, pickSelectionCandidate } from './selectionCycle';
import {
  createBeamMemberFromPoints,
  createColumnMemberAt,
  createConstructionLineFromPoints,
  createDimensionFromPoints,
  createOpeningAt,
  createSlabMemberFromPoints,
  createSplineAnnotation,
  createTextAnnotationAt,
  createWallMemberFromPoints,
} from './drawingEntities';
import { showPrompt } from '@/app/browserDialogs';
import { isEntityLayerInteractive } from '@/domain/rendering/layerLock';

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
  /** First wall selected for the fillet tool. */
  filletWallId?: string | null;
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
    filletWallId: null,
  };
}

export function hasActiveDrawingState(drawState: DrawState): boolean {
  return (
    drawState.points.length > 0 ||
    Boolean(drawState.extendMemberId) ||
    Boolean(drawState.filletWallId)
  );
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
  options: {
    includeMembers?: boolean;
    includeGrid?: boolean;
    excludeId?: string;
    excludeIds?: Iterable<string>;
  } = {},
): SnapCandidate[] {
  const { includeMembers = true, includeGrid = true, excludeId, excludeIds } = options;
  const excluded = new Set(excludeIds ?? []);
  if (excludeId) excluded.add(excludeId);

  const cacheKey = `${activeStory ?? '*'}:${includeMembers ? 'members' : 'no-members'}:${
    includeGrid ? 'grid' : 'no-grid'
  }`;
  let projectCache = snapCandidateCache.get(data);
  if (!projectCache) {
    projectCache = new Map();
    snapCandidateCache.set(data, projectCache);
  }
  const cached = projectCache.get(cacheKey);
  if (cached) {
    return excluded.size > 0
      ? cached.filter((candidate) => !excluded.has(candidate.id))
      : cached;
  }

  const candidates: SnapCandidate[] = includeMembers
    ? buildSnapCandidatesFromMembers(
        data.members
          .filter((m) => !activeStory || m.story === activeStory)
          .map((m) => ({
            id: m.id,
            type: m.type,
            start: m.type !== 'slab' ? m.start : undefined,
            end: m.type !== 'slab' ? m.end : undefined,
            polygon: m.type === 'slab' ? m.polygon : undefined,
          })),
      )
    : [];

  // Grid intersections participate only when the grid snap mode is enabled.
  if (includeGrid) {
    for (const gx of data.grids.filter((g) => g.axis === 'X')) {
      for (const gy of data.grids.filter((g) => g.axis === 'Y')) {
        candidates.push({
          id: `${gx.id}-${gy.id}`,
          endpoints: [{ x: gx.position, y: gy.position }],
          midpoints: [],
        });
      }
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

  projectCache.set(cacheKey, candidates);
  return excluded.size > 0
    ? candidates.filter((candidate) => !excluded.has(candidate.id))
    : candidates;
}

const snapCandidateCache = new WeakMap<ProjectData, Map<string, SnapCandidate[]>>();

function isSelectableId(
  id: string,
  layerLocked: Record<LayerName, boolean>,
  layerVisibility: Record<LayerName, boolean>,
): boolean {
  const data = useProjectStore.getState().data;
  if (!data) return true;
  return isEntityLayerInteractive(data, id, layerLocked, layerVisibility);
}

export function useEditorInteraction() {
  const [drawState, setDrawState] = useState<DrawState>(createEmptyDrawState);
  const drawStateRef = useRef<DrawState>(drawState);

  const [rectSelect, setRectSelect] = useState<RectSelectState>({
    start: null,
    end: null,
  });
  const rectSelectRef = useRef<RectSelectState>(rectSelect);

  const commitDrawState = useCallback((next: DrawState) => {
    drawStateRef.current = next;
    setDrawState(next);
  }, []);

  const commitRectSelect = useCallback((next: RectSelectState) => {
    rectSelectRef.current = next;
    setRectSelect(next);
  }, []);

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
      includeGrid: activeSnapModes.includes('grid'),
    });

    const snap = findSnap(worldPos, candidates, activeSnapModes, gridSpacing, 15, zoom);
    if (snap) return { pos: snap.point, snap };

    return { pos: worldPos, snap: null };
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
        const previous = drawStateRef.current;
        const pts = [...previous.points, pos];
        if (pts.length >= 2) {
          const member = createBeamMemberFromPoints(
            store.data,
            activeStory,
            story,
            [pts[0], pts[1]],
            usedIds,
          );
          store.addMember(member);
          commitDrawState(createEmptyDrawState());
        } else {
          commitDrawState({ ...previous, points: pts });
        }
        break;
      }

      case 'wall': {
        const previous = drawStateRef.current;
        const pts = [...previous.points, pos];
        if (pts.length >= 2) {
          const member = createWallMemberFromPoints(
            store.data,
            activeStory,
            story,
            [pts[0], pts[1]],
            usedIds,
          );
          store.addMember(member);
          commitDrawState(createEmptyDrawState());
        } else {
          commitDrawState({ ...previous, points: pts });
        }
        break;
      }

      case 'slab': {
        const previous = drawStateRef.current;
        commitDrawState({ ...previous, points: [...previous.points, pos] });
        break;
      }

      case 'dimension': {
        const previous = drawStateRef.current;
        const pts = [...previous.points, pos];
        if (pts.length >= 2) {
          const dim = createDimensionFromPoints(activeStory, [pts[0], pts[1]], usedIds);
          store.addDimension(dim);
          commitDrawState(createEmptyDrawState());
        } else {
          commitDrawState({ ...previous, points: pts });
        }
        break;
      }

      case 'annotation': {
        const text = showPrompt(useI18n.getState().t.promptAnnotationText);
        if (!text) break;
        store.addAnnotation(createTextAnnotationAt(activeStory, pos, text, usedIds));
        break;
      }

      case 'xline': {
        const previous = drawStateRef.current;
        const pts = [...previous.points, pos];
        if (pts.length >= 2) {
          const cl = createConstructionLineFromPoints(activeStory, [pts[0], pts[1]], usedIds);
          if (cl) store.addConstructionLine(cl);
          commitDrawState(createEmptyDrawState());
        } else {
          commitDrawState({ ...previous, points: pts });
        }
        break;
      }

      case 'spline': {
        const previous = drawStateRef.current;
        commitDrawState({ ...previous, points: [...previous.points, pos] });
        break;
      }
    }
  }, [commitDrawState]);

  const handleClick = useCallback(
    (worldPos: Point2D, e: React.MouseEvent) => {
      const { activeTool, setSelectedIds, toggleSelection, layerLocked, layerVisibility } =
        useEditorStore.getState();

      if (activeTool === 'select') {
        const candidateIds = getEventCandidateIds(e).filter((id) =>
          isSelectableId(id, layerLocked, layerVisibility),
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
                group.memberIds.filter(
                  (mid) =>
                    data.members.some((m) => m.id === mid) &&
                    isSelectableId(mid, layerLocked, layerVisibility),
                ),
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

      // Opening tool: place a default opening on the clicked wall or slab.
      if (activeTool === 'opening') {
        const target = (e.target as SVGElement).closest('[data-id]');
        const memberId = target?.getAttribute('data-id');
        if (!memberId) return;
        const store = useProjectStore.getState();
        if (!store.data) return;
        const editor = useEditorStore.getState();
        if (
          editor.layerLocked.opening ||
          editor.layerVisibility.opening === false ||
          !isSelectableId(memberId, editor.layerLocked, editor.layerVisibility)
        ) return;
        const member = store.data.members.find((item) => item.id === memberId);
        if (!member) return;
        const opening = createOpeningAt(member, worldPos, collectAllIds(store.data));
        if (opening) store.addOpening(opening);
        return;
      }

      // Trim tool: click on a member to trim it at nearest intersection
      if (activeTool === 'trim') {
        const target = (e.target as SVGElement).closest('[data-id]');
        if (!target) return;
        const id = target.getAttribute('data-id')!;
        const store = useProjectStore.getState();
        if (!store.data) return;
        const editor = useEditorStore.getState();
        if (!isSelectableId(id, editor.layerLocked, editor.layerVisibility)) return;
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
        const previous = drawStateRef.current;
        const editor = useEditorStore.getState();
        if (!isSelectableId(id, editor.layerLocked, editor.layerVisibility)) return;
        if (
          previous.extendMemberId &&
          !isSelectableId(
            previous.extendMemberId,
            editor.layerLocked,
            editor.layerVisibility,
          )
        ) {
          commitDrawState(createEmptyDrawState());
          return;
        }
        if (!previous.extendMemberId) {
          commitDrawState({
            ...previous,
            extendMemberId: id,
            previewPos: null,
            snapResult: null,
          });
        } else {
          useProjectStore.getState().extendMember(previous.extendMemberId, id);
          commitDrawState(createEmptyDrawState());
        }
        return;
      }

      if (activeTool === 'fillet') {
        const target = (e.target as SVGElement).closest('[data-id]');
        const id = target?.getAttribute('data-id');
        if (!id) return;
        const editor = useEditorStore.getState();
        if (!isSelectableId(id, editor.layerLocked, editor.layerVisibility)) return;
        const wall = useProjectStore
          .getState()
          .data?.members.find((member) => member.id === id && member.type === 'wall');
        if (!wall) return;
        const previous = drawStateRef.current;
        if (
          previous.filletWallId &&
          !isSelectableId(
            previous.filletWallId,
            editor.layerLocked,
            editor.layerVisibility,
          )
        ) {
          commitDrawState(createEmptyDrawState());
          return;
        }
        if (!previous.filletWallId) {
          commitDrawState({ ...previous, filletWallId: id });
        } else {
          useProjectStore.getState().filletWalls(previous.filletWallId, id);
          commitDrawState(createEmptyDrawState());
        }
        return;
      }

      const { orthoMode, polarTrackingEnabled, polarAngleStep } = useEditorStore.getState();
      const current = drawStateRef.current;
      const angleStep = resolveAngleConstraintStep(activeTool, current.points, e.shiftKey, {
        orthoMode,
        polarTrackingEnabled,
        polarAngleStep,
      });
      const { pos, snap } = getSnapPos(worldPos);
      const drawPos =
        angleStep != null && !snap ? applyAngleConstraint(current.points, pos, angleStep) : pos;
      handleDrawingClick(activeTool, drawPos);
    },
    [commitDrawState, getSnapPos, handleDrawingClick],
  );

  const completeDrawing = useCallback(() => {
    const { activeTool } = useEditorStore.getState();
    const previous = drawStateRef.current;
    // Close slab polygon on double-click or Enter
    if (activeTool === 'slab') {
      if (!canCompleteDrawing(activeTool, previous.points.length)) return;
      const store = useProjectStore.getState();
      const { activeStory } = useEditorStore.getState();
      if (!store.data || !activeStory) return;
      const story = store.data.stories.find((item) => item.id === activeStory);
      if (!story) return;
      const member = createSlabMemberFromPoints(
        store.data,
        activeStory,
        story,
        previous.points,
        collectAllIds(store.data),
      );
      store.addMember(member);
      commitDrawState(createEmptyDrawState());
      return;
    }

    // Close spline on double-click or Enter
    if (activeTool === 'spline') {
      if (!canCompleteDrawing(activeTool, previous.points.length)) return;
      const store = useProjectStore.getState();
      const { activeStory } = useEditorStore.getState();
      if (!store.data || !activeStory) return;
      store.addAnnotation(
        createSplineAnnotation(activeStory, previous.points, collectAllIds(store.data)),
      );
      commitDrawState(createEmptyDrawState());
    }
  }, [commitDrawState]);

  const handleDoubleClick = useCallback(() => {
    completeDrawing();
  }, [completeDrawing]);

  const handleMouseMove = useCallback(
    (worldPos: Point2D, e: React.MouseEvent) => {
      const { activeTool, orthoMode, polarTrackingEnabled, polarAngleStep } =
        useEditorStore.getState();
      const previous = drawStateRef.current;
      const angleStep = resolveAngleConstraintStep(activeTool, previous.points, e.shiftKey, {
        orthoMode,
        polarTrackingEnabled,
        polarAngleStep,
      });
      const { pos, snap } = getSnapPos(worldPos);
      const previewPos =
        angleStep != null && !snap
          ? applyAngleConstraint(previous.points, pos, angleStep)
          : pos;
      const editor = useEditorStore.getState();
      editor.setDrawAnchor(
        previous.points.length > 0 ? previous.points[previous.points.length - 1] : null,
      );
      editor.setActiveSnapPoint(snap ? snap.point : null);
      commitDrawState({ ...previous, previewPos, snapResult: snap, angleStep });
      // Update rect select end if dragging
      const rectangle = rectSelectRef.current;
      if (rectangle.start) commitRectSelect({ ...rectangle, end: worldPos });
    },
    [commitDrawState, commitRectSelect, getSnapPos],
  );

  const handleMouseDown = useCallback((worldPos: Point2D, e: React.MouseEvent) => {
    const { activeTool } = useEditorStore.getState();
    if (activeTool === 'select' && e.button === 0) {
      // Start rect select only if clicking on empty area (not on an entity)
      const target = (e.target as SVGElement).closest('[data-id]');
      if (!target) {
        commitRectSelect({ start: worldPos, end: worldPos });
      }
    }
  }, [commitRectSelect]);

  const handleMouseUp = useCallback(() => {
    const previous = rectSelectRef.current;
    if (previous.start && previous.end) {
        const minX = Math.min(previous.start.x, previous.end.x);
        const maxX = Math.max(previous.start.x, previous.end.x);
        const minY = Math.min(previous.start.y, previous.end.y);
        const maxY = Math.max(previous.start.y, previous.end.y);
        const width = maxX - minX;
        const height = maxY - minY;

        // Only process if drag was big enough (avoid accidental micro-drags)
        if (width > 50 || height > 50) {
          const data = useProjectStore.getState().data;
          const { activeStory } = useEditorStore.getState();
          if (data) {
            const entities = getEntityBoundsList(data, activeStory);
            for (const opening of data.openings) {
              const host = data.members.find((member) => member.id === opening.memberId);
              if (!host || (activeStory && host.story !== activeStory)) continue;
              entities.push({
                id: opening.id,
                minX: opening.position.x - opening.width / 2,
                minY: opening.position.y - opening.width / 2,
                maxX: opening.position.x + opening.width / 2,
                maxY: opening.position.y + opening.width / 2,
              });
            }
            // left-to-right = window, right-to-left = crossing
            const mode = previous.end.x >= previous.start.x ? 'window' : 'crossing';
            const ids = selectByRectangle(entities, minX, minY, maxX, maxY, mode);
            const editor = useEditorStore.getState();
            editor.setSelectedIds(
              ids.filter((id) =>
                isSelectableId(id, editor.layerLocked, editor.layerVisibility),
              ),
            );
          }
        }
      }
    commitRectSelect({ start: null, end: null });
  }, [commitRectSelect]);

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
    commitDrawState(createEmptyDrawState());
    const editor = useEditorStore.getState();
    editor.setDrawAnchor(null);
    editor.setActiveSnapPoint(null);
  }, [commitDrawState]);

  useEffect(
    () =>
      useEditorStore.subscribe((state, previous) => {
        if (state.activeStory === previous.activeStory) return;
        resetDrawing();
        commitRectSelect({ start: null, end: null });
      }),
    [commitRectSelect, resetDrawing],
  );

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
