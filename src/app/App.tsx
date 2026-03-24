import { useEffect, useState } from 'react';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
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
import { HelpDialog } from '@/features/help/HelpDialog';

export function App() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const theme = useEditorStore((s) => s.theme);
  const data = useProjectStore((s) => s.data);
  const { activeStory, setActiveStory } = useEditorStore();
  const { t } = useI18n();
  const [showExport, setShowExport] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useKeyboardShortcuts();

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Auto-select first story when project loads or activeStory becomes invalid
  useEffect(() => {
    if (!data || data.stories.length === 0) return;
    const storyExists = data.stories.some((s) => s.id === activeStory);
    if (!activeStory || !storyExists) {
      setActiveStory(data.stories[0].id);
      useEditorStore.getState().setSelectedIds([]);
    }
  }, [data, activeStory, setActiveStory]);

  return (
    <div className="app-layout">
      <MainToolbar
        onExport={() => setShowExport(true)}
        onAiAssist={() => setShowAi(true)}
        onHelp={() => setShowHelp(true)}
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
              <div style={{ fontSize: 18, fontWeight: 600 }}>{t.appTitle}</div>
              <div>{t.loadPrompt}</div>
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
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
    </div>
  );
}
