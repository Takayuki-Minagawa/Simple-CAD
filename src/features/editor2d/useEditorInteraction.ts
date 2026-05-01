import { useState, useCallback } from 'react';
import { useProjectStore, useEditorStore } from '@/app/store';
import { collectAllIds, generateId } from '@/domain/idGenerator';
import type { EditorTool } from '@/app/store';
import { useI18n } from '@/i18n';
import type { Annotation, Dimension, ColumnMember, BeamMember, WallMember, SlabMember, ConstructionLine } from '@/domain/structural/types';
import { getColumnVerticalSpan } from '@/domain/structural/placement';
import type { Point2D } from '@/domain/geometry/types';
import { findSnap, buildSnapCandidatesFromMembers } from '@/domain/geometry/snap';
import type { SnapResult } from '@/domain/geometry/snap';
import { snapPointToGrid } from '@/domain/geometry/transform';
import { getEntityBoundsList, selectByRectangle } from '@/domain/structural/editTransform';

export interface DrawState {
  /** Points collected so far for multi-click tools */
  points: Point2D[];
  /** Current mouse position (world coords) for preview */
  previewPos: Point2D | null;
  /** Active snap result */
  snapResult: SnapResult | null;
}

export interface RectSelectState {
  /** Start point in world coords */
  start: Point2D | null;
  /** Current end point in world coords */
  end: Point2D | null;
}

function isCreationTool(tool: EditorTool): boolean {
  return tool !== 'select' && tool !== 'pan' && tool !== 'trim' && tool !== 'extend';
}

