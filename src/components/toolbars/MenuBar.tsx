import { useEditorStore, useProjectStore } from '@/app/store';
import type { EditorTool } from '@/app/store';
import { useI18n } from '@/i18n';
import { getAllEntityBounds, getSelectionBounds } from '@/domain/structural/editTransform';
import { useFileActions } from './useFileActions';
import { isEntityLayerInteractive } from '@/domain/rendering/layerLock';

interface Props {
  openMenu: string | null;
  toggleMenu: (name: string) => void;
  closeMenu: () => void;
  onNew: () => void;
  onRecent: () => void;
  onExport: () => void;
  onMasters: () => void;
  onAiAssist: () => void;
  onHelp: () => void;
  onTransform: () => void;
  onPrintPreview: () => void;
}

export function MenuBar({
  openMenu,
  toggleMenu,
  closeMenu,
  onNew,
  onRecent,
  onExport,
  onMasters,
  onAiAssist,
  onHelp,
  onTransform,
  onPrintPreview,
}: Props) {
  const data = useProjectStore((state) => state.data);
  const isDirty = useProjectStore((state) => state.isDirty);
  const viewMode = useEditorStore((state) => state.viewMode);
  const setViewMode = useEditorStore((state) => state.setViewMode);
  const activeTool = useEditorStore((state) => state.activeTool);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const activeStory = useEditorStore((state) => state.activeStory);
  const layerLocked = useEditorStore((state) => state.layerLocked);
  const layerVisibility = useEditorStore((state) => state.layerVisibility);
  const { t, locale } = useI18n();
  const mastersLabel = locale === 'ja' ? 'マスタ' : 'Masters';
  const importDxfLabel = locale === 'ja' ? 'DXF取込' : 'DXF Import';
  const importIfcLabel = locale === 'ja' ? 'IFC取込' : 'IFC Import';
  const transformLabel = locale === 'ja' ? '変形' : 'Transform';
  const xrefLabel = locale === 'ja' ? '外部参照' : 'Xref';
  const recentLabel = locale === 'ja' ? '最近のプロジェクト' : 'Recent projects';

  const {
    handleImportXref,
    handleOpen,
    handleSave,
    handleSample,
    handleImportDxf,
    handleImportIfc,
    importBusy,
    importProgress,
    saveBusy,
    cancelImport,
  } = useFileActions();
  const importStatus = importBusy ? ` (${Math.max(1, Math.round(importProgress * 100))}%)` : '';

  const handleUndo = () => useProjectStore.temporal.getState().undo();
  const handleRedo = () => useProjectStore.temporal.getState().redo();
  const transformableIds = data
    ? selectedIds.filter((id) =>
        isEntityLayerInteractive(data, id, layerLocked, layerVisibility),
      )
    : [];
  const canTransform = Boolean(
    data &&
      transformableIds.length > 0 &&
      getSelectionBounds(data, transformableIds),
  );

  const menuItem = (label: string, onClick: () => void, disabled?: boolean) => (
    <button
      type="button"
      className="dropdown-item"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        closeMenu();
        onClick();
      }}
    >
      {label}
    </button>
  );

  const drawToolItem = (tool: EditorTool, label: string) => (
    <button
      type="button"
      className={`dropdown-item ${activeTool === tool ? 'active' : ''}`}
      role="menuitemradio"
      aria-checked={activeTool === tool}
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
          aria-haspopup="menu"
          aria-expanded={openMenu === 'file'}
        >
          {t.menuFile}
        </button>
        {openMenu === 'file' && (
          <div className="dropdown-menu" role="menu">
            {menuItem(t.fileNew, onNew, importBusy)}
            {menuItem(`${t.fileOpen}${importStatus}`, handleOpen, importBusy)}
            {menuItem(recentLabel, onRecent, importBusy)}
            {menuItem(
              `${t.fileSave}${isDirty ? ' *' : ''}${saveBusy ? '…' : ''}`,
              handleSave,
              !data || saveBusy,
            )}
            {menuItem(t.fileSample, handleSample, importBusy)}
            <div className="dropdown-divider" role="separator" />
            {menuItem(`${importIfcLabel}${importStatus}`, handleImportIfc, importBusy)}
            {menuItem(`${importDxfLabel}${importStatus}`, handleImportDxf, !data || importBusy)}
            {menuItem(xrefLabel, handleImportXref, !data || importBusy)}
            {importBusy &&
              menuItem(locale === 'ja' ? '取込をキャンセル' : 'Cancel import', cancelImport)}
            <div className="dropdown-divider" role="separator" />
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
          aria-haspopup="menu"
          aria-expanded={openMenu === 'edit'}
        >
          {t.menuEdit}
        </button>
        {openMenu === 'edit' && (
          <div className="dropdown-menu" role="menu">
            {menuItem(t.editUndo, handleUndo, !data)}
            {menuItem(t.editRedo, handleRedo, !data)}
            <div className="dropdown-divider" role="separator" />
            {menuItem(transformLabel, onTransform, !canTransform)}
          </div>
        )}
      </div>

      {/* Draw */}
      <div className="dropdown-wrapper">
        <button
          className={`toolbar-btn menu-trigger ${openMenu === 'draw' ? 'open' : ''}`}
          onClick={() => toggleMenu('draw')}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'draw'}
        >
          {t.menuDraw}
        </button>
        {openMenu === 'draw' && (
          <div className="dropdown-menu" role="menu">
            {drawToolItem('column', t.toolColumn)}
            {drawToolItem('beam', t.toolBeam)}
            {drawToolItem('wall', t.toolWall)}
            {drawToolItem('slab', t.toolSlab)}
            {drawToolItem('opening', t.layerOpening)}
            <div className="dropdown-divider" role="separator" />
            {drawToolItem('dimension', t.toolDimension)}
            {drawToolItem('annotation', t.toolAnnotation)}
            {drawToolItem('xline', t.toolXline)}
            {drawToolItem('spline', t.toolSpline)}
            <div className="dropdown-divider" role="separator" />
            {drawToolItem('trim', t.toolTrim)}
            {drawToolItem('extend', t.toolExtend)}
            {drawToolItem('fillet', t.toolFillet)}
          </div>
        )}
      </div>

      {/* View */}
      <div className="dropdown-wrapper">
        <button
          className={`toolbar-btn menu-trigger ${openMenu === 'view' ? 'open' : ''}`}
          onClick={() => toggleMenu('view')}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'view'}
        >
          {t.menuView}
        </button>
        {openMenu === 'view' && (
          <div className="dropdown-menu" role="menu">
            <button
              className={`dropdown-item ${viewMode === '2d' ? 'active' : ''}`}
              role="menuitemradio"
              aria-checked={viewMode === '2d'}
              onClick={() => {
                closeMenu();
                setViewMode('2d');
              }}
            >
              {t.view2d}
            </button>
            <button
              className={`dropdown-item ${viewMode === '3d' ? 'active' : ''}`}
              role="menuitemradio"
              aria-checked={viewMode === '3d'}
              onClick={() => {
                closeMenu();
                setViewMode('3d');
              }}
            >
              {t.view3d}
            </button>
            <div className="dropdown-divider" role="separator" />
            {menuItem(
              t.zoomExtents,
              () => {
                if (!data) return;
                const el = document.querySelector('svg');
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const allBounds = getAllEntityBounds(data, activeStory);
                if (!allBounds) return;
                useEditorStore.getState().zoomToFit(allBounds, rect.width, rect.height);
              },
              !data,
            )}
            {menuItem(
              t.zoomSelection,
              () => {
                if (!data) return;
                const el = document.querySelector('svg');
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const bounds = getSelectionBounds(data, selectedIds);
                if (!bounds) return;
                useEditorStore.getState().zoomToFit(
                  {
                    minX: bounds.min.x,
                    minY: bounds.min.y,
                    maxX: bounds.max.x,
                    maxY: bounds.max.y,
                  },
                  rect.width,
                  rect.height,
                );
              },
              selectedIds.length === 0 || !data,
            )}
          </div>
        )}
      </div>

      {/* Tools */}
      <div className="dropdown-wrapper">
        <button
          className={`toolbar-btn menu-trigger ${openMenu === 'tools' ? 'open' : ''}`}
          onClick={() => toggleMenu('tools')}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'tools'}
        >
          {t.menuTools}
        </button>
        {openMenu === 'tools' && (
          <div className="dropdown-menu" role="menu">
            {menuItem(mastersLabel, onMasters, !data)}
            {menuItem(t.btnAi, onAiAssist)}
            {menuItem(t.btnHelp, onHelp)}
          </div>
        )}
      </div>
    </div>
  );
}
