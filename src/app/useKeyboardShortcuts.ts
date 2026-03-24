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
          case 'g':
            e.preventDefault();
            {
              const ids = useEditorStore.getState().selectedIds;
              if (ids.length === 0) return;
              if (e.shiftKey) {
                // Ungroup: find group containing first selected id
                const data = useProjectStore.getState().data;
                if (data?.groups) {
                  const group = data.groups.find((g) => g.memberIds.includes(ids[0]));
                  if (group) useProjectStore.getState().ungroupSelection(group.id);
                }
              } else {
                // Group
                const name = prompt('Group name:') || 'Group';
                useProjectStore.getState().createGroup(ids, name);
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
