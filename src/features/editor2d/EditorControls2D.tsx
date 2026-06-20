import { isCreationTool, useEditorStore } from '@/app/store';
import { getSnapModeLabels } from '@/app/snapMetadata';
import { useI18n } from '@/i18n';

const POLAR_STEPS = [15, 30, 45, 90];

interface Props {
  canZoomSelection: boolean;
  onZoomExtents: () => void;
  onZoomSelection: () => void;
}

export function EditorControls2D({ canZoomSelection, onZoomExtents, onZoomSelection }: Props) {
  const activeTool = useEditorStore((s) => s.activeTool);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const activeSnapModes = useEditorStore((s) => s.activeSnapModes);
  const drawInputAssist = useEditorStore((s) => s.drawInputAssist);
  const snapToMembersWhileDrawing = useEditorStore((s) => s.snapToMembersWhileDrawing);
  const columnPlacementDirection = useEditorStore((s) => s.columnPlacementDirection);
  const orthoMode = useEditorStore((s) => s.orthoMode);
  const polarTrackingEnabled = useEditorStore((s) => s.polarTrackingEnabled);
  const polarAngleStep = useEditorStore((s) => s.polarAngleStep);
  const toggleOrthoMode = useEditorStore((s) => s.toggleOrthoMode);
  const togglePolarTracking = useEditorStore((s) => s.togglePolarTracking);
  const setPolarAngleStep = useEditorStore((s) => s.setPolarAngleStep);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);
  const toggleSnapMode = useEditorStore((s) => s.toggleSnapMode);
  const setDrawInputAssist = useEditorStore((s) => s.setDrawInputAssist);
  const setSnapToMembersWhileDrawing = useEditorStore((s) => s.setSnapToMembersWhileDrawing);
  const setColumnPlacementDirection = useEditorStore((s) => s.setColumnPlacementDirection);
  const { t, locale } = useI18n();
  const isDrawing = isCreationTool(activeTool);
  const snapModeLabels = getSnapModeLabels(t);
  const orthoLabel = locale === 'ja' ? '直交' : 'Ortho';
  const polarLabel = locale === 'ja' ? '極' : 'Polar';
  const orthoTip = locale === 'ja' ? '直交モード (F8)' : 'Ortho mode (F8)';
  const polarTip = locale === 'ja' ? '極トラッキング (F10)' : 'Polar tracking (F10)';

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
        className={`floating-control-btn ${snapEnabled ? 'active' : ''}`}
        onClick={() => setSnapEnabled(!snapEnabled)}
        title={t.statusSnap}
      >
        {t.statusSnap}
      </button>
      {snapModeLabels.map(([mode, label]) => (
        <button
          key={mode}
          className={`floating-control-btn compact ${activeSnapModes.includes(mode) ? 'active' : ''}`}
          onClick={() => toggleSnapMode(mode)}
          disabled={!snapEnabled}
          title={`${t.snapModeTooltip}: ${label}`}
        >
          {label}
        </button>
      ))}
      <span className="floating-control-divider" />
      <button
        className={`floating-control-btn ${orthoMode ? 'active' : ''}`}
        onClick={() => toggleOrthoMode()}
        title={orthoTip}
      >
        {orthoLabel}
      </button>
      <button
        className={`floating-control-btn ${polarTrackingEnabled ? 'active' : ''}`}
        onClick={() => togglePolarTracking()}
        title={polarTip}
      >
        {polarLabel}
      </button>
      {polarTrackingEnabled && (
        <select
          className="floating-control-btn compact"
          value={polarAngleStep}
          onChange={(e) => setPolarAngleStep(Number(e.target.value))}
          title={polarTip}
          style={{ cursor: 'pointer' }}
        >
          {POLAR_STEPS.map((step) => (
            <option key={step} value={step}>
              {step}°
            </option>
          ))}
        </select>
      )}
      <span className="floating-control-divider" />
      <button
        className={`floating-control-btn ${drawInputAssist ? 'active' : ''}`}
        onClick={() => setDrawInputAssist(!drawInputAssist)}
        title={t.inputAssistTooltip}
      >
        {t.inputAssist}
      </button>
      {isDrawing && (
        <button
          className={`floating-control-btn ${snapToMembersWhileDrawing ? 'active' : ''}`}
          onClick={() => setSnapToMembersWhileDrawing(!snapToMembersWhileDrawing)}
          title={t.memberSnapTooltip}
        >
          {t.memberSnap}
        </button>
      )}
      <button
        className={`floating-control-btn ${columnPlacementDirection === 'down' ? 'active' : ''}`}
        onClick={() => setColumnPlacementDirection(columnPlacementDirection === 'down' ? 'up' : 'down')}
        title={columnPlacementDirection === 'down' ? t.columnZDownTooltip : t.columnZUpTooltip}
      >
        {columnPlacementDirection === 'down' ? t.columnZDown : t.columnZUp}
      </button>
    </div>
  );
}
