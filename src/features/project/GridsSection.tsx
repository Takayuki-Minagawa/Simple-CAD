import type { Dispatch, SetStateAction } from 'react';
import type { Grid } from '@/domain/structural/types';
import type { Labels } from './masterDataHelpers';
import { GRID_AXES } from './masterDataHelpers';
import { DeleteButton, NumberField, ReadonlyField, SectionHeader, SelectField, TextField } from './masterDataFields';

interface GridsSectionProps {
  grids: Grid[];
  labels: Labels;
  newGridId: string;
  setNewGridId: Dispatch<SetStateAction<string>>;
  newGridName: string;
  setNewGridName: Dispatch<SetStateAction<string>>;
  newGridAxis: Grid['axis'];
  setNewGridAxis: Dispatch<SetStateAction<Grid['axis']>>;
  newGridPosition: number;
  setNewGridPosition: Dispatch<SetStateAction<number>>;
  onAddGrid: () => void;
  updateGrid: (id: string, updates: Partial<Grid>) => void;
  deleteGrid: (id: string) => void;
}

export function GridsSection({
  grids,
  labels,
  newGridId,
  setNewGridId,
  newGridName,
  setNewGridName,
  newGridAxis,
  setNewGridAxis,
  newGridPosition,
  setNewGridPosition,
  onAddGrid,
  updateGrid,
  deleteGrid,
}: GridsSectionProps) {
  // Grids sorted within each axis to make spans easy to read.
  const sorted = [...grids].sort((a, b) =>
    a.axis === b.axis ? a.position - b.position : a.axis < b.axis ? -1 : 1,
  );

  return (
    <section>
      <SectionHeader title={labels.grids} />
      <div style={{ display: 'grid', gap: 8 }}>
        {sorted.map((grid) => (
          <div
            key={grid.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '140px 100px minmax(0, 1fr) 140px auto',
              gap: 8,
              alignItems: 'end',
            }}
          >
            <ReadonlyField label={labels.id} value={grid.id} />
            <SelectField
              label={labels.axis}
              value={grid.axis}
              options={GRID_AXES}
              onChange={(value) => updateGrid(grid.id, { axis: value as Grid['axis'] })}
            />
            <TextField label={labels.name} value={grid.name} onChange={(value) => updateGrid(grid.id, { name: value })} />
            <NumberField label={labels.position} value={grid.position} onChange={(value) => updateGrid(grid.id, { position: value })} />
            <DeleteButton label={labels.delete} onClick={() => deleteGrid(grid.id)} />
          </div>
        ))}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '140px 100px minmax(0, 1fr) 140px auto',
            gap: 8,
            alignItems: 'end',
            paddingTop: 8,
            borderTop: '1px dashed var(--border-color)',
          }}
        >
          <TextField label={labels.id} value={newGridId} onChange={setNewGridId} />
          <SelectField
            label={labels.axis}
            value={newGridAxis}
            options={GRID_AXES}
            onChange={(value) => setNewGridAxis(value as Grid['axis'])}
          />
          <TextField label={labels.name} value={newGridName} onChange={setNewGridName} />
          <NumberField label={labels.position} value={newGridPosition} onChange={setNewGridPosition} />
          <button className="toolbar-btn" onClick={onAddGrid}>{labels.addGrid}</button>
        </div>
      </div>
    </section>
  );
}
