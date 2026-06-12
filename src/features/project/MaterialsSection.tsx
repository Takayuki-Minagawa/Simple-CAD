import type { Dispatch, SetStateAction } from 'react';
import type { Material } from '@/domain/structural/types';
import type { Labels } from './masterDataHelpers';
import { MATERIAL_TYPES } from './masterDataHelpers';
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
          <button className="toolbar-btn" onClick={onAddMaterial}>{labels.addMaterial}</button>
        </div>
      </div>
    </section>
  );
}
