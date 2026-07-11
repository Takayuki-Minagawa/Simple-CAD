import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Material } from '@/domain/structural/types';
import { changeMaterialType } from '@/domain/structural/materials';
import type { Labels, MaterialPreset } from './masterDataHelpers';
import { MATERIAL_PRESETS, MATERIAL_TYPES, applyMaterialPreset } from './masterDataHelpers';
import {
  DeleteButton,
  OptionalNumberField,
  ReadonlyField,
  SectionHeader,
  SelectField,
  TextField,
} from './masterDataFields';

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

function StrengthRow({
  material,
  labels,
  updateMaterial,
}: {
  material: Material;
  labels: Labels;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 8,
        marginTop: 8,
        alignItems: 'end',
      }}
    >
      <OptionalNumberField
        label={labels.elasticModulus}
        value={material.elasticModulus}
        onChange={(value) => updateMaterial(material.id, { elasticModulus: value })}
      />
      <OptionalNumberField
        label={labels.shearModulus}
        value={material.shearModulus}
        onChange={(value) => updateMaterial(material.id, { shearModulus: value })}
      />
      <OptionalNumberField
        label={labels.poissonRatio}
        value={material.poissonRatio}
        onChange={(value) => updateMaterial(material.id, { poissonRatio: value })}
      />
      <OptionalNumberField
        label={labels.unitWeight}
        value={material.unitWeight}
        onChange={(value) => updateMaterial(material.id, { unitWeight: value })}
      />
      {material.type === 'concrete' && (
        <OptionalNumberField
          label={labels.fc}
          value={material.Fc}
          onChange={(value) => updateMaterial(material.id, { Fc: value })}
        />
      )}
      {material.type === 'steel' && (
        <>
          <OptionalNumberField
            label={labels.steelF}
            value={material.F}
            onChange={(value) => updateMaterial(material.id, { F: value })}
          />
          <OptionalNumberField
            label={labels.fy}
            value={material.Fy}
            onChange={(value) => updateMaterial(material.id, { Fy: value })}
          />
        </>
      )}
      {material.type === 'wood' && (
        <>
          <OptionalNumberField
            label={labels.referenceStrength}
            value={material.referenceStrength}
            onChange={(value) => updateMaterial(material.id, { referenceStrength: value })}
          />
          <OptionalNumberField
            label={labels.moistureContent}
            value={material.moistureContent}
            onChange={(value) => updateMaterial(material.id, { moistureContent: value })}
          />
          <OptionalNumberField
            label={labels.allowableBendingStress}
            value={material.allowableBendingStress}
            onChange={(value) => updateMaterial(material.id, { allowableBendingStress: value })}
          />
          <OptionalNumberField
            label={labels.allowableCompressionStress}
            value={material.allowableCompressionStress}
            onChange={(value) => updateMaterial(material.id, { allowableCompressionStress: value })}
          />
          <OptionalNumberField
            label={labels.allowableShearStress}
            value={material.allowableShearStress}
            onChange={(value) => updateMaterial(material.id, { allowableShearStress: value })}
          />
        </>
      )}
    </div>
  );
}

function PresetPicker({
  labels,
  type,
  onApply,
}: {
  labels: Labels;
  type: Material['type'];
  onApply: (preset: MaterialPreset) => void;
}) {
  const presets = MATERIAL_PRESETS.filter((preset) => preset.values.type === type);
  const [presetId, setPresetId] = useState<string>(presets[0]?.id ?? '');
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}>
      <SelectField
        label={labels.preset}
        value={presetId}
        options={presets.map((preset) => preset.id)}
        onChange={setPresetId}
      />
      <button
        className="toolbar-btn"
        onClick={() => {
          const preset = presets.find((candidate) => candidate.id === presetId);
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
                onChange={(value) =>
                  updateMaterial(
                    material.id,
                    changeMaterialType(material, value as Material['type']),
                  )
                }
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
                key={material.type}
                labels={labels}
                type={material.type}
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
            onChange={(value) =>
              setNewMaterial((previous) =>
                changeMaterialType(previous, value as Material['type']),
              )
            }
          />
          <button className="toolbar-btn" onClick={onAddMaterial}>{labels.addMaterial}</button>
        </div>
      </div>
    </section>
  );
}
