import { useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';

export function StatusBar() {
  const { cursorWorld, zoom, snapEnabled, selectedIds, activeStory, activeTool } = useEditorStore();
  const { t } = useI18n();

  return (
    <div className="status-bar">
      <span className="status-item">
        {cursorWorld
          ? `X: ${cursorWorld.x.toFixed(0)}  Y: ${cursorWorld.y.toFixed(0)}`
          : 'X: ---  Y: ---'}
      </span>
      <span className="status-item">{t.statusZoom}: {(zoom * 1000).toFixed(0)}%</span>
      <span className="status-item">{t.statusSnap}: {snapEnabled ? t.statusOn : t.statusOff}</span>
      <span className="status-item">{t.statusTool}: {activeTool}</span>
      <span className="status-item">{t.statusStory}: {activeStory ?? '---'}</span>
      <span className="status-item">{t.statusSelected}: {selectedIds.length}</span>
    </div>
  );
}