export function useEditorInteraction() {
  const [drawState, setDrawState] = useState<DrawState>({
    points: [],
    previewPos: null,
    snapResult: null,
  });

  const [rectSelect, setRectSelect] = useState<RectSelectState>({
    start: null,
    end: null,
  });

  const getSnapPos = useCallback(
    (worldPos: Point2D): { pos: Point2D; snap: SnapResult | null } => {
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
      } =
        useEditorStore.getState();

      if (!snapEnabled || !data) return { pos: worldPos, snap: null };

      const useMemberSnaps =
        !drawInputAssist || snapToMembersWhileDrawing || !isCreationTool(activeTool);
      const candidates = useMemberSnaps
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
      // Also add grid intersections as endpoints
      for (const gx of data.grids.filter((g) => g.axis === 'X')) {
        for (const gy of data.grids.filter((g) => g.axis === 'Y')) {
          candidates.push({
            id: `${gx.id}-${gy.id}`,
            endpoints: [{ x: gx.position, y: gy.position }],
            midpoints: [],
          });
        }
      }

      const snap = findSnap(worldPos, candidates, activeSnapModes, gridSpacing, 15, zoom);
      if (snap) return { pos: snap.point, snap };

      // Fall back to grid snap
      const gridPos = snapPointToGrid(worldPos, gridSpacing);
      return { pos: gridPos, snap: null };
    },
    [],
  );

  const handleDrawingClick = useCallback(
    (tool: EditorTool, pos: Point2D) => {
      const store = useProjectStore.getState();
      const { activeStory, columnPlacementDirection } = useEditorStore.getState();
      if (!store.data || !activeStory) return;

      const story = store.data.stories.find((s) => s.id === activeStory);
      if (!story) return;

      const usedIds = collectAllIds(store.data);

      const defaultSection = (type: string) => {
        const map: Record<string, string> = {
          column: 'rc_column_rect',
          beam: 'rc_beam_rect',
          wall: 'rc_wall',
          slab: 'rc_slab',
        };
        return store.data!.sections.find((s) => s.kind === map[type])?.id ?? store.data!.sections[0]?.id ?? '';
      };

      const defaultMaterial = store.data.materials[0]?.id ?? '';

      switch (tool) {
        case 'column': {
          const span = getColumnVerticalSpan(
            store.data.stories,
            activeStory,
            columnPlacementDirection,
          );
          if (!span) return;

          const member: ColumnMember = {
            id: generateId('col', usedIds),
            type: 'column',
            story: activeStory,
            sectionId: defaultSection('column'),
            materialId: defaultMaterial,
            start: { x: pos.x, y: pos.y, z: span.startZ },
            end: { x: pos.x, y: pos.y, z: span.endZ },
            rotation: 0,
          };
          store.addMember(member);
          break;
        }

        case 'beam': {
          setDrawState((prev) => {
            const pts = [...prev.points, pos];
            if (pts.length >= 2) {
              const member: BeamMember = {
                id: generateId('beam', usedIds),
                type: 'beam',
                story: activeStory,
                sectionId: defaultSection('beam'),
                materialId: defaultMaterial,
                start: { x: pts[0].x, y: pts[0].y, z: story.elevation + story.height },
                end: { x: pts[1].x, y: pts[1].y, z: story.elevation + story.height },
                rotation: 0,
              };
              store.addMember(member);
              return { points: [], previewPos: null, snapResult: null };
            }
            return { ...prev, points: pts };
          });
          break;
        }

        case 'wall': {
          setDrawState((prev) => {
            const pts = [...prev.points, pos];
            if (pts.length >= 2) {
              const sec = store.data!.sections.find((s) => s.id === defaultSection('wall'));
              const thickness = sec && 'thickness' in sec ? sec.thickness : 200;
              const member: WallMember = {
                id: generateId('wall', usedIds),
                type: 'wall',
                story: activeStory,
                sectionId: defaultSection('wall'),
                materialId: defaultMaterial,
                start: { x: pts[0].x, y: pts[0].y, z: story.elevation },
                end: { x: pts[1].x, y: pts[1].y, z: story.elevation },
                height: story.height,
                thickness,
                rotation: 0,
              };
              store.addMember(member);
              return { points: [], previewPos: null, snapResult: null };
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
              const dim: Dimension = {
                id: generateId('dim', usedIds),
                story: activeStory,
                start: { x: pts[0].x, y: pts[0].y },
                end: { x: pts[1].x, y: pts[1].y },
                offset: -1000,
              };
              store.addDimension(dim);
              return { points: [], previewPos: null, snapResult: null };
            }
            return { ...prev, points: pts };
          });
          break;
        }

        case 'annotation': {
          const text = prompt(useI18n.getState().t.promptAnnotationText);
          if (!text) break;
          const ann: Annotation = {
            id: generateId('ann', usedIds),
            type: 'text',
            story: activeStory,
            x: pos.x,
            y: pos.y,
            text,
          };
          store.addAnnotation(ann);
          break;
        }

        case 'xline': {
          setDrawState((prev) => {
            const pts = [...prev.points, pos];
            if (pts.length >= 2) {
              const dx = pts[1].x - pts[0].x;
              const dy = pts[1].y - pts[0].y;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len > 0) {
                const cl: ConstructionLine = {
                  id: generateId('xl', usedIds),
                  story: activeStory,
                  type: 'xline',
                  origin: { x: pts[0].x, y: pts[0].y },
                  direction: { x: dx / len, y: dy / len },
                };
                store.addConstructionLine(cl);
              }
              return { points: [], previewPos: null, snapResult: null };
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
    },
    [],
  );

  const handleClick = useCallback(
    (worldPos: Point2D, e: React.MouseEvent) => {
      const { activeTool, setSelectedIds, toggleSelection, layerLocked } = useEditorStore.getState();

      if (activeTool === 'select') {
        const target = (e.target as SVGElement).closest('[data-id]');
        if (!target) {
          setSelectedIds([]);
          return;
        }
        const id = target.getAttribute('data-id')!;

        // Check if entity's layer is locked
        const data = useProjectStore.getState().data;
        if (data) {
          const member = data.members.find((m) => m.id === id);
          if (member && layerLocked[`member-${member.type}`]) return;
          const annotation = data.annotations.find((a) => a.id === id);
          if (annotation && layerLocked['annotation']) return;
          const dimension = data.dimensions.find((d) => d.id === id);
          if (dimension && layerLocked['dimension']) return;
        }

        // Group selection: if member belongs to a group, select all group members
        if (data) {
          const memberForGroup = data.members.find((m) => m.id === id);
          if (memberForGroup && data.groups && !(e.shiftKey || e.ctrlKey || e.metaKey)) {
            const group = data.groups.find((g) => g.memberIds.includes(id));
            if (group) {
              setSelectedIds(group.memberIds.filter((mid) => data.members.some((m) => m.id === mid)));
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
          if (prev.points.length === 0) {
            // First click: store the member to extend (abuse points array for state)
            return { ...prev, points: [{ x: 0, y: 0 }], previewPos: null, snapResult: null, _extendMemberId: id } as DrawState & { _extendMemberId: string };
          } else {
            // Second click: extend the stored member to the clicked target
            const storedId = (prev as DrawState & { _extendMemberId?: string })._extendMemberId;
            if (storedId) {
              useProjectStore.getState().extendMember(storedId, id);
            }
            return { points: [], previewPos: null, snapResult: null };
          }
        });
        return;
      }

      const { pos } = getSnapPos(worldPos);
      handleDrawingClick(activeTool, pos);
    },
    [getSnapPos, handleDrawingClick],
  );

  const handleDoubleClick = useCallback(
    () => {
      const { activeTool } = useEditorStore.getState();
      // Close slab polygon on double-click
      if (activeTool === 'slab') {
        setDrawState((prev) => {
          if (prev.points.length < 3) return prev;
          const store = useProjectStore.getState();
          const { activeStory } = useEditorStore.getState();
          if (!store.data || !activeStory) return prev;
          const story = store.data.stories.find((s) => s.id === activeStory);
          if (!story) return prev;

          const usedIds = collectAllIds(store.data);
          const defaultSection = store.data.sections.find((s) => s.kind === 'rc_slab')?.id ?? store.data.sections[0]?.id ?? '';
          const member: SlabMember = {
            id: generateId('slab', usedIds),
            type: 'slab',
            story: activeStory,
            sectionId: defaultSection,
            materialId: store.data.materials[0]?.id ?? '',
            polygon: prev.points.map((p) => ({ x: p.x, y: p.y })),
            level: story.elevation + story.height,
          };
          store.addMember(member);
          return { points: [], previewPos: null, snapResult: null };
        });
      }

      // Close spline on double-click
      if (activeTool === 'spline') {
        setDrawState((prev) => {
          if (prev.points.length < 2) return prev;
          const store = useProjectStore.getState();
          const { activeStory } = useEditorStore.getState();
          if (!store.data || !activeStory) return prev;

          const usedIds2 = collectAllIds(store.data);
          const ann: Annotation = {
            id: generateId('spl', usedIds2),
            type: 'spline',
            story: activeStory,
            x: prev.points[0].x,
            y: prev.points[0].y,
            text: '',
            points: prev.points.map((p) => ({ x: p.x, y: p.y })),
          };
          store.addAnnotation(ann);
          return { points: [], previewPos: null, snapResult: null };
        });
      }
    },
    [],
  );

  const handleMouseMove = useCallback(
    (worldPos: Point2D) => {
      const { pos, snap } = getSnapPos(worldPos);
      setDrawState((prev) => ({
        ...prev,
        previewPos: pos,
        snapResult: snap,
      }));
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

  const handleMouseDown = useCallback(
    (worldPos: Point2D, e: React.MouseEvent) => {
      const { activeTool } = useEditorStore.getState();
      if (activeTool === 'select' && e.button === 0) {
        // Start rect select only if clicking on empty area (not on an entity)
        const target = (e.target as SVGElement).closest('[data-id]');
        if (!target) {
          setRectSelect({ start: worldPos, end: worldPos });
        }
      }
    },
    [],
  );

  const handleMouseUp = useCallback(
    () => {
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
    },
    [],
  );

  /** Inject a coordinate point as if user clicked at that position. */
  const injectCoordinate = useCallback(
    (pos: Point2D) => {
      const { activeTool } = useEditorStore.getState();
      if (activeTool !== 'select' && activeTool !== 'pan') {
        handleDrawingClick(activeTool, pos);
      }
    },
    [handleDrawingClick],
  );

  const resetDrawing = useCallback(() => {
    setDrawState({ points: [], previewPos: null, snapResult: null });
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
    resetDrawing,
  };
}
