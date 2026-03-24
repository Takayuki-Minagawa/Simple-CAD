import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import type { Material, Section, Sheet, Story, TitleBlockTemplate, Viewport } from '@/domain/structural/types';

interface Props {
  onClose: () => void;
}

type SectionKindDraft = Section['kind'];

interface Labels {
  title: string;
  close: string;
  stories: string;
  addStory: string;
  duplicateStory: string;
  addSheet: string;
  activate: string;
  active: string;
  materials: string;
  sections: string;
  sheets: string;
  id: string;
  name: string;
  elevation: string;
  height: string;
  type: string;
  delete: string;
  inUse: string;
  paperSize: string;
  scale: string;
  template: string;
  projectName: string;
  drawingTitle: string;
  drawnBy: string;
  checkedBy: string;
  issueDate: string;
  revision: string;
  note: string;
  width: string;
  depth: string;
  thickness: string;
  kind: string;
  noSheets: string;
  addMaterial: string;
  addSection: string;
  viewports: string;
  addViewport: string;
  removeViewport: string;
  viewId: string;
  x: string;
  y: string;
}

const TEMPLATE_OPTIONS: TitleBlockTemplate[] = ['standard', 'compact', 'minimal'];
const MATERIAL_TYPES: Material['type'][] = ['concrete', 'steel', 'wood', 'other'];
const SECTION_KIND_OPTIONS: SectionKindDraft[] = ['rc_column_rect', 'rc_beam_rect', 'rc_slab', 'rc_wall'];
const PAPER_SIZES: Sheet['paperSize'][] = ['A0', 'A1', 'A2', 'A3', 'A4'];

function getLabels(locale: 'ja' | 'en'): Labels {
  if (locale === 'ja') {
    return {
      title: 'マスタ編集',
      close: '閉じる',
      stories: 'Stories',
      addStory: '階を追加',
      duplicateStory: 'アクティブ階を複製',
      addSheet: 'シート追加',
      activate: '表示',
      active: '編集中',
      materials: 'Materials',
      sections: 'Sections',
      sheets: 'Sheets / Title Block',
      id: 'ID',
      name: '名称',
      elevation: 'EL',
      height: '高さ',
      type: '種別',
      delete: '削除',
      inUse: '使用中',
      paperSize: '用紙',
      scale: '縮尺',
      template: 'テンプレート',
      projectName: '工事名',
      drawingTitle: '図面名',
      drawnBy: '作図',
      checkedBy: '確認',
      issueDate: '日付',
      revision: '改訂',
      note: '備考',
      width: '幅',
      depth: 'せい',
      thickness: '厚さ',
      kind: '区分',
      noSheets: 'シートがありません。アクティブ階から追加してください。',
      addMaterial: '材料追加',
      addSection: '断面追加',
      viewports: 'ビューポート',
      addViewport: 'ビューポート追加',
      removeViewport: '削除',
      viewId: 'ビューID',
      x: 'X',
      y: 'Y',
    };
  }

  return {
    title: 'Masters',
    close: 'Close',
    stories: 'Stories',
    addStory: 'Add Story',
    duplicateStory: 'Duplicate Active Story',
    addSheet: 'Add Sheet',
    activate: 'Activate',
    active: 'Active',
    materials: 'Materials',
    sections: 'Sections',
    sheets: 'Sheets / Title Block',
    id: 'ID',
    name: 'Name',
    elevation: 'Elevation',
    height: 'Height',
    type: 'Type',
    delete: 'Delete',
    inUse: 'In use',
    paperSize: 'Paper',
    scale: 'Scale',
    template: 'Template',
    projectName: 'Project',
    drawingTitle: 'Drawing',
    drawnBy: 'Drawn by',
    checkedBy: 'Checked by',
    issueDate: 'Issue date',
    revision: 'Revision',
    note: 'Note',
    width: 'Width',
    depth: 'Depth',
    thickness: 'Thickness',
    kind: 'Kind',
    noSheets: 'No sheets yet. Add one from the active story.',
    addMaterial: 'Add Material',
    addSection: 'Add Section',
    viewports: 'Viewports',
    addViewport: 'Add Viewport',
    removeViewport: 'Remove',
    viewId: 'View ID',
    x: 'X',
    y: 'Y',
  };
}

