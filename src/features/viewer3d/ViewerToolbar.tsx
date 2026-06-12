import type { Translations } from '@/i18n';
import type { ViewerLabels } from './viewerLabels';

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
}

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
}: ViewerToolbarProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
        display: 'flex',
        gap: 4,
      }}
    >
      <button
        className="toolbar-btn"
        style={{ background: showAllStories ? 'var(--accent)' : '#555', color: '#fff', fontSize: 11 }}
        onClick={() => setShowAllStories(!showAllStories)}
        disabled={!activeStory}
      >
        {showAllStories ? labels.allStories : labels.currentStory}
      </button>
      <button
        className="toolbar-btn"
        style={{ background: orthographic ? 'var(--accent)' : '#555', color: '#fff', fontSize: 11 }}
        onClick={() => setOrthographic(!orthographic)}
      >
        {orthographic ? t.viewOrtho : t.viewPersp}
      </button>
      <button
        className="toolbar-btn"
        style={{ background: wireframe ? 'var(--accent)' : '#555', color: '#fff', fontSize: 11 }}
        onClick={() => setWireframe(!wireframe)}
      >
        {t.viewWire}
      </button>
    </div>
  );
}
