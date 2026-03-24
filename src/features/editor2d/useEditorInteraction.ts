import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useProjectStore, useEditorStore } from '@/app/store';
import type { EditorTool } from '@/app/store';
import { useI18n } from '@/i18n';
import type { Annotation, Dimension, ColumnMember, BeamMember, WallMember, SlabMember } from '@/domain/structural/types';
import type { Point2D } from '@/domain/geometry/types';
import { findSnap, buildSnapCandidatesFromMembers } from '@/domain/geometry/snap';
import type { SnapResult } from '@/domain/geometry/snap';
import { snapPointToGrid } from '@/domain/geometry/transform';

export interface DrawState {
  /** Points collected so far for multi-click tools */
  points: Point2D[];
  /** Current mouse position (world coords) for preview */
  previewPos: Point2D | null;
  /** Active snap result */
  snapResult: SnapResult | null;
}

export function useEditorInteraction() {
  const [drawState, setDrawState] = useState<DrawState>({
    points: [],
    previewPos: null,
    snapResult: null,
  });

  const getSnapPos = useCallback(
    (worldPos: Point2D): { pos: Point2D; snap: SnapResult | null } => {
      const data = useProjectStore.getState().data;
      const { snapEnabled, activeSnapModes, gridSpacing, zoom, activeStory } =
        useEditorStore.getState();

      if (!snapEnabled || !data) return { pos: worldPos, snap: null };

      const members = data.members
        .filter((m) => !activeStory || m.story === activeStory)
        .map((m) => ({
          id: m.id,
          type: m.type,
          start: m.type !== 'slab' ? m.start : undefined,
          end: m.type !== 'slab' ? m.end : undefined,
          polygon: m.type === 'slab' ? m.polygon : undefined,
        }));

      const candidates = buildSnapCandidatesFromMembers(members);
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

  const handleClick = useCallback(
    (worldPos: Point2D, e: React.MouseEvent) => {
      const { activeTool, setSelectedIds, toggleSelection } = useEditorStore.getState();

      // For select tool, handle click on elements via data-id
      if (activeTool === 'select') {
        const target = (e.target as SVGElement).closest('[data-id]');
        if (!target) {
          setSelectedIds([]);
          return;
        }
        const id = target.getAttribute('data-id')!;
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          toggleSelection(id);
        } else {
          setSelectedIds([id]);
        }
        return;
      }

      // Drawing tools
      const { pos, snap } = getSnapPos(worldPos);
      handleDrawingClick(activeTool, pos, snap);
    },
    [getSnapPos],
  );

  const handleDrawingClick = useCallback(
    (tool: EditorTool, pos: Point2D, _snap: SnapResult | null) => {
      const store = useProjectStore.getState();
      const { activeStory } = useEditorStore.getState();
      if (!store.data || !activeStory) return;

      const story = store.data.stories.find((s) => s.id === activeStory);
      if (!story) return;

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
          const member: ColumnMember = {
            id: uuidv4(),
            type: 'column',
            story: activeStory,
            sectionId: defaultSection('column'),
            materialId: defaultMaterial,
            start: { x: pos.x, y: pos.y, z: story.elevation },
            end: { x: pos.x, y: pos.y, z: story.elevation + story.height },
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
                id: uuidv4(),
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
                id: uuidv4(),
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
                id: uuidv4(),
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
            id: uuidv4(),
            type: 'text',
            story: activeStory,
            x: pos.x,
            y: pos.y,
            text,
          };
          store.addAnnotation(ann);
          break;
        }
      }
    },
    [],
  );

  const handleDoubleClick = useCallback(
    (_worldPos: Point2D) => {
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

          const defaultSection = store.data.sections.find((s) => s.kind === 'rc_slab')?.id ?? store.data.sections[0]?.id ?? '';
          const member: SlabMember = {
            id: uuidv4(),
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
    },
    [getSnapPos],
  );

  const resetDrawing = useCallback(() => {
    setDrawState({ points: [], previewPos: null, snapResult: null });
  }, []);

  return {
    drawState,
    handleClick,
    handleDoubleClick,
    handleMouseMove,
    resetDrawing,
  };
}
