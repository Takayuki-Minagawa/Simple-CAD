import { lazy, Suspense, useState } from 'react';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { drawingTemplates } from '@/domain/templates/drawingTemplates';
import { MenuBar } from './MenuBar';
import { ToolButtonGroups } from './ToolButtonGroups';
import { useMenuState } from './useMenuState';
import { showConfirm } from '@/app/browserDialogs';
import { saveWorkspace, type RecentProjectRecord } from '@/libs/persistence';

const TemplatePickerDialog = lazy(() =>
  import('./TemplatePickerDialog').then((module) => ({ default: module.TemplatePickerDialog })),
);
const RecentProjectsDialog = lazy(() =>
  import('./RecentProjectsDialog').then((module) => ({ default: module.RecentProjectsDialog })),
);

interface Props {
  onExport: () => void;
  onMasters: () => void;
  onAiAssist: () => void;
  onHelp: () => void;
  onTransform: () => void;
  onPrintPreview: () => void;
}

export function MainToolbar({
  onExport,
  onMasters,
  onAiAssist,
  onHelp,
  onTransform,
  onPrintPreview,
}: Props) {
  const isDirty = useProjectStore((state) => state.isDirty);
  const loadProject = useProjectStore((state) => state.loadProject);
  const newProject = useProjectStore((state) => state.newProject);
  const theme = useEditorStore((state) => state.theme);
  const toggleTheme = useEditorStore((state) => state.toggleTheme);
  const { t, locale, setLocale } = useI18n();

  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showRecentProjects, setShowRecentProjects] = useState(false);
  const { openMenu, closeMenu, toggleMenu, menuBarRef } = useMenuState();

  const handleNew = () => {
    if (isDirty && !showConfirm(t.confirmUnsaved)) return;
    setShowTemplatePicker(true);
  };

  const handleTemplateSelect = async (templateKey: string | null) => {
    setShowTemplatePicker(false);
    if (templateKey === null) {
      // Blank project (default)
      newProject();
      const project = useProjectStore.getState().data;
      if (project) await saveWorkspace(project, false).catch(() => undefined);
      return;
    }
    const template = drawingTemplates.find((t) => t.key === templateKey);
    if (template) {
      const projectData = template.create();
      loadProject(projectData);
      await saveWorkspace(projectData, false).catch(() => undefined);
    } else {
      newProject();
      const project = useProjectStore.getState().data;
      if (project) await saveWorkspace(project, false).catch(() => undefined);
    }
  };

  const handleRecentOpen = async (record: RecentProjectRecord) => {
    if (isDirty && !showConfirm(t.confirmUnsaved)) return;
    loadProject(record.data);
    await saveWorkspace(record.data, false).catch(() => undefined);
    setShowRecentProjects(false);
  };

  return (
    <div className="main-toolbar" ref={menuBarRef}>
      {/* ── Dropdown Menus ── */}
      <MenuBar
        openMenu={openMenu}
        toggleMenu={toggleMenu}
        closeMenu={closeMenu}
        onNew={handleNew}
        onRecent={() => setShowRecentProjects(true)}
        onExport={onExport}
        onMasters={onMasters}
        onAiAssist={onAiAssist}
        onHelp={onHelp}
        onTransform={onTransform}
        onPrintPreview={onPrintPreview}
      />

      <ToolButtonGroups />

      {/* ── Right side: theme & locale ── */}
      <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
        <button
          className="toolbar-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? t.themeDark : t.themeLight}
          aria-label={theme === 'light' ? t.themeDark : t.themeLight}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button
          className="toolbar-btn"
          onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}
          aria-label={locale === 'ja' ? t.langEn : t.langJa}
        >
          {locale === 'ja' ? 'EN' : 'JA'}
        </button>
      </div>

      {/* Template Picker Dialog */}
      {showTemplatePicker && (
        <Suspense fallback={null}>
          <TemplatePickerDialog
            onSelect={handleTemplateSelect}
            onClose={() => setShowTemplatePicker(false)}
          />
        </Suspense>
      )}
      {showRecentProjects && (
        <Suspense fallback={null}>
          <RecentProjectsDialog
            onOpen={handleRecentOpen}
            onClose={() => setShowRecentProjects(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
