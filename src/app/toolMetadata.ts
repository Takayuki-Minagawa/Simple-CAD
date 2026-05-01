import type { EditorTool } from '@/app/store';
import type { Translations } from '@/i18n';

export const TOOL_SHORTCUTS: Partial<Record<EditorTool, string>> = {
  select: 'V',
  pan: 'H',
  column: 'C',
  beam: 'B',
  wall: 'W',
  slab: 'S',
  dimension: 'D',
  annotation: 'T',
};

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
  const shortcut = TOOL_SHORTCUTS[tool];
  return shortcut ? `${label} (${shortcut})` : label;
}
