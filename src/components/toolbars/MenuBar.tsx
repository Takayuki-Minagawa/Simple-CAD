import { useEditorStore, useProjectStore } from '@/app/store';
import type { EditorTool } from '@/app/store';
import { useI18n } from '@/i18n';
import { getAllEntityBounds, getSelectionBounds } from '@/domain/structural/editTransform';
import { useFileActions } from './useFileActions';

interface Props {
  openMenu: string | null;
  toggleMenu: (name: string) => void;
  closeMenu: () => void;
  onNew: () => void;
  onExport: () => void;
  onMasters: () => void;
  onAiAssist: () => void;
  onHelp: () => void;
  onTransform: () => void;
  onPrintPreview: () => void;
}

export function MenuBar({ openMenu, toggleMenu, closeMenu, onNew, onExport, onMasters, onAiAssist, onHelp, onTransform, onPrintPreview }: Props) {
  const { data, isDirty } = useProjectStore();
  const { viewMode, setViewMode, activeTool, setActiveTool, setSelectedIds, selectedIds, activeStory } =
    useEditorStore();
  const { t, locale } = useI18n();
  const mastersLabel = locale === 'ja' ? 'マスタ' : 'Masters';
  const importDxfLabel = locale === 'ja' ? 'DXF取込' : 'DXF Import';
  const importIfcLabel = locale === 'ja' ? 'IFC取込' : 'IFC Import';
  const transformLabel = locale === 'ja' ? '変形' : 'Transform';
  const xrefLabel = locale === 'ja' ? '外部参照' : 'Xref';

  const { handleImportXref, handleOpen, handleSave, handleSample, handleImportDxf, handleImportIfc } = useFileActions();

  const handleUndo = () => useProjectStore.temporal.getState().undo();
  const handleRedo = () => useProjectStore.temporal.getState().redo();

  const menuItem = (label: string, onClick: () => void, disabled?: boolean) => (
    <button
      className="dropdown-item"
      disabled={disabled}
      onClick={() => { closeMenu(); onClick(); }}
    >
      {label}
    </button>
  );

  const drawToolItem = (tool: EditorTool, label: string) => (
    <button
      className={`dropdown-item ${activeTool === tool ? 'active' : ''}`}
      onClick={() => {
        closeMenu();
        setActiveTool(tool);
        if (tool !== 'select') setSelectedIds([]);
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="toolbar-group menu-bar-group">
      {/* File */}
      <div className="dropdown-wrapper">
        <button
          className={`toolbar-btn menu-trigger ${openMenu === 'file' ? 'open' : ''}`}
          onClick={() => toggleMenu('file')}
        >
          {t.menuFile}
        </button>
        {openMenu === 'file' && (
          <div className="dropdown-menu">
            {menuItem(t.fileNew, onNew)}
            {menuItem(t.fileOpen, handleOpen)}
            {menuItem(`${t.fileSave}${isDirty ? ' *' : ''}`, handleSave, !data)}
            {menuItem(t.fileSample, handleSample)}
            <div className="dropdown-divider" />
            {menuItem(importIfcLabel, handleImportIfc)}
            {menuItem(importDxfLabel, handleImportDxf, !data)}
            {menuItem(xrefLabel, handleImportXref, !data)}
            <div className="dropdown-divider" />
            {menuItem(t.fileExport, onExport, !data)}
            {menuItem(t.printPreview, onPrintPreview, !data)}
          </div>
        )}
      </div>

      {/* Edit */}
      <div className="dropdown-wrapper">
        <button
          className={`toolbar-btn menu-trigger ${openMenu === 'edit' ? 'open' : ''}`}
          onClick={() => toggleMenu('edit')}
        >
          {t.menuEdit}
        </button>
        {openMenu === 'edit' && (
          <div className="dropdown-menu">
            {menuItem(t.editUndo, handleUndo, !data)}
            {menuItem(t.editRedo, handleRedo, !data)}
            <div className="dropdown-divider" />
            {menuItem(transformLabel, onTransform, selectedIds.length === 0)}
          </div>
        )}
      </div>

      {/* Draw */}
      <div className="dropdown-wrapper">
        <button
          className={`toolbar-btn menu-trigger ${openMenu === 'draw' ? 'open' : ''}`}
          onClick={() => toggleMenu('draw')}
        >
          {t.menuDraw}
        </button>
        {openMenu === 'draw' && (
          <div className="dropdown-menu">
            {drawToolItem('column', t.toolColumn)}
            {drawToolItem('beam', t.toolBeam)}
            {drawToolItem('wall', t.toolWall)}
            {drawToolItem('slab', t.toolSlab)}
            <div className="dropdown-divider" />
            {drawToolItem('dimension', t.toolDimension)}
            {drawToolItem('annotation', t.toolAnnotation)}
            {drawToolItem('xline', t.toolXline)}
            {drawToolItem('spline', t.toolSpline)}
            <div className="dropdown-divider" />
            {drawToolItem('trim', t.toolTrim)}
            {drawToolItem('extend', t.toolExtend)}
          </div>
        )}
      </div>

      {/* View */}
      <div className="dropdown-wrapper">
        <button
          className={`toolbar-btn menu-trigger ${openMenu === 'view' ? 'open' : ''}`}
          onClick={() => toggleMenu('view')}
        >
          {t.menuView}
        </button>
        {openMenu === 'view' && (
          <div className="dropdown-menu">
            <button
              className={`dropdown-item ${viewMode === '2d' ? 'active' : ''}`}
              onClick={() => { closeMenu(); setViewMode('2d'); }}
            >
              {t.view2d}
            </button>
            <button
              className={`dropdown-item ${viewMode === '3d' ? 'active' : ''}`}
              onClick={() => { closeMenu(); setViewMode('3d'); }}
            >
              {t.view3d}
            </button>
            <div className="dropdown-divider" />
            {menuItem(t.zoomExtents, () => {
              if (!data) return;
              const el = document.querySelector('svg');
              if (!el) return;
              const rect = el.getBoundingClientRect();
              const allBounds = getAllEntityBounds(data, activeStory);
              if (!allBounds) return;
              useEditorStore.getState().zoomToFit(allBounds, rect.width, rect.height);
            }, !data)}
            {menuItem(t.zoomSelection, () => {
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
            }, selectedIds.length === 0 || !data)}
          </div>
        )}
      </div>

      {/* Tools */}
      <div className="dropdown-wrapper">
        <button
          className={`toolbar-btn menu-trigger ${openMenu === 'tools' ? 'open' : ''}`}
          onClick={() => toggleMenu('tools')}
        >
          {t.menuTools}
        </button>
        {openMenu === 'tools' && (
          <div className="dropdown-menu">
            {menuItem(mastersLabel, onMasters, !data)}
            {menuItem(t.btnAi, onAiAssist)}
            {menuItem(t.btnHelp, onHelp)}
          </div>
        )}
      </div>
    </div>
  );
}
