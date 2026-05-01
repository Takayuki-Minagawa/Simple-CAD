import { describe, expect, it } from 'vitest';
import { useEditorStore } from '../editorStore';

describe('editorStore', () => {
  it('toggles snap modes', () => {
    useEditorStore.setState({ activeSnapModes: ['grid', 'endpoint'] });

    useEditorStore.getState().toggleSnapMode('endpoint');
    expect(useEditorStore.getState().activeSnapModes).toEqual(['grid']);

    useEditorStore.getState().toggleSnapMode('nearest');
    expect(useEditorStore.getState().activeSnapModes).toEqual(['grid', 'nearest']);

    useEditorStore.getState().toggleSnapMode('nearest');
    expect(useEditorStore.getState().activeSnapModes).toEqual(['grid']);
  });
});
