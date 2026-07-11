import { lazy, Suspense, useEffect, useState } from 'react';
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
import { Modal } from '@/components/common/Modal';
import { downloadBlob } from '@/libs/fileSystem';
import {
  clearAutosave,
  loadAutosave,
  loadPreferences,
  savePreferences,
  saveWorkspace,
  type AutosaveRecord,
} from '@/libs/persistence';

const Viewer3D = lazy(() =>
  import('@/features/viewer3d/Viewer3D').then((module) => ({ default: module.Viewer3D })),
);
const TransformDialog = lazy(() =>
  import('@/features/editor2d/TransformDialog').then((module) => ({
    default: module.TransformDialog,
  })),
);
const ExportDialog = lazy(() =>
  import('@/features/project/ExportDialog').then((module) => ({ default: module.ExportDialog })),
);
const MasterDataDialog = lazy(() =>
  import('@/features/project/MasterDataDialog').then((module) => ({
    default: module.MasterDataDialog,
  })),
);
const AiAssistPanel = lazy(() =>
  import('@/features/aiAssist/AiAssistPanel').then((module) => ({ default: module.AiAssistPanel })),
);
const HelpDialog = lazy(() =>
  import('@/features/help/HelpDialog').then((module) => ({ default: module.HelpDialog })),
);
const PrintPreviewDialog = lazy(() =>
  import('@/features/project/PrintPreviewDialog').then((module) => ({
    default: module.PrintPreviewDialog,
  })),
);

