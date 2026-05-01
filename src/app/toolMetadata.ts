import type { EditorTool } from '@/app/store';
import type { Translations } from '@/i18n';

export const TOOL_SHORTCUTS_BY_KEY = {
  v: 'select',
  h: 'pan',
  c: 'column',
  b: 'beam',
  w: 'wall',
  s: 'slab',
  d: 'dimension',
  t: 'annotation',
} as const satisfies Record<string, EditorTool>;

type ShortcutBackedTool = (typeof TOOL_SHORTCUTS_BY_KEY)[keyof typeof TOOL_SHORTCUTS_BY_KEY];

export const TOOL_SHORTCUTS = Object.fromEntries(
  Object.entries(TOOL_SHORTCUTS_BY_KEY).map(([key, tool]) => [tool, key.toUpperCase()]),
) as Record<ShortcutBackedTool, string>;

export function getToolLabel(tool: EditorTool, t: Translations): string {
  switch (tool) {
    case 'select':
      return t.toolSelect;
    case 'pan':
      return t.toolPan;
    case 'column':
      return t.toolColumn;
    case 'beam':
      return t.toolBeam;
    case 'wall':
      return t.toolWall;
    case 'slab':
      return t.toolSlab;
    case 'dimension':
      return t.toolDimension;
    case 'annotation':
      return t.toolAnnotation;
    case 'trim':
      return t.toolTrim;
    case 'extend':
      return t.toolExtend;
    case 'xline':
      return t.toolXline;
    case 'spline':
      return t.toolSpline;
  }
}

export function getToolStatusLabel(tool: EditorTool, t: Translations): string {
  const label = getToolLabel(tool, t);
  const shortcut = (TOOL_SHORTCUTS as Partial<Record<EditorTool, string>>)[tool];
  return shortcut ? `${label} (${shortcut})` : label;
}
