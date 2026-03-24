import { useEffect, useCallback, useRef } from 'react';
import { useProjectStore, useEditorStore } from '@/app/store';
import { SvgCanvas } from './SvgCanvas';
import { GridLayer } from './layers/GridLayer';
import { MemberLayer } from './layers/MemberLayer';
import { DimensionLayer } from './layers/DimensionLayer';
import { AnnotationLayer } from './layers/AnnotationLayer';
import { DrawPreview } from './DrawPreview';
import { useEditorInteraction } from './useEditorInteraction';
import { CoordinateInputBar } from './CoordinateInputDialog';
import { getAllEntityBounds, getSelectionBounds } from '@/domain/structural/editTransform';

export function Editor2D() {
  const data = useProjectStore((s) => s.data);
  const { activeStory, selectedIds, layerVisibility, activeTool, setActiveTool } =
    useEditorStore();
  const {
    drawState,
    rectSelect,
    handleClick,
    handleDoubleClick,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    injectCoordinate,
    resetDrawing,
  } = useEditorInteraction();

  const containerRef = useRef<HTMLDivElement>(null);

  // ESC to cancel drawing or deselect
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drawState.points.length > 0) {
          resetDrawing();
        } else {
          useEditorStore.getState().setSelectedIds([]);
          setActiveTool('select');
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        const ids = useEditorStore.getState().selectedIds;
        for (const id of ids) {
          useProjectStore.getState().deleteById(id);
        }
        useEditorStore.getState().setSelectedIds([]);
      }

      // Z = Zoom extents, Shift+Z = Zoom to selection
      if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

        const projectData = useProjectStore.getState().data;
        const editorState = useEditorStore.getState();
        if (!projectData) return;

        const el = containerRef.current;
        if (!el) return;
        const vw = el.clientWidth;
        const vh = el.clientHeight;

        if (e.shiftKey) {
          // Zoom to selection
          if (editorState.selectedIds.length === 0) return;
          const bounds = getSelectionBounds(projectData, editorState.selectedIds);
          if (!bounds) return;
          editorState.zoomToFit(
            { minX: bounds.min.x, minY: bounds.min.y, maxX: bounds.max.x, maxY: bounds.max.y },
            vw,
            vh,
          );
        } else {
          // Zoom extents
          const allBounds = getAllEntityBounds(projectData, editorState.activeStory);
          if (!allBounds) return;
          editorState.zoomToFit(allBounds, vw, vh);
        }
      }
    },
    [drawState.points.length, resetDrawing, setActiveTool],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!data) return null;

  const filteredMembers = data.members.filter(
    (m) => !activeStory || m.story === activeStory,
  );
  const filteredAnnotations = data.annotations.filter(
    (a) => !activeStory || a.story === activeStory,
  );
  const filteredDimensions = data.dimensions.filter(
    (d) => !activeStory || d.story === activeStory,
  );

  const isVisible = (layer: string) => layerVisibility[layer] !== false;

  // Determine if a drawing tool is active (for coord input bar)
  const isDrawingTool = activeTool !== 'select' && activeTool !== 'pan';

  // Last point for coordinate input (relative coordinates)
  const lastPoint = drawState.points.length > 0 ? drawState.points[drawState.points.length - 1] : null;

  // Selection rectangle overlay (in screen coordinates)
  let selectionRectOverlay: React.ReactNode = null;
  if (rectSelect.start && rectSelect.end) {
    const s = rectSelect.start;
    const e = rectSelect.end;
    const isWindow = e.x >= s.x; // left-to-right = window
    const minX = Math.min(s.x, e.x);
    const minY = Math.min(s.y, e.y);
    const w = Math.abs(e.x - s.x);
    const h = Math.abs(e.y - s.y);
    selectionRectOverlay = (
      <rect
        x={minX}
        y={minY}
        width={w}
        height={h}
        fill={isWindow ? 'rgba(0,120,255,0.08)' : 'rgba(0,200,60,0.08)'}
        stroke={isWindow ? '#0078ff' : '#00c83c'}
        strokeWidth={40}
        strokeDasharray={isWindow ? 'none' : '200 100'}
      />
    );
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <SvgCanvas
          onWorldClick={handleClick}
          onWorldMouseMove={handleMouseMove}
          onWorldDoubleClick={handleDoubleClick}
          onWorldMouseDown={handleMouseDown}
          onWorldMouseUp={handleMouseUp}
        >
          {isVisible('grid') && <GridLayer grids={data.grids} extent={10000} />}
          {isVisible('member-slab') || isVisible('member-wall') || isVisible('member-beam') || isVisible('member-column') ? (
            <MemberLayer
              members={filteredMembers.filter((m) => isVisible(`member-${m.type}`))}
              sections={data.sections}
              selectedIds={selectedIds}
            />
          ) : null}
          {isVisible('dimension') && (
            <DimensionLayer dimensions={filteredDimensions} selectedIds={selectedIds} />
          )}
          {isVisible('annotation') && (
            <AnnotationLayer annotations={filteredAnnotations} selectedIds={selectedIds} />
          )}
          <DrawPreview drawState={drawState} activeTool={activeTool} />
          {selectionRectOverlay}
        </SvgCanvas>
      </div>
      {isDrawingTool && (
        <CoordinateInputBar lastPoint={lastPoint} onSubmit={injectCoordinate} />
      )}
    </div>
  );
}
