import type { Dispatch, SetStateAction } from 'react';
import type { RebarSpec, Section } from '@/domain/structural/types';
import type { Labels, SectionKindDraft } from './masterDataHelpers';
import {
  SECTION_KIND_OPTIONS,
  sectionHasCover,
  sectionHasRebar,
  sectionIsSteelH,
  sectionKindLabel,
} from './masterDataHelpers';
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
  newSectionDiameter: number;
  setNewSectionDiameter: Dispatch<SetStateAction<number>>;
  onAddSection: () => void;
  updateSection: (id: string, updates: Partial<Section>) => void;
  deleteSection: (id: string) => void;
}

/** Optional numeric field that maps empty input to `undefined`. */
function OptionalNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
      <input
        className="prop-input"
        style={{ maxWidth: '100%' }}
        type="number"
        value={value ?? ''}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === '' ? undefined : Number(raw));
        }}
      />
    </label>
  );
}

/** Render the dimension inputs that are specific to a section's kind. */
function DimensionFields({
  section,
  labels,
  updateSection,
}: {
  section: Section;
  labels: Labels;
  updateSection: (id: string, updates: Partial<Section>) => void;
}) {
  const update = (updates: Partial<Section>) => updateSection(section.id, updates as Partial<Section>);

  if (section.kind === 's_pipe') {
    return (
      <>
        <NumberField label={labels.diameter} value={section.diameter} onChange={(value) => update({ diameter: value } as Partial<Section>)} />
        <NumberField label={labels.thickness} value={section.thickness} onChange={(value) => update({ thickness: value } as Partial<Section>)} />
      </>
    );
  }

  if ('width' in section) {
    return (
      <>
        <NumberField label={labels.width} value={section.width} onChange={(value) => update({ width: value } as Partial<Section>)} />
        <NumberField label={labels.depth} value={section.depth} onChange={(value) => update({ depth: value } as Partial<Section>)} />
      </>
    );
  }

  // thickness-only (rc_slab / rc_wall)
  return (
    <>
      <NumberField label={labels.thickness} value={section.thickness} onChange={(value) => update({ thickness: value } as Partial<Section>)} />
      <div />
    </>
  );
}

function SteelHFields({
  section,
  labels,
  updateSection,
}: {
  section: Extract<Section, { kind: 's_column_h' | 's_beam_h' }>;
  labels: Labels;
  updateSection: (id: string, updates: Partial<Section>) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8, alignItems: 'end' }}>
      <OptionalNumberField label={labels.tw} value={section.tw} onChange={(value) => updateSection(section.id, { tw: value } as Partial<Section>)} />
      <OptionalNumberField label={labels.tf} value={section.tf} onChange={(value) => updateSection(section.id, { tf: value } as Partial<Section>)} />
    </div>
  );
}

function CoverRebarFields({
  section,
  labels,
  updateSection,
}: {
  section: Section;
  labels: Labels;
  updateSection: (id: string, updates: Partial<Section>) => void;
}) {
  if (!sectionHasCover(section.kind)) return null;
  const cover = 'cover' in section ? section.cover : undefined;
  const rebar: RebarSpec | undefined = sectionHasRebar(section.kind) && 'rebar' in section ? section.rebar : undefined;
  const updateRebar = (updates: Partial<RebarSpec>) =>
    updateSection(section.id, { rebar: { ...rebar, ...updates } } as Partial<Section>);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginTop: 8, alignItems: 'end' }}>
      <OptionalNumberField label={labels.cover} value={cover} onChange={(value) => updateSection(section.id, { cover: value } as Partial<Section>)} />
      {sectionHasRebar(section.kind) && (
        <>
          <OptionalNumberField label={labels.mainDiameter} value={rebar?.mainDiameter} onChange={(value) => updateRebar({ mainDiameter: value })} />
          <OptionalNumberField label={labels.mainCount} value={rebar?.mainCount} onChange={(value) => updateRebar({ mainCount: value })} />
          <OptionalNumberField label={labels.hoopDiameter} value={rebar?.hoopDiameter} onChange={(value) => updateRebar({ hoopDiameter: value })} />
          <OptionalNumberField label={labels.hoopSpacing} value={rebar?.hoopSpacing} onChange={(value) => updateRebar({ hoopSpacing: value })} />
        </>
      )}
    </div>
  );
}

function NewSectionDimensionFields({
  labels,
  kind,
  width,
  setWidth,
  depth,
  setDepth,
  thickness,
  setThickness,
  diameter,
  setDiameter,
}: {
  labels: Labels;
  kind: SectionKindDraft;
  width: number;
  setWidth: Dispatch<SetStateAction<number>>;
  depth: number;
  setDepth: Dispatch<SetStateAction<number>>;
  thickness: number;
  setThickness: Dispatch<SetStateAction<number>>;
  diameter: number;
  setDiameter: Dispatch<SetStateAction<number>>;
}) {
  if (kind === 's_pipe') {
    return (
      <>
        <NumberField label={labels.diameter} value={diameter} onChange={setDiameter} />
        <NumberField label={labels.thickness} value={thickness} onChange={setThickness} />
      </>
    );
  }
  if (kind === 'rc_column_rect' || kind === 'rc_beam_rect' || kind === 's_column_h' || kind === 's_beam_h') {
    return (
      <>
        <NumberField label={labels.width} value={width} onChange={setWidth} />
        <NumberField label={labels.depth} value={depth} onChange={setDepth} />
      </>
    );
  }
  return (
    <>
      <NumberField label={labels.thickness} value={thickness} onChange={setThickness} />
      <div />
    </>
  );
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
  newSectionDiameter,
  setNewSectionDiameter,
  onAddSection,
  updateSection,
  deleteSection,
}: SectionsSectionProps) {
  return (
    <section>
      <SectionHeader title={labels.sections} />
      <div style={{ display: 'grid', gap: 8 }}>
        {sections.map((section) => (
          <div key={section.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 120px repeat(2, minmax(0, 1fr)) auto',
                gap: 8,
                alignItems: 'end',
              }}
            >
              <ReadonlyField label={labels.id} value={section.id} />
              <ReadonlyField label={labels.kind} value={sectionKindLabel(section.kind)} />
              <DimensionFields section={section} labels={labels} updateSection={updateSection} />
              <DeleteButton
                label={labels.delete}
                disabled={sectionUsage.has(section.id)}
                hint={sectionUsage.has(section.id) ? labels.inUse : undefined}
                onClick={() => deleteSection(section.id)}
              />
            </div>
            {sectionIsSteelH(section.kind) && (
              <SteelHFields
                section={section as Extract<Section, { kind: 's_column_h' | 's_beam_h' }>}
                labels={labels}
                updateSection={updateSection}
              />
            )}
            <CoverRebarFields section={section} labels={labels} updateSection={updateSection} />
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
          <NewSectionDimensionFields
            labels={labels}
            kind={newSectionKind}
            width={newSectionWidth}
            setWidth={setNewSectionWidth}
            depth={newSectionDepth}
            setDepth={setNewSectionDepth}
            thickness={newSectionThickness}
            setThickness={setNewSectionThickness}
            diameter={newSectionDiameter}
            setDiameter={setNewSectionDiameter}
          />
          <button className="toolbar-btn" onClick={onAddSection}>{labels.addSection}</button>
        </div>
      </div>
    </section>
  );
}
