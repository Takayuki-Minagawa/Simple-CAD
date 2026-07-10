import { beforeEach, describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { useEditorStore } from '../editorStore';
import { useProjectStore } from '../projectStore';

const cloneProject = () => structuredClone(sampleProject) as unknown as ProjectData;

describe('whole-document lifecycle', () => {
  beforeEach(() => {
    useProjectStore.getState().loadProject(cloneProject());
  });

  it('increments document generation and clears transient editor state on replacement', () => {
    const beforeGeneration = useProjectStore.getState().documentGeneration;
    useEditorStore.setState({
      activeStory: '2F',
      selectedIds: ['C-X1Y1-1F'],
      activeTool: 'wall',
      drawAnchor: { x: 10, y: 20 },
      activeSnapPoint: { x: 30, y: 40 },
      cursorWorld: { x: 50, y: 60 },
      pan: { x: 70, y: 80 },
      zoom: 2,
    });

    useProjectStore.getState().loadProject(cloneProject());

    expect(useProjectStore.getState().documentGeneration).toBeGreaterThan(beforeGeneration);
    expect(useEditorStore.getState()).toMatchObject({
      activeStory: '1F',
      selectedIds: [],
      activeTool: 'select',
      drawAnchor: null,
      activeSnapPoint: null,
      cursorWorld: null,
      pan: { x: 0, y: 0 },
      zoom: 0.05,
    });
  });

  it('does not change document generation for a normal edit or undo', () => {
    const generation = useProjectStore.getState().documentGeneration;
    useProjectStore.getState().addAnnotation({
      id: 'lifecycle-note',
      type: 'text',
      story: '1F',
      x: 0,
      y: 0,
      text: 'note',
    });
    useProjectStore.temporal.getState().undo();
    expect(useProjectStore.getState().documentGeneration).toBe(generation);
  });
});
