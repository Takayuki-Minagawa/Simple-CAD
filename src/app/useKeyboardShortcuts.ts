import { useEffect } from 'react';
import { useProjectStore, useEditorStore } from '@/app/store';
import type { EditorTool } from '@/app/store';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              useProjectStore.temporal.getState().redo();
            } else {
              useProjectStore.temporal.getState().undo();
            }
            return;
          case 'y':
            e.preventDefault();
            useProjectStore.temporal.getState().redo();
            return;
          case 'd':
            e.preventDefault();
            {
              const ids = useEditorStore.getState().selectedIds;
              if (ids.length > 0) {
                const createdIds = useProjectStore.getState().duplicateEntities(ids, 1000, 1000, 1);
                useEditorStore.getState().setSelectedIds(createdIds);
              }
            }
            return;
        }
      }

      // Tool shortcuts (single key)
      if (!ctrl && !e.altKey) {
        const toolMap: Record<string, EditorTool> = {
          v: 'select',
          h: 'pan',
          c: 'column',
          b: 'beam',
          w: 'wall',
          s: 'slab',
          d: 'dimension',
          t: 'annotation',
        };

        const tool = toolMap[e.key.toLowerCase()];
        if (tool) {
          useEditorStore.getState().setActiveTool(tool);
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
