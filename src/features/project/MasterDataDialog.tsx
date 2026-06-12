import { useMemo, useState } from 'react';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import type { Material, Sheet } from '@/domain/structural/types';
import type { SectionKindDraft } from './masterDataHelpers';
import { buildNextStory, getLabels } from './masterDataHelpers';
import { StoriesSection } from './StoriesSection';
import { SheetsSection } from './SheetsSection';
import { MaterialsSection } from './MaterialsSection';
import { SectionsSection } from './SectionsSection';

interface Props {
  onClose: () => void;
}

export function MasterDataDialog({ onClose }: Props) {
  const data = useProjectStore((s) => s.data);
  const {
    addStory,
    updateStory,
    duplicateStory,
    addPlanSheet,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    addSection,
    updateSection,
    deleteSection,
    updateSheet,
    addViewport,
    removeViewport,
    updateViewport,
  } = useProjectStore();
  const { activeStory, setActiveStory } = useEditorStore();
  const { locale } = useI18n();
  const labels = useMemo(() => getLabels(locale), [locale]);

  const [newMaterial, setNewMaterial] = useState<Material>({
    id: 'MAT-NEW',
    name: locale === 'ja' ? '新規材料' : 'New Material',
    type: 'concrete',
  });
  const [newSectionKind, setNewSectionKind] = useState<SectionKindDraft>('rc_column_rect');
  const [newSectionId, setNewSectionId] = useState('SEC-NEW');
  const [newSectionWidth, setNewSectionWidth] = useState(300);
  const [newSectionDepth, setNewSectionDepth] = useState(600);
  const [newSectionThickness, setNewSectionThickness] = useState(180);

  if (!data) return null;

  const materialUsage = new Set(data.members.map((member) => member.materialId));
  const sectionUsage = new Set(data.members.map((member) => member.sectionId));
  const currentStory = data.stories.find((story) => story.id === activeStory) ?? data.stories[0];

  const handleAddStory = () => {
    const lastStory = data.stories[data.stories.length - 1];
    const nextStory = buildNextStory(lastStory, data.stories);
    addStory(nextStory);
    setActiveStory(nextStory.id);
  };

  const handleDuplicateStory = () => {
    if (!currentStory) return;
    const nextStory = buildNextStory(currentStory, data.stories);
    const createdId = duplicateStory(currentStory.id, nextStory);
    if (createdId) setActiveStory(createdId);
  };

  const handleAddSheet = () => {
    const targetStoryId = activeStory ?? data.stories[0]?.id;
    if (!targetStoryId) return;
    addPlanSheet(targetStoryId);
  };

  const handleAddMaterial = () => {
    if (!newMaterial.id.trim() || data.materials.some((item) => item.id === newMaterial.id.trim())) return;
    addMaterial({ ...newMaterial, id: newMaterial.id.trim(), name: newMaterial.name.trim() || newMaterial.id.trim() });
    setNewMaterial({
      id: `${newMaterial.id.trim()}-2`,
      name: locale === 'ja' ? '新規材料' : 'New Material',
      type: newMaterial.type,
    });
  };

  const handleAddSection = () => {
    const id = newSectionId.trim();
    if (!id || data.sections.some((item) => item.id === id)) return;
    switch (newSectionKind) {
      case 'rc_column_rect':
        addSection({ id, kind: newSectionKind, width: newSectionWidth, depth: newSectionDepth });
        break;
      case 'rc_beam_rect':
        addSection({ id, kind: newSectionKind, width: newSectionWidth, depth: newSectionDepth });
        break;
      case 'rc_slab':
        addSection({ id, kind: newSectionKind, thickness: newSectionThickness });
        break;
      case 'rc_wall':
        addSection({ id, kind: newSectionKind, thickness: newSectionThickness });
        break;
    }
    setNewSectionId(`${id}-2`);
  };

  const updateSheetTitleBlock = (sheet: Sheet, updates: NonNullable<Sheet['titleBlock']>) => {
    updateSheet(sheet.id, {
      titleBlock: {
        projectName: data.project.name,
        drawingTitle: sheet.name,
        ...sheet.titleBlock,
        ...updates,
      },
    });
  };

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          width: 920,
          maxWidth: '95vw',
          maxHeight: '86vh',
          background: 'var(--bg-modal)',
          color: 'var(--text-primary)',
          borderRadius: 10,
          boxShadow: '0 12px 48px rgba(0,0,0,0.28)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>{labels.title}</h3>
          <button
            className="toolbar-btn"
            style={{ background: 'var(--border-color)', color: 'var(--text-primary)', minHeight: 28 }}
            onClick={onClose}
          >
            {labels.close}
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 20, display: 'grid', gap: 20 }}>
          <StoriesSection
            stories={data.stories}
            activeStory={activeStory}
            currentStory={currentStory}
            labels={labels}
            onAddStory={handleAddStory}
            onDuplicateStory={handleDuplicateStory}
            onAddSheet={handleAddSheet}
            setActiveStory={setActiveStory}
            updateStory={updateStory}
          />

          <SheetsSection
            sheets={data.sheets}
            views={data.views}
            projectName={data.project.name}
            labels={labels}
            updateSheet={updateSheet}
            updateSheetTitleBlock={updateSheetTitleBlock}
            addViewport={addViewport}
            removeViewport={removeViewport}
            updateViewport={updateViewport}
          />

          <MaterialsSection
            materials={data.materials}
            materialUsage={materialUsage}
            labels={labels}
            newMaterial={newMaterial}
            setNewMaterial={setNewMaterial}
            onAddMaterial={handleAddMaterial}
            updateMaterial={updateMaterial}
            deleteMaterial={deleteMaterial}
          />

          <SectionsSection
            sections={data.sections}
            sectionUsage={sectionUsage}
            labels={labels}
            newSectionId={newSectionId}
            setNewSectionId={setNewSectionId}
            newSectionKind={newSectionKind}
            setNewSectionKind={setNewSectionKind}
            newSectionWidth={newSectionWidth}
            setNewSectionWidth={setNewSectionWidth}
            newSectionDepth={newSectionDepth}
            setNewSectionDepth={setNewSectionDepth}
            newSectionThickness={newSectionThickness}
            setNewSectionThickness={setNewSectionThickness}
            onAddSection={handleAddSection}
            updateSection={updateSection}
            deleteSection={deleteSection}
          />
        </div>
      </div>
    </div>
  );
}
