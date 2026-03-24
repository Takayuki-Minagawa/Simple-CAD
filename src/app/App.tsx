import { useEffect, useState } from 'react';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useKeyboardShortcuts } from '@/app/useKeyboardShortcuts';
import { MainToolbar } from '@/components/toolbars/MainToolbar';
import { StatusBar } from '@/components/common/StatusBar';
import { ObjectTreePanel } from '@/components/panels/ObjectTreePanel';
import { LayerPanel } from '@/components/panels/LayerPanel';
import { StorySelector } from '@/components/panels/StorySelector';
import { PropertyPanel } from '@/components/panels/PropertyPanel';
import { ValidationPanel } from '@/components/panels/ValidationPanel';
import { Editor2D } from '@/features/editor2d/Editor2D';
import { Viewer3D } from '@/features/viewer3d/Viewer3D';
import { ExportDialog } from '@/features/project/ExportDialog';
import { AiAssistPanel } from '@/features/aiAssist/AiAssistPanel';

export function App() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const data = useProjectStore((s) => s.data);
  const { activeStory, setActiveStory } = useEditorStore();
  const [showExport, setShowExport] = useState(false);
  const [showAi, setShowAi] = useState(false);

  useKeyboardShortcuts();

  // Auto-select first story when project loads
  useEffect(() => {
    if (data && data.stories.length > 0 && !activeStory) {
      setActiveStory(data.stories[0].id);
    }
  }, [data, activeStory, setActiveStory]);

  return (
    <div className="app-layout">
      <MainToolbar
        onExport={() => setShowExport(true)}
        onAiAssist={() => setShowAi(true)}
      />
      <div className="app-body">
        <div className="left-panel">
          <StorySelector />
          <ObjectTreePanel />
          <LayerPanel />
        </div>
        <div className="center-canvas">
          {data ? (
            viewMode === '2d' ? <Editor2D /> : <Viewer3D />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-secondary)',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 600 }}>Structural Web CAD</div>
              <div>Open a project or click "Sample" to load demo data</div>
            </div>
          )}
        </div>
        <div className="right-panel">
          <PropertyPanel />
          <ValidationPanel />
        </div>
      </div>
      <StatusBar />

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showAi && <AiAssistPanel onClose={() => setShowAi(false)} />}
    </div>
  );
}
