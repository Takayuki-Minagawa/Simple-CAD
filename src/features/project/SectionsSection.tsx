import type { Dispatch, SetStateAction } from 'react';
import type { Section } from '@/domain/structural/types';
import type { Labels, SectionKindDraft } from './masterDataHelpers';
import { SECTION_KIND_OPTIONS, sectionKindLabel } from './masterDataHelpers';
import { DeleteButton, NumberField, ReadonlyField, SectionHeader, SelectField, TextField } from './masterDataFields';

interface SectionsSectionProps {
  sections: Section[];
  sectionUsage: Set<string>;
  labels: Labels;
  newSectionId: string;
  setNewSectionId: Dispatch<SetStateAction<string>>;
  newSectionKind: SectionKindDraft;
  setNewSectionKind: Dispatch<SetStateAction<SectionKindDraft>>;
  newSectionWidth: number;
  setNewSectionWidth: Dispatch<SetStateAction<number>>;
  newSectionDepth: number;
  setNewSectionDepth: Dispatch<SetStateAction<number>>;
  newSectionThickness: number;
  setNewSectionThickness: Dispatch<SetStateAction<number>>;
  onAddSection: () => void;
  updateSection: (id: string, updates: Partial<Section>) => void;
  deleteSection: (id: string) => void;
}

export function SectionsSection({
  sections,
  sectionUsage,
  labels,
  newSectionId,
  setNewSectionId,
  newSectionKind,
  setNewSectionKind,
  newSectionWidth,
  setNewSectionWidth,
  newSectionDepth,
  setNewSectionDepth,
  newSectionThickness,
  setNewSectionThickness,
  onAddSection,
  updateSection,
  deleteSection,
}: SectionsSectionProps) {
  return (
    <section>
      <SectionHeader title={labels.sections} />
      <div style={{ display: 'grid', gap: 8 }}>
        {sections.map((section) => (
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
          <button className="toolbar-btn" onClick={onAddSection}>{labels.addSection}</button>
        </div>
      </div>
    </section>
  );
}