function buildNextStory(source?: Story, existing?: Story[]): Story {
  const stories = existing ?? [];
  if (!source) {
    return { id: '1F', name: '1F', elevation: 0, height: 3000 };
  }

  const match = source.id.match(/^(\d+)F$/i);
  const nextIndex = match ? Number.parseInt(match[1], 10) + 1 : stories.length + 1;
  const nextId = match ? `${nextIndex}F` : `${source.id}-COPY`;
  return {
    id: nextId,
    name: nextId,
    elevation: source.elevation + source.height,
    height: source.height,
  };
}

function sectionKindLabel(kind: Section['kind']) {
  switch (kind) {
    case 'rc_column_rect':
      return 'RC Column';
    case 'rc_beam_rect':
      return 'RC Beam';
    case 'rc_slab':
      return 'RC Slab';
    case 'rc_wall':
      return 'RC Wall';
  }
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
          <section>
            <SectionHeader
              title={labels.stories}
              actions={
                <>
                  <button className="toolbar-btn" onClick={handleAddStory}>{labels.addStory}</button>
                  <button className="toolbar-btn" onClick={handleDuplicateStory} disabled={!currentStory}>
                    {labels.duplicateStory}
                  </button>
                  <button className="toolbar-btn" onClick={handleAddSheet} disabled={!currentStory}>
                    {labels.addSheet}
                  </button>
                </>
              }
            />
            <div style={{ display: 'grid', gap: 8 }}>
              {data.stories.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  isActive={story.id === activeStory}
                  labels={labels}
                  onActivate={() => setActiveStory(story.id)}
                  onChange={(updates) => updateStory(story.id, updates)}
                />
              ))}
            </div>
          </section>

          <section>
            <SectionHeader title={labels.sheets} />
            <div style={{ display: 'grid', gap: 10 }}>
              {data.sheets.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{labels.noSheets}</div>
              )}
              {data.sheets.map((sheet) => (
                <div
                  key={sheet.id}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: 12,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px 90px', gap: 8 }}>
                    <ReadonlyField label={labels.id} value={sheet.id} />
                    <TextField label={labels.name} value={sheet.name} onChange={(value) => updateSheet(sheet.id, { name: value })} />
                    <SelectField
                      label={labels.paperSize}
                      value={sheet.paperSize}
                      options={PAPER_SIZES}
                      onChange={(value) => updateSheet(sheet.id, { paperSize: value as Sheet['paperSize'] })}
                    />
                    <TextField label={labels.scale} value={sheet.scale} onChange={(value) => updateSheet(sheet.id, { scale: value })} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: 8 }}>
                    <SelectField
                      label={labels.template}
                      value={sheet.titleBlockTemplate ?? 'standard'}
                      options={TEMPLATE_OPTIONS}
                      onChange={(value) => updateSheet(sheet.id, { titleBlockTemplate: value as TitleBlockTemplate })}
                    />
                    <TextField
                      label={labels.projectName}
                      value={sheet.titleBlock?.projectName ?? data.project.name}
                      onChange={(value) => updateSheetTitleBlock(sheet, { projectName: value })}
                    />
                    <TextField
                      label={labels.drawingTitle}
                      value={sheet.titleBlock?.drawingTitle ?? sheet.name}
                      onChange={(value) => updateSheetTitleBlock(sheet, { drawingTitle: value })}
                    />
                    <TextField
                      label={labels.issueDate}
                      value={sheet.titleBlock?.issueDate ?? ''}
                      onChange={(value) => updateSheetTitleBlock(sheet, { issueDate: value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                    <TextField
                      label={labels.drawnBy}
                      value={sheet.titleBlock?.drawnBy ?? ''}
                      onChange={(value) => updateSheetTitleBlock(sheet, { drawnBy: value })}
                    />
                    <TextField
                      label={labels.checkedBy}
                      value={sheet.titleBlock?.checkedBy ?? ''}
                      onChange={(value) => updateSheetTitleBlock(sheet, { checkedBy: value })}
                    />
                    <TextField
                      label={labels.revision}
                      value={sheet.titleBlock?.revision ?? ''}
                      onChange={(value) => updateSheetTitleBlock(sheet, { revision: value })}
                    />
                    <TextField
                      label={labels.note}
                      value={sheet.titleBlock?.note ?? ''}
                      onChange={(value) => updateSheetTitleBlock(sheet, { note: value })}
                    />
                  </div>

                  {/* Viewports */}
                  <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 8, marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{labels.viewports}</span>
                      <button
                        className="toolbar-btn"
                        style={{ fontSize: 11 }}
                        onClick={() => {
                          const firstViewId = data.views[0]?.id ?? '';
                          if (!firstViewId) return;
                          const vp: Viewport = {
                            id: `VP-${sheet.id}-${(sheet.viewports?.length ?? 0) + 1}`,
                            sheetId: sheet.id,
                            viewId: firstViewId,
                            x: 30,
                            y: 30,
                            width: 200,
                            height: 150,
                            scale: sheet.scale,
                          };
                          addViewport(vp);
                        }}
                      >
                        {labels.addViewport}
                      </button>
                    </div>
                    {(sheet.viewports ?? []).map((vp) => (
                      <div key={vp.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 60px 60px 70px 70px auto', gap: 6, alignItems: 'end', marginBottom: 4 }}>
                        <ReadonlyField label={labels.id} value={vp.id} />
                        <SelectField
                          label={labels.viewId}
                          value={vp.viewId}
                          options={data.views.map((v) => v.id)}
                          onChange={(value) => updateViewport(vp.id, { viewId: value })}
                        />
                        <NumberField label={labels.x} value={vp.x} onChange={(value) => updateViewport(vp.id, { x: value })} />
                        <NumberField label={labels.y} value={vp.y} onChange={(value) => updateViewport(vp.id, { y: value })} />
                        <NumberField label={labels.width} value={vp.width} onChange={(value) => updateViewport(vp.id, { width: value })} />
                        <NumberField label={labels.height} value={vp.height} onChange={(value) => updateViewport(vp.id, { height: value })} />
                        <DeleteButton label={labels.removeViewport} onClick={() => removeViewport(vp.id)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionHeader title={labels.materials} />
            <div style={{ display: 'grid', gap: 8 }}>
              {data.materials.map((material) => (
                <div
                  key={material.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '160px minmax(0, 1fr) 140px auto',
                    gap: 8,
                    alignItems: 'end',
                  }}
                >
                  <ReadonlyField label={labels.id} value={material.id} />
                  <TextField label={labels.name} value={material.name} onChange={(value) => updateMaterial(material.id, { name: value })} />
                  <SelectField
                    label={labels.type}
                    value={material.type}
                    options={MATERIAL_TYPES}
                    onChange={(value) => updateMaterial(material.id, { type: value as Material['type'] })}
                  />
                  <DeleteButton
                    label={labels.delete}
                    disabled={materialUsage.has(material.id)}
                    hint={materialUsage.has(material.id) ? labels.inUse : undefined}
                    onClick={() => deleteMaterial(material.id)}
                  />
                </div>
              ))}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px minmax(0, 1fr) 140px auto',
                  gap: 8,
                  alignItems: 'end',
                  paddingTop: 8,
                  borderTop: '1px dashed var(--border-color)',
                }}
              >
                <TextField label={labels.id} value={newMaterial.id} onChange={(value) => setNewMaterial((prev) => ({ ...prev, id: value }))} />
                <TextField label={labels.name} value={newMaterial.name} onChange={(value) => setNewMaterial((prev) => ({ ...prev, name: value }))} />
                <SelectField
                  label={labels.type}
                  value={newMaterial.type}
                  options={MATERIAL_TYPES}
                  onChange={(value) => setNewMaterial((prev) => ({ ...prev, type: value as Material['type'] }))}
                />
                <button className="toolbar-btn" onClick={handleAddMaterial}>{labels.addMaterial}</button>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader title={labels.sections} />
            <div style={{ display: 'grid', gap: 8 }}>
              {data.sections.map((section) => (
                <div
                  key={section.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '160px 120px repeat(2, minmax(0, 1fr)) auto',
                    gap: 8,
                    alignItems: 'end',
                  }}
                >
                  <ReadonlyField label={labels.id} value={section.id} />
                  <ReadonlyField label={labels.kind} value={sectionKindLabel(section.kind)} />
                  {'width' in section ? (
                    <>
                      <NumberField
                        label={labels.width}
                        value={section.width}
                        onChange={(value) => updateSection(section.id, { width: value } as Partial<Section>)}
                      />
                      <NumberField
                        label={labels.depth}
                        value={section.depth}
                        onChange={(value) => updateSection(section.id, { depth: value } as Partial<Section>)}
                      />
                    </>
                  ) : (
                    <>
                      <NumberField
                        label={labels.thickness}
                        value={section.thickness}
                        onChange={(value) => updateSection(section.id, { thickness: value } as Partial<Section>)}
                      />
                      <div />
                    </>
                  )}
                  <DeleteButton
                    label={labels.delete}
                    disabled={sectionUsage.has(section.id)}
                    hint={sectionUsage.has(section.id) ? labels.inUse : undefined}
                    onClick={() => deleteSection(section.id)}
                  />
                </div>
              ))}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 120px repeat(2, minmax(0, 1fr)) auto',
                  gap: 8,
                  alignItems: 'end',
                  paddingTop: 8,
                  borderTop: '1px dashed var(--border-color)',
                }}
              >
                <TextField label={labels.id} value={newSectionId} onChange={setNewSectionId} />
                <SelectField
                  label={labels.kind}
                  value={newSectionKind}
                  options={SECTION_KIND_OPTIONS}
                  onChange={(value) => setNewSectionKind(value as SectionKindDraft)}
                />
                {newSectionKind === 'rc_column_rect' || newSectionKind === 'rc_beam_rect' ? (
                  <>
                    <NumberField label={labels.width} value={newSectionWidth} onChange={setNewSectionWidth} />
                    <NumberField label={labels.depth} value={newSectionDepth} onChange={setNewSectionDepth} />
                  </>
                ) : (
                  <>
                    <NumberField label={labels.thickness} value={newSectionThickness} onChange={setNewSectionThickness} />
                    <div />
                  </>
                )}
                <button className="toolbar-btn" onClick={handleAddSection}>{labels.addSection}</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <h4 style={{ margin: 0, fontSize: 14, color: 'var(--accent)' }}>{title}</h4>
      <div style={{ display: 'flex', gap: 6 }}>{actions}</div>
    </div>
  );
}

function StoryCard({
  story,
  isActive,
  labels,
  onActivate,
  onChange,
}: {
  story: Story;
  isActive: boolean;
  labels: Labels;
  onActivate: () => void;
  onChange: (updates: Partial<Story>) => void;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: 12,
        display: 'grid',
        gridTemplateColumns: '160px minmax(0, 1fr) 120px 120px auto',
        gap: 8,
        alignItems: 'end',
      }}
    >
      <ReadonlyField label={labels.id} value={story.id} />
      <TextField label={labels.name} value={story.name} onChange={(value) => onChange({ name: value })} />
      <NumberField label={labels.elevation} value={story.elevation} onChange={(value) => onChange({ elevation: value })} />
      <NumberField label={labels.height} value={story.height} onChange={(value) => onChange({ height: value })} />
      <button
        className={`toolbar-btn ${isActive ? 'active' : ''}`}
        onClick={onActivate}
        style={{ alignSelf: 'stretch' }}
      >
        {isActive ? labels.active : labels.activate}
      </button>
    </div>
  );
}

function FieldShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </label>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <FieldShell label={label}>
      <div
        style={{
          minHeight: 28,
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          padding: '6px 8px',
          background: 'var(--bg-secondary)',
          fontFamily: 'Menlo, Consolas, monospace',
          fontSize: 12,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </FieldShell>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FieldShell label={label}>
      <input className="prop-input" style={{ maxWidth: '100%' }} value={value} onChange={(event) => onChange(event.target.value)} />
    </FieldShell>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <FieldShell label={label}>
      <input
        className="prop-input"
        style={{ maxWidth: '100%' }}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </FieldShell>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <FieldShell label={label}>
      <select className="prop-select" style={{ maxWidth: '100%' }} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function DeleteButton({
  label,
  disabled,
  hint,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 80 }}>
      <div style={{ height: 15, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>{hint}</div>
      <button className="toolbar-btn" onClick={onClick} disabled={disabled}>
        {label}
      </button>
    </div>
  );
}
