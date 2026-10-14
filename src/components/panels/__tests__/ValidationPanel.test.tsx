import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { ValidationPanel } from '../ValidationPanel';

describe('ValidationPanel freshness and navigation (R03/R04)', () => {
  beforeEach(() => {
    useI18n.getState().setLocale('ja');
    useProjectStore.getState().loadProject(structuredClone(sampleProject) as unknown as ProjectData);
    useEditorStore.setState((state) => ({
      selectedIds: [],
      layerLocked: { ...state.layerLocked, 'member-beam': false },
      layerVisibility: { ...state.layerVisibility, 'member-beam': true },
    }));
  });

  it('marks results stale after an edit and lists schema issues by entity and field', () => {
    const beam = useProjectStore.getState().data!.members.find((m) => m.type === 'beam')!;
    // Bypass the UI guard to simulate a document that already carries a bad value.
    act(() => {
      useProjectStore.setState((state) => {
        // `state` is an immer draft here, so mutate in place.
        const target = state.data!.members.find((m) => m.id === beam.id)!;
        target.lineWeight = -20;
      });
    });
    render(<ValidationPanel />);
    fireEvent.click(screen.getByRole('button', { name: '実行' }));
    const freshness = screen.getByRole('status');
    expect(freshness).toHaveTextContent('最新');
    const issue = screen.getByRole('button', { name: new RegExp(`${beam.id} › lineWeight: 0 より大きい値にしてください`) });
    expect(issue).toBeInTheDocument();
    expect(screen.queryByText(/height/)).toBeNull();

    fireEvent.click(issue);
    expect(useEditorStore.getState().selectedIds).toEqual([beam.id]);

    act(() => {
      useProjectStore.getState().updateMember(beam.id, { lineWeight: 20 });
    });
    expect(screen.getByRole('status')).toHaveTextContent('変更あり・未再検証');

    fireEvent.click(screen.getByRole('button', { name: '実行' }));
    expect(screen.getByRole('status')).toHaveTextContent('最新');
    expect(screen.queryByRole('button', { name: /lineWeight/ })).toBeNull();
  });
});
