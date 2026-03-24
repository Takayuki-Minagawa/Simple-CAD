import type { LineType } from '@/domain/structural/types';

export function lineTypeToDashArray(lineType: LineType | undefined, scale = 1): string | undefined {
  const s = scale;
  switch (lineType) {
    case 'dashed':
      return `${200 * s} ${100 * s}`;
    case 'dotted':
      return `${20 * s} ${80 * s}`;
    case 'chain':
      return `${300 * s} ${80 * s} ${20 * s} ${80 * s}`;
    case 'dashdot':
      return `${200 * s} ${80 * s} ${20 * s} ${80 * s}`;
    default:
      return undefined;
  }
}
