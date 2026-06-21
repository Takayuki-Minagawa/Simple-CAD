import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Material } from '@/domain/structural/types';
import type { Labels, MaterialPreset } from './masterDataHelpers';
import { MATERIAL_PRESETS, MATERIAL_TYPES, applyMaterialPreset } from './masterDataHelpers';
import { DeleteButton, ReadonlyField, SectionHeader, SelectField, TextField } from './masterDataFields';

interface MaterialsSectionProps {
  materials: Material[];
  materialUsage: Set<string>;
  labels: Labels;
  newMaterial: Material;
  setNewMaterial: Dispatch<SetStateAction<Material>>;
  onAddMaterial: () => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string) => void;
}

/** Optional numeric field that maps an empty value to `undefined`. */
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

function StrengthRow({
  material,
  labels,
  updateMaterial,
}: {
  material: Material;
  labels: Labels;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
}) {
  const update = (updates: Partial<Material>) => updateMaterial(material.id, updates);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 8,
        marginTop: 8,
        alignItems: 'end',
      }}
    >
      <OptionalNumberField
        label={labels.elasticModulus}
        value={material.elasticModulus}
        onChange={(value) => update({ elasticModulus: value })}
      />
      <OptionalNumberField
        label={labels.unitWeight}
        value={material.unitWeight}
        onChange={(value) => update({ unitWeight: value })}
      />
      {material.type === 'concrete' && (
        <OptionalNumberField label={labels.fc} value={material.Fc} onChange={(value) => update({ Fc: value })} />
      )}
      {material.type === 'steel' && (
        <>
          <OptionalNumberField label={labels.steelF} value={material.F} onChange={(value) => update({ F: value })} />
          <OptionalNumberField label={labels.fy} value={material.Fy} onChange={(value) => update({ Fy: value })} />
        </>
      )}
    </div>
  );
}

function PresetPicker({
  labels,
  onApply,
}: {
  labels: Labels;
  onApply: (preset: MaterialPreset) => void;
}) {
  const [presetId, setPresetId] = useState<string>(MATERIAL_PRESETS[0]?.id ?? '');
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}>
      <SelectField
        label={labels.preset}
        value={presetId}
        options={MATERIAL_PRESETS.map((p) => p.id)}
        onChange={setPresetId}
      />
      <button
        className="toolbar-btn"
        onClick={() => {
          const preset = MATERIAL_PRESETS.find((p) => p.id === presetId);
          if (preset) onApply(preset);
        }}
      >
        {labels.applyPreset}
      </button>
    </div>
  );
}

export function MaterialsSection({
  materials,
  materialUsage,
  labels,
  newMaterial,
  setNewMaterial,
  onAddMaterial,
  updateMaterial,
  deleteMaterial,
}: MaterialsSectionProps) {
  return (
    <section>
      <SectionHeader title={labels.materials} />
      <div style={{ display: 'grid', gap: 8 }}>
        {materials.map((material) => (
          <div
            key={material.id}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div
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
            <StrengthRow material={material} labels={labels} updateMaterial={updateMaterial} />
            <div style={{ marginTop: 8 }}>
              <PresetPicker
                labels={labels}
                onApply={(preset) => {
                  const next = applyMaterialPreset(material, preset);
                  const { id: _id, name: _name, ...updates } = next;
                  void _id;
                  void _name;
                  updateMaterial(material.id, updates);
                }}
              />
            </div>
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
          <button className="toolbar-btn" onClick={onAddMaterial}>{labels.addMaterial}</button>
        </div>
      </div>
    </section>
  );
}
