import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { LayerPanel } from '../LayerPanel';

describe('LayerPanel selection safety', () => {
  beforeEach(() => {
    useI18n.getState().setLocale('en');
    useProjectStore.getState().loadProject(
      structuredClone(sampleProject) as unknown as ProjectData,
    );
    useEditorStore.setState((state) => ({
      selectedIds: [],
      layerLocked: { ...state.layerLocked, 'member-beam': false, annotation: false },
      layerVisibility: { ...state.layerVisibility, 'member-beam': true, annotation: true },
    }));
  });

  it('drops entities from selection when their layer is locked or hidden', () => {
    const data = useProjectStore.getState().data!;
    const beam = data.members.find((member) => member.type === 'beam')!;
    const annotation = data.annotations[0];
    useEditorStore.getState().setSelectedIds([beam.id, annotation.id]);
    render(<LayerPanel />);

    const beamRow = screen.getByLabelText('Beam').closest('.layer-row') as HTMLElement;
    fireEvent.click(within(beamRow).getByTitle('Lock'));
    expect(useEditorStore.getState().selectedIds).toEqual([annotation.id]);

    const annotationCheckbox = screen.getByLabelText('Annotation');
    fireEvent.click(annotationCheckbox);
    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });
});