export function App() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const theme = useEditorStore((s) => s.theme);
  const statusDecimals = useEditorStore((s) => s.statusDecimals);
  const statusUnit = useEditorStore((s) => s.statusUnit);
  const wireframe = useEditorStore((s) => s.wireframe);
  const orthographic = useEditorStore((s) => s.orthographic);
  const data = useProjectStore((s) => s.data);
  const isDirty = useProjectStore((s) => s.isDirty);
  const documentGeneration = useProjectStore((s) => s.documentGeneration);
  const loadProject = useProjectStore((s) => s.loadProject);
  const activeStory = useEditorStore((s) => s.activeStory);
  const setActiveStory = useEditorStore((s) => s.setActiveStory);
  const { t, locale, setLocale } = useI18n();
  const [showExport, setShowExport] = useState(false);
  const [showMasters, setShowMasters] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTransform, setShowTransform] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [responsivePanel, setResponsivePanel] = useState<'left' | 'right' | null>(null);
  const [recovery, setRecovery] = useState<AutosaveRecord | null>(null);
  const [recoveryErrors, setRecoveryErrors] = useState<string[]>([]);
  const [recoveryCanLoad, setRecoveryCanLoad] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState('');

  const appDialogOpen =
    showExport ||
    showMasters ||
    showAi ||
    showHelp ||
    showTransform ||
    showPrintPreview ||
    Boolean(recovery);
  useKeyboardShortcuts(appDialogOpen);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.lang = locale;
  }, [locale, theme]);

  // Restore user preferences and offer recovery of a dirty autosave.
  useEffect(() => {
    let active = true;
    void loadPreferences()
      .then((preferences) => {
        if (!active || !preferences) return;
        const editor = useEditorStore.getState();
        editor.setTheme(preferences.theme);
        editor.setViewMode(preferences.viewMode);
        editor.setStatusDecimals(preferences.statusDecimals);
        editor.setStatusUnit(preferences.statusUnit);
        editor.setWireframe(preferences.wireframe);
        editor.setOrthographic(preferences.orthographic);
        setLocale(preferences.locale);
      })
      .catch((error) => {
        if (active && typeof indexedDB !== 'undefined') setStorageWarning(String(error));
      })
      .finally(() => {
        if (active) setPreferencesReady(true);
      });
    void loadAutosave()
      .then(async (record) => {
        if (!active || !record?.dirty || useProjectStore.getState().data !== null) return;
        const { importProjectJson } = await import('@/domain/import/jsonImport');
        const parsed = importProjectJson(JSON.stringify(record.data));
        if (!active || useProjectStore.getState().data !== null) return;
        if (parsed.ok) {
          setRecoveryErrors([]);
          setRecoveryCanLoad(true);
          setRecovery({ ...record, data: parsed.data });
        } else {
          const raw = record.data as unknown as Record<string, unknown>;
          const recoverable =
            Boolean(raw?.project && typeof raw.project === 'object') &&
            ['stories', 'grids', 'materials', 'sections', 'members', 'openings', 'annotations', 'dimensions', 'sheets', 'views']
              .every((key) => Array.isArray(raw?.[key]));
          setRecoveryErrors(parsed.errors.map((error) => error.message));
          setRecoveryCanLoad(recoverable);
          setRecovery(record);
          const currentLocale = useI18n.getState().locale;
          setStorageWarning(
            currentLocale === 'ja'
              ? '自動保存に検証エラーがあります。破棄せず、復元またはJSONの退避ができます。'
              : 'The autosave has validation errors. It was kept so you can recover it or download the raw JSON.',
          );
        }
      })
      .catch((error) => {
        if (active && typeof indexedDB !== 'undefined') setStorageWarning(String(error));
      });
    return () => {
      active = false;
    };
  }, [setLocale]);

  useEffect(() => {
    if (!preferencesReady) return;
    const timeout = window.setTimeout(() => {
      void savePreferences({
        locale,
        theme,
        viewMode,
        statusDecimals,
        statusUnit,
        wireframe,
        orthographic,
      }).catch((error) => setStorageWarning(String(error)));
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [
    locale,
    orthographic,
    preferencesReady,
    statusDecimals,
    statusUnit,
    theme,
    viewMode,
    wireframe,
  ]);

  useEffect(() => {
    if (!data) return;
    const snapshot = data;
    const dirty = isDirty;
    const persist = () => {
      void saveWorkspace(snapshot, dirty).catch((error) => setStorageWarning(String(error)));
    };
    if (!dirty) {
      persist();
      return;
    }
    const timeout = window.setTimeout(() => {
      persist();
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [data, isDirty]);

  useEffect(() => {
    const persistLatest = () => {
      const project = useProjectStore.getState();
      if (!project.data) return;
      void saveWorkspace(project.data, project.isDirty).catch((error) =>
        setStorageWarning(String(error)),
      );
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistLatest();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', persistLatest);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', persistLatest);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!useProjectStore.getState().isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

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
        onMasters={() => setShowMasters(true)}
        onAiAssist={() => setShowAi(true)}
        onHelp={() => setShowHelp(true)}
        onTransform={() => setShowTransform(true)}
        onPrintPreview={() => setShowPrintPreview(true)}
      />
      <div className={`app-body ${responsivePanel ? `show-${responsivePanel}-panel` : ''}`}>
        <div className="left-panel">
          <StorySelector />
          <ObjectTreePanel />
          <LayerPanel />
        </div>
        <div className="center-canvas">
          {data ? (
            viewMode === '2d' ? (
              <Editor2D key={`editor-${documentGeneration}`} />
            ) : (
              <Suspense
                fallback={
                  <div role="status" style={{ padding: 16 }}>
                    {locale === 'ja' ? '3Dビューを読み込み中…' : 'Loading 3D view…'}
                  </div>
                }
              >
                <Viewer3D key={`viewer-${documentGeneration}`} />
              </Suspense>
            )
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
        <div className="responsive-panel-controls" aria-label={t.panelControls}>
          <button
            className={`responsive-panel-btn ${responsivePanel === 'left' ? 'active' : ''}`}
            onClick={() => setResponsivePanel(responsivePanel === 'left' ? null : 'left')}
            title={t.panelLeftToggle}
            aria-pressed={responsivePanel === 'left'}
          >
            {t.panelStory}
          </button>
          <button
            className={`responsive-panel-btn ${responsivePanel === 'right' ? 'active' : ''}`}
            onClick={() => setResponsivePanel(responsivePanel === 'right' ? null : 'right')}
            title={t.panelRightToggle}
            aria-pressed={responsivePanel === 'right'}
          >
            {t.panelProperties}
          </button>
        </div>
      </div>
      <StatusBar />

      {storageWarning && (
        <div
          role="status"
          style={{
            position: 'fixed',
            right: 12,
            bottom: 36,
            zIndex: 900,
            maxWidth: 420,
            padding: 8,
            borderRadius: 6,
            background: 'var(--bg-panel)',
            color: 'var(--warning)',
            boxShadow: '0 2px 10px rgba(0,0,0,.2)',
            fontSize: 11,
          }}
        >
          {locale === 'ja' ? 'ローカル保存: ' : 'Local storage: '}
          {storageWarning}
          <button
            aria-label={locale === 'ja' ? '通知を閉じる' : 'Dismiss notification'}
            onClick={() => setStorageWarning('')}
            style={{ marginLeft: 8 }}
          >
            ×
          </button>
        </div>
      )}

      <Suspense fallback={null}>
        {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
        {showMasters && <MasterDataDialog onClose={() => setShowMasters(false)} />}
        {showAi && <AiAssistPanel onClose={() => setShowAi(false)} />}
        {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
        {showTransform && <TransformDialog onClose={() => setShowTransform(false)} />}
        {showPrintPreview && <PrintPreviewDialog onClose={() => setShowPrintPreview(false)} />}
      </Suspense>
      {recovery && (
        <Modal
          title={locale === 'ja' ? '自動保存を復元' : 'Recover autosave'}
          onClose={() => undefined}
          closeOnBackdrop={false}
          width={480}
          footer={
            <>
              <button
                className="toolbar-btn"
                onClick={() => {
                  void clearAutosave(recovery.key).catch((error) =>
                    setStorageWarning(String(error)),
                  );
                  setRecoveryErrors([]);
                  setRecovery(null);
                }}
              >
                {locale === 'ja' ? '破棄' : 'Discard'}
              </button>
              {recoveryErrors.length > 0 && (
                <button
                  className="toolbar-btn"
                  onClick={() =>
                    downloadBlob(
                      JSON.stringify(recovery.data, null, 2),
                      `${recovery.data?.project?.name ?? 'simple-cad'}.autosave-recovery.json`,
                      'application/json',
                    )
                  }
                >
                  {locale === 'ja' ? '生JSONを退避' : 'Download raw JSON'}
                </button>
              )}
              {recoveryCanLoad && (
                <button
                  className="toolbar-btn"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                  onClick={() => {
                    void clearAutosave(recovery.key).catch((error) =>
                      setStorageWarning(String(error)),
                    );
                    loadProject(recovery.data);
                    const recoveredRevision = useProjectStore.getState().currentRevision;
                    useProjectStore.setState({
                      isDirty: true,
                      savedRevision: recoveredRevision - 1,
                    });
                    setRecoveryErrors([]);
                    setRecovery(null);
                  }}
                >
                  {recoveryErrors.length > 0
                    ? (locale === 'ja' ? '警告付きで復元' : 'Recover anyway')
                    : (locale === 'ja' ? '復元' : 'Recover')}
                </button>
              )}
            </>
          }
        >
          <p style={{ marginTop: 0 }}>
            {locale === 'ja'
              ? '前回終了時に未保存の変更があります。復元しますか？'
              : 'Unsaved changes from the previous session were found. Recover them?'}
          </p>
          <strong>{recovery.data?.project?.name ?? (locale === 'ja' ? '名称不明' : 'Unknown project')}</strong>
          {recoveryErrors.length > 0 && (
            <div role="alert" style={{ color: 'var(--error)', marginTop: 8, maxHeight: 120, overflow: 'auto', fontSize: 11 }}>
              {recoveryErrors.slice(0, 8).map((message) => <div key={message}>{message}</div>)}
            </div>
          )}
          <div style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 12 }}>
            {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
              recovery.updatedAt,
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
