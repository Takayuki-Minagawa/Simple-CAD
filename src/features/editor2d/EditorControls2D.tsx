import { useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';

interface Props {
  canZoomSelection: boolean;
  onZoomExtents: () => void;
  onZoomSelection: () => void;
}

export function EditorControls2D({ canZoomSelection, onZoomExtents, onZoomSelection }: Props) {
  const {
    activeTool,
    drawInputAssist,
    snapToMembersWhileDrawing,
    columnPlacementDirection,
    setDrawInputAssist,
    setSnapToMembersWhileDrawing,
    setColumnPlacementDirection,
  } = useEditorStore();
  const { t } = useI18n();
  const isDrawing = activeTool !== 'select' && activeTool !== 'pan';

  return (
    <div className="editor-floating-controls">
      <button className="floating-control-btn" onClick={onZoomExtents} title="Z">
        {t.zoomExtents}
      </button>
      <button
        className="floating-control-btn"
        onClick={onZoomSelection}
        disabled={!canZoomSelection}
        title="Shift+Z"
      >
        {t.zoomSelection}
      </button>
      <span className="floating-control-divider" />
      <button
        className={`floating-control-btn ${drawInputAssist ? 'active' : ''}`}
        onClick={() => setDrawInputAssist(!drawInputAssist)}
      >
        {t.inputAssist}
      </button>
      {isDrawing && (
        <button
          className={`floating-control-btn ${snapToMembersWhileDrawing ? 'active' : ''}`}
          onClick={() => setSnapToMembersWhileDrawing(!snapToMembersWhileDrawing)}
        >
          {t.memberSnap}
        </button>
      )}
      <button
        className={`floating-control-btn ${columnPlacementDirection === 'down' ? 'active' : ''}`}
        onClick={() => setColumnPlacementDirection(columnPlacementDirection === 'down' ? 'up' : 'down')}
      >
        {columnPlacementDirection === 'down' ? t.columnZDown : t.columnZUp}
      </button>
    </div>
  );
}
