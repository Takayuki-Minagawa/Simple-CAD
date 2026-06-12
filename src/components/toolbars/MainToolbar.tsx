import { useState } from 'react';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { drawingTemplates } from '@/domain/templates/drawingTemplates';
import { MenuBar } from './MenuBar';
import { ToolButtonGroups } from './ToolButtonGroups';
import { TemplatePickerDialog } from './TemplatePickerDialog';
import { useMenuState } from './useMenuState';

interface Props {
  onExport: () => void;
  onMasters: () => void;
  onAiAssist: () => void;
  onHelp: () => void;
  onTransform: () => void;
  onPrintPreview: () => void;
}

export function MainToolbar({ onExport, onMasters, onAiAssist, onHelp, onTransform, onPrintPreview }: Props) {
  const { isDirty, loadProject, newProject } = useProjectStore();
  const { theme, toggleTheme } = useEditorStore();
  const { t, locale, setLocale } = useI18n();

  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const { openMenu, closeMenu, toggleMenu, menuBarRef } = useMenuState();

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

  return (
    <div className="main-toolbar" ref={menuBarRef}>
      {/* ── Dropdown Menus ── */}
      <MenuBar
        openMenu={openMenu}
        toggleMenu={toggleMenu}
        closeMenu={closeMenu}
        onNew={handleNew}
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
        <button className="toolbar-btn" onClick={toggleTheme} title={theme === 'light' ? t.themeDark : t.themeLight}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button className="toolbar-btn" onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}>
          {locale === 'ja' ? 'EN' : 'JA'}
        </button>
      </div>

      {/* Template Picker Dialog */}
      {showTemplatePicker && (
        <TemplatePickerDialog onSelect={handleTemplateSelect} onClose={() => setShowTemplatePicker(false)} />
      )}
    </div>
  );
}
