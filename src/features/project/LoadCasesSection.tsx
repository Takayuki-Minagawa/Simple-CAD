import type { Dispatch, SetStateAction } from 'react';
import type { LoadCase } from '@/domain/structural/types';
import type { Labels } from './masterDataHelpers';
import { LOAD_CASE_TYPES } from './masterDataHelpers';
import { DeleteButton, ReadonlyField, SectionHeader, SelectField, TextField } from './masterDataFields';

interface LoadCasesSectionProps {
  loadCases: LoadCase[];
  labels: Labels;
  newLoadCaseId: string;
  setNewLoadCaseId: Dispatch<SetStateAction<string>>;
  newLoadCaseName: string;
  setNewLoadCaseName: Dispatch<SetStateAction<string>>;
  newLoadCaseType: LoadCase['type'];
  setNewLoadCaseType: Dispatch<SetStateAction<LoadCase['type']>>;
  onAddLoadCase: () => void;
  updateLoadCase: (id: string, updates: Partial<LoadCase>) => void;
  deleteLoadCase: (id: string) => void;
}

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

export function LoadCasesSection({
  loadCases,
  labels,
  newLoadCaseId,
  setNewLoadCaseId,
  newLoadCaseName,
  setNewLoadCaseName,
  newLoadCaseType,
  setNewLoadCaseType,
  onAddLoadCase,
  updateLoadCase,
  deleteLoadCase,
}: LoadCasesSectionProps) {
  return (
    <section>
      <SectionHeader title={labels.loadCases} />
      <div style={{ display: 'grid', gap: 8 }}>
        {loadCases.map((loadCase) => (
          <div
            key={loadCase.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '140px minmax(0, 1fr) 140px 120px auto',
              gap: 8,
              alignItems: 'end',
            }}
          >
            <ReadonlyField label={labels.id} value={loadCase.id} />
            <TextField label={labels.name} value={loadCase.name} onChange={(value) => updateLoadCase(loadCase.id, { name: value })} />
            <SelectField
              label={labels.type}
              value={loadCase.type}
              options={LOAD_CASE_TYPES}
              onChange={(value) => updateLoadCase(loadCase.id, { type: value as LoadCase['type'] })}
            />
            <OptionalNumberField label={labels.factor} value={loadCase.factor} onChange={(value) => updateLoadCase(loadCase.id, { factor: value })} />
            <DeleteButton label={labels.delete} onClick={() => deleteLoadCase(loadCase.id)} />
          </div>
        ))}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '140px minmax(0, 1fr) 140px 120px auto',
            gap: 8,
            alignItems: 'end',
            paddingTop: 8,
            borderTop: '1px dashed var(--border-color)',
          }}
        >
          <TextField label={labels.id} value={newLoadCaseId} onChange={setNewLoadCaseId} />
          <TextField label={labels.name} value={newLoadCaseName} onChange={setNewLoadCaseName} />
          <SelectField
            label={labels.type}
            value={newLoadCaseType}
            options={LOAD_CASE_TYPES}
            onChange={(value) => setNewLoadCaseType(value as LoadCase['type'])}
          />
          <div />
          <button className="toolbar-btn" onClick={onAddLoadCase}>{labels.addLoadCase}</button>
        </div>
      </div>
    </section>
  );
}
