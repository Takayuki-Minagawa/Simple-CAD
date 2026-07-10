import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
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
});
