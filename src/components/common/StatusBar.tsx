import { useEditorStore } from '@/app/store';

export function StatusBar() {
  const { cursorWorld, zoom, snapEnabled, selectedIds, activeStory, activeTool } =
    useEditorStore();

  return (
    <div className="status-bar">
      <span className="status-item">
        {cursorWorld
          ? `X: ${cursorWorld.x.toFixed(0)}  Y: ${cursorWorld.y.toFixed(0)}`
          : 'X: ---  Y: ---'}
      </span>
      <span className="status-item">Zoom: {(zoom * 1000).toFixed(0)}%</span>
      <span className="status-item">Snap: {snapEnabled ? 'ON' : 'OFF'}</span>
      <span className="status-item">Tool: {activeTool}</span>
      <span className="status-item">Story: {activeStory ?? '---'}</span>
      <span className="status-item">
        Selected: {selectedIds.length}
      </span>
    </div>
  );
}
