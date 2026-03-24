import { useEffect, useCallback } from 'react';
import { useProjectStore, useEditorStore } from '@/app/store';
import { SvgCanvas } from './SvgCanvas';
import { GridLayer } from './layers/GridLayer';
import { MemberLayer } from './layers/MemberLayer';
import { DimensionLayer } from './layers/DimensionLayer';
import { AnnotationLayer } from './layers/AnnotationLayer';
import { DrawPreview } from './DrawPreview';
import { useEditorInteraction } from './useEditorInteraction';

export function Editor2D() {
  const data = useProjectStore((s) => s.data);
  const { activeStory, selectedIds, layerVisibility, activeTool, setActiveTool } =
    useEditorStore();
  const { drawState, handleClick, handleDoubleClick, handleMouseMove, resetDrawing } =
    useEditorInteraction();

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
        const ids = useEditorStore.getState().selectedIds;
        for (const id of ids) {
          useProjectStore.getState().deleteById(id);
        }
        useEditorStore.getState().setSelectedIds([]);
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

  return (
    <SvgCanvas
      onWorldClick={handleClick}
      onWorldMouseMove={handleMouseMove}
      onWorldDoubleClick={handleDoubleClick}
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
    </SvgCanvas>
  );
}
