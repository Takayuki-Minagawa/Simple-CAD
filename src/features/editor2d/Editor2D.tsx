import { useEffect, useCallback, useRef, useState } from 'react';
import { isCreationTool, useProjectStore, useEditorStore } from '@/app/store';
import type { Point2D } from '@/domain/geometry/types';
import { SvgCanvas } from './SvgCanvas';
import { GridLayer } from './layers/GridLayer';
import { MemberLayer } from './layers/MemberLayer';
import { DimensionLayer } from './layers/DimensionLayer';
import { AnnotationLayer } from './layers/AnnotationLayer';
import { DrawPreview } from './DrawPreview';
import { canCompleteDrawing, useEditorInteraction } from './useEditorInteraction';
import { CoordinateInputBar, DynamicInput } from './CoordinateInputDialog';
import { EditorControls2D } from './EditorControls2D';
import { DrawingGuide } from './DrawingGuide';
import { SelectionHandles } from './SelectionHandles';
import { getAllEntityBounds, getSelectionBounds } from '@/domain/structural/editTransform';
import { ConstructionLineLayer } from './layers/ConstructionLineLayer';
import { ExternalRefLayer } from './layers/ExternalRefLayer';

export function Editor2D() {
  const data = useProjectStore((s) => s.data);
  const activeStory = useEditorStore((s) => s.activeStory);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const layerVisibility = useEditorStore((s) => s.layerVisibility);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const drawInputAssist = useEditorStore((s) => s.drawInputAssist);
  const cursorWorld = useEditorStore((s) => s.cursorWorld);
  const [ghostPoint, setGhostPoint] = useState<Point2D | null>(null);
  const {
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
  } = useEditorInteraction();

  const containerRef = useRef<HTMLDivElement>(null);

  const zoomToExtents = useCallback(() => {
    const projectData = useProjectStore.getState().data;
    const editorState = useEditorStore.getState();
    if (!projectData) return;
    const el = containerRef.current;
    if (!el) return;
    const allBounds = getAllEntityBounds(projectData, editorState.activeStory);
    if (!allBounds) return;
    editorState.zoomToFit(allBounds, el.clientWidth, el.clientHeight);
  }, []);

  const zoomToSelection = useCallback(() => {
    const projectData = useProjectStore.getState().data;
    const editorState = useEditorStore.getState();
    if (!projectData || editorState.selectedIds.length === 0) return;
    const el = containerRef.current;
    if (!el) return;
    const bounds = getSelectionBounds(projectData, editorState.selectedIds);
    if (!bounds) return;
    editorState.zoomToFit(
      { minX: bounds.min.x, minY: bounds.min.y, maxX: bounds.max.x, maxY: bounds.max.y },
      el.clientWidth,
      el.clientHeight,
    );
  }, []);

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
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT'
        )
          return;
        if (canCompleteDrawing(activeTool, drawState.points.length)) {
          e.preventDefault();
          completeDrawing();
          return;
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
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT'
        )
          return;

        if (e.shiftKey) {
          zoomToSelection();
        } else {
          zoomToExtents();
        }
      }
    },
    [
      activeTool,
      completeDrawing,
      drawState.points.length,
      resetDrawing,
      setActiveTool,
      zoomToExtents,
      zoomToSelection,
    ],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!data) return null;

  const filteredMembers = data.members.filter((m) => !activeStory || m.story === activeStory);
  const filteredAnnotations = data.annotations.filter(
    (a) => !activeStory || a.story === activeStory,
  );
  const filteredDimensions = data.dimensions.filter((d) => !activeStory || d.story === activeStory);
  const filteredConstructionLines = (data.constructionLines ?? []).filter(
    (cl) => !activeStory || cl.story === activeStory,
  );

  const isVisible = (layer: string) => layerVisibility[layer] !== false;

  // Determine if a drawing tool is active (for coord input bar)
  const isDrawingTool = isCreationTool(activeTool);

  // Last point for coordinate input (relative coordinates)
  const lastPoint =
    drawState.points.length > 0 ? drawState.points[drawState.points.length - 1] : null;
  const guidePointCount =
    activeTool === 'extend' && drawState.extendMemberId ? 1 : drawState.points.length;

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
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
    >
      <div className="editor-canvas-overlay">
        <EditorControls2D
          canZoomSelection={selectedIds.length > 0}
          onZoomExtents={zoomToExtents}
          onZoomSelection={zoomToSelection}
        />
        <DrawingGuide activeTool={activeTool} pointCount={guidePointCount} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <SvgCanvas
          onWorldClick={handleClick}
          onWorldMouseMove={handleMouseMove}
          onWorldDoubleClick={handleDoubleClick}
          onWorldMouseDown={handleMouseDown}
          onWorldMouseUp={handleMouseUp}
        >
          {isVisible('grid') && <GridLayer grids={data.grids} extent={10000} />}
          {isVisible('member-slab') ||
          isVisible('member-wall') ||
          isVisible('member-beam') ||
          isVisible('member-column') ? (
            <MemberLayer
              members={filteredMembers.filter((m) => isVisible(`member-${m.type}`))}
              sections={data.sections}
              selectedIds={selectedIds}
              muted={isDrawingTool && drawInputAssist}
            />
          ) : null}
          {isVisible('dimension') && (
            <DimensionLayer dimensions={filteredDimensions} selectedIds={selectedIds} />
          )}
          {isVisible('annotation') && (
            <AnnotationLayer annotations={filteredAnnotations} selectedIds={selectedIds} />
          )}
          {isVisible('construction') && filteredConstructionLines.length > 0 && (
            <ConstructionLineLayer constructionLines={filteredConstructionLines} />
          )}
          <ExternalRefLayer refs={data.externalRefs ?? []} />
          {activeTool === 'select' && <SelectionHandles />}
          <DrawPreview drawState={drawState} activeTool={activeTool} ghostPoint={ghostPoint} />
          {selectionRectOverlay}
        </SvgCanvas>
        {/* Dynamic input (4-1): cursor-following length/angle entry while a
            segment-style draw is in progress. */}
        {isDrawingTool && lastPoint && (
          <DynamicInput
            key={drawState.points.length}
            lastPoint={lastPoint}
            cursorWorld={cursorWorld}
            onSubmit={injectCoordinate}
            onGhostChange={setGhostPoint}
          />
        )}
      </div>
      {isDrawingTool && (
        <CoordinateInputBar
          lastPoint={lastPoint}
          previewPoint={drawState.previewPos}
          onSubmit={injectCoordinate}
          onGhostChange={setGhostPoint}
        />
      )}
    </div>
  );
}
