import { useEditorStore } from '@/app/store';
import { getToolStatusLabel } from '@/app/toolMetadata';
import { useI18n } from '@/i18n';

export function StatusBar() {
  const cursorWorld = useEditorStore((s) => s.cursorWorld);
  const zoom = useEditorStore((s) => s.zoom);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const activeStory = useEditorStore((s) => s.activeStory);
  const activeTool = useEditorStore((s) => s.activeTool);
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
      <span className="status-item">{t.statusTool}: {getToolStatusLabel(activeTool, t)}</span>
      <span className="status-item">{t.statusStory}: {activeStory ?? '---'}</span>
      <span className="status-item">{t.statusSelected}: {selectedIds.length}</span>
    </div>
  );
}
