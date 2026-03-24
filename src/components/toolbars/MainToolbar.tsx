import { useState } from 'react';
import { useEditorStore, useProjectStore } from '@/app/store';
import type { EditorTool } from '@/app/store';
import { useI18n } from '@/i18n';
import { openDxfFile, openIfcFile, openJsonFile, saveFile } from '@/libs/fileSystem';
import { importProjectJson } from '@/domain/import/jsonImport';
import { importDxf } from '@/domain/import/dxfImport';
import { exportProjectJson } from '@/domain/export/jsonExport';
import { importIfc } from '@/domain/integration/ifc';
import { importStructuralAnalysisJson, STRUCTURAL_ANALYSIS_SCHEMA } from '@/domain/integration/structuralAnalysisJson';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { getAllEntityBounds, getSelectionBounds } from '@/domain/structural/editTransform';
import { drawingTemplates } from '@/domain/templates/drawingTemplates';

interface Props {
  onExport: () => void;
  onMasters: () => void;
  onAiAssist: () => void;
  onHelp: () => void;
  onTransform: () => void;
  onPrintPreview: () => void;
}

export function MainToolbar({ onExport, onMasters, onAiAssist, onHelp, onTransform, onPrintPreview }: Props) {
  const { data, isDirty, fileHandle, loadProject, newProject, setFileHandle, markClean, addAnnotations, addExternalRef } =
    useProjectStore();
  const { viewMode, setViewMode, activeTool, setActiveTool, setSelectedIds, selectedIds, theme, toggleTheme, activeStory } =
    useEditorStore();
  const { t, locale, setLocale } = useI18n();
  const mastersLabel = locale === 'ja' ? 'マスタ' : 'Masters';
  const importDxfLabel = locale === 'ja' ? 'DXF取込' : 'DXF Import';
  const importIfcLabel = locale === 'ja' ? 'IFC取込' : 'IFC Import';
  const transformLabel = locale === 'ja' ? '変形' : 'Transform';
  const xrefLabel = locale === 'ja' ? '外部参照' : 'Xref';

  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const handleNew = () => {
    if (isDirty && !confirm(t.confirmUnsaved)) return;
    setShowTemplatePicker(true);
  };

  const handleTemplateSelect = (templateKey: string | null) => {
    setShowTemplatePicker(false);
    if (templateKey === null) {
      // Blank project (default)
      newProject();
      return;
    }
    const template = drawingTemplates.find((t) => t.key === templateKey);
    if (template) {
      const projectData = template.create();
      loadProject(projectData);
    } else {
      newProject();
    }
  };

  const handleImportXref = async () => {
    if (!data) return;
    try {
      const result = await openJsonFile();
      const imported = importProjectJson(result.content);
      if (!imported.ok) {
        alert(imported.errors.map((e) => e.message).join('\n'));
        return;
      }
      const ref = {
        id: `xref-${Date.now()}`,
        name: imported.data.project.name || 'Xref',
        data: imported.data,
        offsetX: 0,
        offsetY: 0,
        visible: true,
      };
      addExternalRef(ref);
    } catch {
      // User cancelled
    }
  };

  const handleOpen = async () => {
    try {
      const result = await openJsonFile();
      let detectedSchema: string | null = null;
      try {
        const parsed = JSON.parse(result.content) as { schema?: unknown };
        detectedSchema = typeof parsed.schema === 'string' ? parsed.schema : null;
      } catch {
        // Let the dedicated importer surface the parse error.
      }

      const imported =
        detectedSchema === STRUCTURAL_ANALYSIS_SCHEMA
          ? importStructuralAnalysisJson(result.content)
          : importProjectJson(result.content);
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

  const handleImportIfc = async () => {
    try {
      const result = await openIfcFile();
      const imported = importIfc(result.content);
      if (!imported.ok) {
        alert(imported.errors.map((error) => error.message).join('\n'));
        return;
      }
      loadProject(imported.data);
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
        <button className="toolbar-btn" onClick={handleImportIfc}>{importIfcLabel}</button>
        <button className="toolbar-btn" onClick={handleImportDxf} disabled={!data}>{importDxfLabel}</button>
        <button className="toolbar-btn" onClick={handleImportXref} disabled={!data}>{xrefLabel}</button>
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleUndo} disabled={!data}>{t.editUndo}</button>
        <button className="toolbar-btn" onClick={handleRedo} disabled={!data}>{t.editRedo}</button>
        <button className="toolbar-btn" onClick={onTransform} disabled={selectedIds.length === 0}>
          {transformLabel}
        </button>
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
        {toolBtn('trim', t.toolTrim)}
        {toolBtn('extend', t.toolExtend)}
        {toolBtn('xline', t.toolXline)}
        {toolBtn('spline', t.toolSpline)}
      </div>

      <div className="toolbar-group">
        <button className={`toolbar-btn ${viewMode === '2d' ? 'active' : ''}`} onClick={() => setViewMode('2d')}>{t.view2d}</button>
        <button className={`toolbar-btn ${viewMode === '3d' ? 'active' : ''}`} onClick={() => setViewMode('3d')}>{t.view3d}</button>
        <button
          className="toolbar-btn"
          disabled={!data}
          title={t.zoomExtents}
          onClick={() => {
            if (!data) return;
            const el = document.querySelector('svg');
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const allBounds = getAllEntityBounds(data, activeStory);
            if (!allBounds) return;
            useEditorStore.getState().zoomToFit(allBounds, rect.width, rect.height);
          }}
        >
          {t.zoomExtents}
        </button>
        <button
          className="toolbar-btn"
          disabled={selectedIds.length === 0 || !data}
          title={t.zoomSelection}
          onClick={() => {
            if (!data) return;
            const el = document.querySelector('svg');
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const bounds = getSelectionBounds(data, selectedIds);
            if (!bounds) return;
            useEditorStore.getState().zoomToFit(
              { minX: bounds.min.x, minY: bounds.min.y, maxX: bounds.max.x, maxY: bounds.max.y },
              rect.width,
              rect.height,
            );
          }}
        >
          {t.zoomSelection}
        </button>
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onExport} disabled={!data}>{t.fileExport}</button>
        <button className="toolbar-btn" onClick={onPrintPreview} disabled={!data}>{t.printPreview}</button>
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

      {/* Template Picker Dialog */}
      {showTemplatePicker && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg-modal-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowTemplatePicker(false)}
        >
          <div
            style={{
              background: 'var(--bg-modal)',
              borderRadius: 8,
              padding: 24,
              minWidth: 340,
              maxWidth: 'min(500px, calc(100vw - 32px))',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              color: 'var(--text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>{t.templatePickerTitle}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>{t.templateSelectPrompt}</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {drawingTemplates.map((tmpl) => (
                <button
                  key={tmpl.key}
                  className="toolbar-btn"
                  style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13 }}
                  onClick={() => handleTemplateSelect(tmpl.key)}
                >
                  {locale === 'ja' ? tmpl.labelJa : tmpl.labelEn}
                </button>
              ))}
              <button
                className="toolbar-btn"
                style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13 }}
                onClick={() => handleTemplateSelect(null)}
              >
                {locale === 'ja' ? '空白プロジェクト' : 'Blank Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
