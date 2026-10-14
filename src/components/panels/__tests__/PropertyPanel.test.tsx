import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { BeamMember, ProjectData } from '@/domain/structural/types';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { PropertyPanel } from '../PropertyPanel';

describe('PropertyPanel member values', () => {
  beforeEach(() => {
    useI18n.getState().setLocale('en');
    useProjectStore
      .getState()
      .loadProject(structuredClone(sampleProject) as unknown as ProjectData);
    useEditorStore.setState((state) => ({
      selectedIds: [],
      layerLocked: { ...state.layerLocked, 'member-column': false },
      layerVisibility: { ...state.layerVisibility, 'member-column': true },
    }));
  });

  it('resolves mixed zero rotation and mixed black color through explicit operations', () => {
    const members = useProjectStore.getState().data!.members.slice(0, 2);
    useProjectStore.getState().updateMember(members[0].id, {
      rotation: 0,
      color: '#000000',
    });
    useProjectStore.getState().updateMember(members[1].id, {
      rotation: 0.523599,
      color: '#ff0000',
    });
    useEditorStore.getState().setSelectedIds(members.map((member) => member.id));

    render(<PropertyPanel />);

    expect(screen.getAllByText('Mixed')).toHaveLength(2);
    const rotation = screen.getByRole('textbox', { name: 'Rotation (°)' });
    fireEvent.change(rotation, { target: { value: '0' } });
    fireEvent.blur(rotation);
    expect(
      useProjectStore
        .getState()
        .data!.members.filter((member) => members.some(({ id }) => id === member.id))
        .map((member) => member.rotation),
    ).toEqual([0, 0]);

    fireEvent.click(screen.getByRole('button', { name: 'Apply Color' }));
    expect(
      useProjectStore
        .getState()
        .data!.members.filter((member) => members.some(({ id }) => id === member.id))
        .map((member) => member.color),
    ).toEqual(['#000000', '#000000']);
  });

  it('rounds a quantized radian rotation before displaying degrees', () => {
    const member = useProjectStore.getState().data!.members[0];
    useProjectStore.getState().updateMember(member.id, { rotation: 0.523599 });
    useEditorStore.getState().setSelectedIds([member.id]);

    render(<PropertyPanel />);

    expect(screen.getByRole('textbox', { name: 'Rotation (°)' })).toHaveValue('30');
  });

  it('shows a read-only construction line summary', () => {
    const data = structuredClone(useProjectStore.getState().data!);
    data.constructionLines = [{
      id: 'X-REFERENCE', story: '1F', type: 'ray',
      origin: { x: 1200, y: 500 }, direction: { x: 0, y: 1 },
    }];
    useProjectStore.getState().loadProject(data);
    useEditorStore.getState().setSelectedIds(['X-REFERENCE']);
    render(<PropertyPanel />);

    expect(screen.getByText('X-REFERENCE')).toBeVisible();
    expect(screen.getByText('Construction (ray)')).toBeVisible();
    expect(screen.getByText('Origin (mm)').closest('.prop-row')).toHaveTextContent('1200, 500');
    expect(screen.getByText('Direction').closest('.prop-row')).toHaveTextContent('0, 1');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });
});

describe('PropertyPanel computer-use review items', () => {
  beforeEach(() => {
    useI18n.getState().setLocale('en');
    useProjectStore
      .getState()
      .loadProject(structuredClone(sampleProject) as unknown as ProjectData);
    useEditorStore.setState((state) => ({
      selectedIds: [],
      statusUnit: 'mm',
      layerLocked: { ...state.layerLocked, 'member-column': false, 'member-beam': false },
      layerVisibility: { ...state.layerVisibility, 'member-column': true, 'member-beam': true },
    }));
  });

  it('distinguishes plan length from 3D length for a vertical column (R08)', () => {
    const column = useProjectStore.getState().data!.members.find((m) => m.type === 'column')!;
    useEditorStore.getState().setSelectedIds([column.id]);
    render(<PropertyPanel />);
    expect(screen.getByText('Plan length (XY)').nextSibling).toHaveTextContent('0 mm');
    expect(screen.getByText('3D member length (XYZ)').nextSibling).toHaveTextContent('3000 mm');
    expect(screen.getByText('ΔZ (height)').nextSibling).toHaveTextContent('3000 mm');
  });

  it('shows the display unit alongside millimetres when metres are selected (R01)', () => {
    const beam = useProjectStore.getState().data!.members.find((m) => m.type === 'beam')!;
    useEditorStore.setState({ statusUnit: 'm' });
    useEditorStore.getState().setSelectedIds([beam.id]);
    render(<PropertyPanel />);
    expect(screen.getByText('Plan length (XY)').nextSibling?.textContent).toMatch(/\d+ mm \(\d+\.\d{3} m\)/);
    expect(screen.getByRole('textbox', { name: 'Start X (mm)' })).toBeInTheDocument();
  });

  it('names every select and colour input after its target (R05)', () => {
    const beam = useProjectStore.getState().data!.members.find((m) => m.type === 'beam')!;
    useEditorStore.getState().setSelectedIds([beam.id]);
    render(<PropertyPanel />);
    for (const name of ['Member story', 'Member section', 'Member material', 'Face align', 'Start grid', 'End grid', 'Line Type']) {
      expect(screen.getByRole('combobox', { name })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Line color')).toBeInTheDocument();
  });

  it('refuses a negative line weight before it reaches the model (R02)', () => {
    const beam = useProjectStore.getState().data!.members.find((m) => m.type === 'beam')!;
    useEditorStore.getState().setSelectedIds([beam.id]);
    render(<PropertyPanel />);
    const input = screen.getByRole('textbox', { name: 'Line Weight' });
    fireEvent.change(input, { target: { value: '-20' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useProjectStore.getState().data!.members.find((m) => m.id === beam.id)!.lineWeight).toBe(beam.lineWeight);
    expect(screen.getByRole('alert')).toHaveTextContent('Must be greater than 0');
  });

  it('explains when a coordinate edit is rejected because it would collapse the member', () => {
    const beam = useProjectStore.getState().data!.members.find((m): m is BeamMember => m.type === 'beam')!;
    useEditorStore.getState().setSelectedIds([beam.id]);
    render(<PropertyPanel />);
    const endX = screen.getByRole('textbox', { name: 'End X (mm)' });
    const endY = screen.getByRole('textbox', { name: 'End Y (mm)' });
    fireEvent.change(endY, { target: { value: String(beam.start.y) } });
    fireEvent.blur(endY);
    fireEvent.change(endX, { target: { value: String(beam.start.x) } });
    fireEvent.blur(endX);
    const stored = useProjectStore.getState().data!.members.find((m): m is BeamMember => m.id === beam.id)!;
    expect(stored.end.x).toBe(beam.end.x);
    expect(screen.getByRole('alert')).toHaveTextContent('Not applied');
  });
});
