import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectData } from '@/domain/structural/types';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { EdgeEditDialog } from '../EdgeEditDialog';

function project(): ProjectData {
  return {
    schemaVersion: '1.0.0',
    project: { id: 'P', name: 'T', unit: 'mm' },
    stories: [{ id: '1F', name: '1F', elevation: 0, height: 3000 }],
    grids: [],
    materials: [{ id: 'M', name: 'C', type: 'concrete' }],
    sections: [{ id: 'S', kind: 'rc_beam_rect', width: 300, depth: 600 }],
    members: [
      { id: 'beam-a', type: 'beam', story: '1F', sectionId: 'S', materialId: 'M', start: { x: 0, y: 1000, z: 3000 }, end: { x: 5000, y: 1000, z: 3000 } },
      { id: 'beam-b', type: 'beam', story: '1F', sectionId: 'S', materialId: 'M', start: { x: 3000, y: 0, z: 3000 }, end: { x: 3000, y: 4000, z: 3000 } },
    ],
    openings: [], annotations: [], dimensions: [], sheets: [], views: [],
  } as unknown as ProjectData;
}

describe('EdgeEditDialog (R09)', () => {
  beforeEach(() => {
    useI18n.getState().setLocale('en');
    useProjectStore.getState().loadProject(project());
    useEditorStore.setState((state) => ({
      selectedIds: ['beam-a'],
      activeStory: '1F',
      layerLocked: { ...state.layerLocked, 'member-beam': false },
      layerVisibility: { ...state.layerVisibility, 'member-beam': true },
    }));
  });

  it('previews the new endpoint and applies the trim as one undo step', () => {
    render(<EdgeEditDialog onClose={vi.fn()} />);
    expect(screen.getByLabelText('Target member ID')).toHaveValue('beam-a');
    fireEvent.change(screen.getByLabelText('Reference member ID'), { target: { value: 'beam-b' } });

    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(preview).toHaveTextContent('End: (3000, 1000, 3000)');
    expect(preview).toHaveTextContent('Plan length (XY): 3000 mm');

    const revisionBefore = useProjectStore.getState().currentRevision;
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    const beam = useProjectStore.getState().data!.members.find((m) => m.id === 'beam-a')!;
    expect(beam).toMatchObject({ end: { x: 3000, y: 1000, z: 3000 } });
    expect(useProjectStore.getState().currentRevision).toBe(revisionBefore + 1);
    expect(screen.getByRole('status')).toHaveTextContent('Applied');

    useProjectStore.temporal.getState().undo();
    expect(useProjectStore.getState().data!.members.find((m) => m.id === 'beam-a')).toMatchObject({ end: { x: 5000, y: 1000, z: 3000 } });
  });

  it('explains why a request cannot be applied', () => {
    render(<EdgeEditDialog onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Reference member ID'), { target: { value: 'beam-a' } });
    expect(screen.getByRole('alert')).toHaveTextContent('must be different');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();

    useEditorStore.setState((state) => ({ layerLocked: { ...state.layerLocked, 'member-beam': true } }));
    fireEvent.change(screen.getByLabelText('Reference member ID'), { target: { value: 'beam-b' } });
    expect(screen.getByRole('alert')).toHaveTextContent('locked or hidden');
  });
});
