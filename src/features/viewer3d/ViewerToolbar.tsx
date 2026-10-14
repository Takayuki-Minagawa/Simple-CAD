import type { Translations } from '@/i18n';
import type { ViewerLabels } from './viewerLabels';
import { VIEW_PRESETS, type ViewPreset } from './viewPresets';

interface ViewerToolbarProps {
  labels: ViewerLabels;
  t: Translations;
  activeStory: string | null;
  showAllStories: boolean;
  setShowAllStories: (on: boolean) => void;
  orthographic: boolean;
  setOrthographic: (on: boolean) => void;
  wireframe: boolean;
  setWireframe: (on: boolean) => void;
  measureMode: boolean;
  toggleMeasure: () => void;
  clearMeasure: () => void;
  measureCount: number;
  hasAnalysisResults: boolean;
  showAnalysisResults: boolean;
  toggleAnalysisResults: () => void;
  // ── Named views (R10) ──
  currentView: ViewPreset | 'custom';
  onSelectView: (preset: ViewPreset) => void;
  onFitAll: () => void;
  onFitSelection: () => void;
  canFitSelection: boolean;
}

const buttonStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'var(--accent)' : '#555',
  color: '#fff',
  fontSize: 11,
});

export function ViewerToolbar({
  labels,
  t,
  activeStory,
  showAllStories,
  setShowAllStories,
  orthographic,
  setOrthographic,
  wireframe,
  setWireframe,
  measureMode,
  toggleMeasure,
  clearMeasure,
  measureCount,
  hasAnalysisResults,
  showAnalysisResults,
  toggleAnalysisResults,
  currentView,
  onSelectView,
  onFitAll,
  onFitSelection,
  canFitSelection,
}: ViewerToolbarProps) {
  const viewLabel: Record<ViewPreset, string> = {
    top: t.viewTop,
    front: t.viewFront,
    right: t.viewRight,
    iso: t.viewIso,
  };
  const currentViewText = currentView === 'custom' ? t.viewCustom : viewLabel[currentView];

  return (
    <>
      {/* Top-right: display toggles (unchanged position so the section panel below stays aligned). */}
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, display: 'flex', gap: 4 }}>
        <button
          className="toolbar-btn"
          style={buttonStyle(showAllStories)}
          onClick={() => setShowAllStories(!showAllStories)}
          disabled={!activeStory}
          aria-pressed={showAllStories}
        >
          {showAllStories ? labels.allStories : labels.currentStory}
        </button>
        <button
          className="toolbar-btn"
          style={buttonStyle(orthographic)}
          onClick={() => setOrthographic(!orthographic)}
          aria-pressed={orthographic}
          aria-label={`${t.viewProjection}: ${orthographic ? t.viewOrtho : t.viewPersp}`}
        >
          {orthographic ? t.viewOrtho : t.viewPersp}
        </button>
        <button
          className="toolbar-btn"
          style={buttonStyle(wireframe)}
          onClick={() => setWireframe(!wireframe)}
          aria-pressed={wireframe}
        >
          {t.viewWire}
        </button>
        <button
          className="toolbar-btn"
          style={buttonStyle(measureMode)}
          onClick={toggleMeasure}
          title={labels.measureHint}
          aria-pressed={measureMode}
        >
          {labels.measure}
        </button>
        {measureMode && (
          <button
            className="toolbar-btn"
            style={buttonStyle(false)}
            onClick={clearMeasure}
            disabled={measureCount === 0}
          >
            {labels.measureClear}
          </button>
        )}
        {hasAnalysisResults && (
          <button
            className="toolbar-btn"
            style={buttonStyle(showAnalysisResults)}
            onClick={toggleAnalysisResults}
            aria-pressed={showAnalysisResults}
          >
            {labels.analysisResults}
          </button>
        )}
      </div>

      {/* Bottom-centre: named standard views, clear of the section panel and gizmo (R10). */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 11,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          maxWidth: 'calc(100% - 16px)',
        }}
      >
      <div
        role="group"
        aria-label={t.viewCurrent}
        style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}
      >
        {VIEW_PRESETS.map((preset) => (
          <button
            key={preset}
            className="toolbar-btn"
            style={buttonStyle(currentView === preset)}
            onClick={() => onSelectView(preset)}
            aria-pressed={currentView === preset}
          >
            {viewLabel[preset]}
          </button>
        ))}
        <button className="toolbar-btn" style={buttonStyle(false)} onClick={onFitAll}>
          {t.viewFitAll}
        </button>
        <button
          className="toolbar-btn"
          style={buttonStyle(false)}
          onClick={onFitSelection}
          disabled={!canFitSelection}
        >
          {t.viewFitSelection}
        </button>
      </div>

      <div
        role="status"
        data-status="view3d"
        style={{
          padding: '2px 8px',
          borderRadius: 4,
          background: 'rgba(16, 24, 40, 0.78)',
          color: '#fff',
          fontSize: 11,
        }}
      >
        {t.viewCurrent}: {currentViewText} / {t.viewProjection}: {orthographic ? t.viewOrtho : t.viewPersp}
      </div>
      </div>
    </>
  );
}
