import { useEditorStore, useProjectStore } from '@/app/store';
import type { EditorTool } from '@/app/store';
import { useI18n } from '@/i18n';
import { openDxfFile, openJsonFile, saveFile } from '@/libs/fileSystem';
import { importProjectJson } from '@/domain/import/jsonImport';
import { importDxf } from '@/domain/import/dxfImport';
import { exportProjectJson } from '@/domain/export/jsonExport';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';

interface Props {
  onExport: () => void;
  onMasters: () => void;
  onAiAssist: () => void;
  onHelp: () => void;
}

export function MainToolbar({ onExport, onMasters, onAiAssist, onHelp }: Props) {
  const { data, isDirty, fileHandle, loadProject, newProject, setFileHandle, markClean, addAnnotations } =
    useProjectStore();
  const { viewMode, setViewMode, activeTool, setActiveTool, setSelectedIds, theme, toggleTheme, activeStory } =
    useEditorStore();
  const { t, locale, setLocale } = useI18n();
  const mastersLabel = locale === 'ja' ? 'マスタ' : 'Masters';
  const importDxfLabel = locale === 'ja' ? 'DXF取込' : 'DXF Import';

  const handleNew = () => {
    if (isDirty && !confirm(t.confirmUnsaved)) return;
    newProject();
  };

  const handleOpen = async () => {
    try {
      const result = await openJsonFile();
      const imported = importProjectJson(result.content);
      if (!imported.ok) {
        alert(imported.errors.map((e) => e.message).join('\n'));
        return;
      }
      loadProject(imported.data);
      if (result.handle) setFileHandle(result.handle);
    } catch {
      // User cancelled
    }
  };

  const handleSave = async () => {
    if (!data) return;
    const json = exportProjectJson(data);
    try {
      const handle = await saveFile(json, `${data.project.name}.json`, 'application/json', fileHandle);
      if (handle) setFileHandle(handle);
      markClean();
    } catch {
      // User cancelled
    }
  };

  const handleSample = () => {
    if (isDirty && !confirm(t.confirmLoadSample)) return;
    loadProject(sampleProject as unknown as ProjectData);
  };

  const handleImportDxf = async () => {
    if (!data) return;
    const storyId = activeStory ?? data.stories[0]?.id;
    if (!storyId) {
      alert(locale === 'ja' ? '取込先の階がありません。' : 'No target story is available.');
      return;
    }

    try {
      const result = await openDxfFile();
      const imported = importDxf(result.content, storyId);
      addAnnotations(imported.annotations);

      const summary = locale === 'ja'
        ? [
            `${imported.annotations.length} 件の注記を ${storyId} に追加しました。`,
            `検出プリミティブ: ${imported.primitiveCount}`,
            imported.warnings.length > 0 ? `警告:\n${imported.warnings.slice(0, 8).join('\n')}` : '',
          ].filter(Boolean).join('\n')
        : [
            `Imported ${imported.annotations.length} annotations into ${storyId}.`,
            `Detected primitives: ${imported.primitiveCount}`,
            imported.warnings.length > 0 ? `Warnings:\n${imported.warnings.slice(0, 8).join('\n')}` : '',
          ].filter(Boolean).join('\n');
      alert(summary);
    } catch {
      // User cancelled
    }
  };

  const handleUndo = () => useProjectStore.temporal.getState().undo();
  const handleRedo = () => useProjectStore.temporal.getState().redo();

  const toolBtn = (tool: EditorTool, label: string) => (
    <button
      className={`toolbar-btn ${activeTool === tool ? 'active' : ''}`}
      onClick={() => {
        setActiveTool(tool);
        if (tool !== 'select') setSelectedIds([]);
      }}
      title={label}
    >
      {label}
    </button>
  );

  return (
    <div className="main-toolbar">
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleNew}>{t.fileNew}</button>
        <button className="toolbar-btn" onClick={handleOpen}>{t.fileOpen}</button>
        <button className="toolbar-btn" onClick={handleSave} disabled={!data}>
          {t.fileSave}{isDirty ? ' *' : ''}
        </button>
        <button className="toolbar-btn" onClick={handleSample}>{t.fileSample}</button>
        <button className="toolbar-btn" onClick={handleImportDxf} disabled={!data}>{importDxfLabel}</button>
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleUndo} disabled={!data}>{t.editUndo}</button>
        <button className="toolbar-btn" onClick={handleRedo} disabled={!data}>{t.editRedo}</button>
      </div>

      <div className="toolbar-group">
        {toolBtn('select', t.toolSelect)}
        {toolBtn('pan', t.toolPan)}
      </div>

      <div className="toolbar-group">
        {toolBtn('column', t.toolColumn)}
        {toolBtn('beam', t.toolBeam)}
        {toolBtn('wall', t.toolWall)}
        {toolBtn('slab', t.toolSlab)}
        {toolBtn('dimension', t.toolDimension)}
        {toolBtn('annotation', t.toolAnnotation)}
      </div>

      <div className="toolbar-group">
        <button className={`toolbar-btn ${viewMode === '2d' ? 'active' : ''}`} onClick={() => setViewMode('2d')}>{t.view2d}</button>
        <button className={`toolbar-btn ${viewMode === '3d' ? 'active' : ''}`} onClick={() => setViewMode('3d')}>{t.view3d}</button>
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onExport} disabled={!data}>{t.fileExport}</button>
        <button className="toolbar-btn" onClick={onMasters} disabled={!data}>{mastersLabel}</button>
        <button className="toolbar-btn" onClick={onAiAssist}>{t.btnAi}</button>
        <button className="toolbar-btn" onClick={onHelp}>{t.btnHelp}</button>
      </div>

      <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
        <button className="toolbar-btn" onClick={toggleTheme} title={theme === 'light' ? t.themeDark : t.themeLight}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button className="toolbar-btn" onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}>
          {locale === 'ja' ? 'EN' : 'JA'}
        </button>
      </div>
    </div>
  );
}
