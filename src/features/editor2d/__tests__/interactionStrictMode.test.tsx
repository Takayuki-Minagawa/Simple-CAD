import { StrictMode, useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { useEditorStore, useProjectStore } from '@/app/store';
import {
  buildEditorSnapCandidates,
  useEditorInteraction,
} from '../useEditorInteraction';
import { findSnap } from '@/domain/geometry/snap';

type InteractionApi = ReturnType<typeof useEditorInteraction>;

describe('editor interaction regression safety', () => {
  beforeEach(() => {
    useProjectStore.getState().loadProject(
      JSON.parse(JSON.stringify(sampleProject)) as ProjectData,
    );
    useEditorStore.setState({
      activeStory: '1F',
      activeTool: 'beam',
      snapEnabled: true,
      activeSnapModes: ['grid'],
    });
  });

  it('creates one entity under React StrictMode', () => {
    const capture = vi.fn<(interaction: InteractionApi) => void>();
    function Harness({ onReady }: { onReady: (interaction: InteractionApi) => void }) {
      const interaction = useEditorInteraction();
      useEffect(() => onReady(interaction), [interaction, onReady]);
      return null;
    }
    render(<StrictMode><Harness onReady={capture} /></StrictMode>);
    const interaction = capture.mock.lastCall![0];
    const before = useProjectStore.getState().data!.members.length;
    act(() => {
      interaction.injectCoordinate({ x: 125, y: 250 });
      interaction.injectCoordinate({ x: 1125, y: 250 });
    });
    expect(useProjectStore.getState().data!.members).toHaveLength(before + 1);
  });

  it('does not expose grid intersections when grid snap is off', () => {
    const data = useProjectStore.getState().data!;
    const candidates = buildEditorSnapCandidates(data, '1F', {
      includeMembers: false,
      includeGrid: false,
    });
    const gx = data.grids.find((grid) => grid.axis === 'X')!;
    const gy = data.grids.find((grid) => grid.axis === 'Y')!;
    expect(candidates.some((candidate) => candidate.id === `${gx.id}-${gy.id}`)).toBe(false);
    expect(
      findSnap(
        { x: gx.position, y: gy.position },
        candidates,
        ['endpoint'],
        1000,
        15,
        1,
      ),
    ).toBeNull();
  });

  it('clears an in-progress drawing and selection when the active story changes', () => {
    const capture = vi.fn<(interaction: InteractionApi) => void>();
    function Harness({ onReady }: { onReady: (interaction: InteractionApi) => void }) {
      const interaction = useEditorInteraction();
      useEffect(() => onReady(interaction), [interaction, onReady]);
      return null;
    }
    render(<Harness onReady={capture} />);
    act(() => {
      useEditorStore.getState().setSelectedIds(['B-Y1-X1X2-1F']);
      capture.mock.lastCall![0].injectCoordinate({ x: 125, y: 250 });
    });
    expect(capture.mock.lastCall![0].drawState.points).toHaveLength(1);

    act(() => useEditorStore.getState().setActiveStory('2F'));

    expect(capture.mock.lastCall![0].drawState.points).toHaveLength(0);
    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });
});
