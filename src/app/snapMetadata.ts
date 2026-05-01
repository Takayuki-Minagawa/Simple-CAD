import { SNAP_MODES } from '@/app/store';
import type { SnapMode } from '@/app/store';
import type { Translations } from '@/i18n';

export function getSnapModeLabel(mode: SnapMode, t: Translations): string {
  switch (mode) {
    case 'grid':
      return t.snapModeGrid;
    case 'endpoint':
      return t.snapModeEndpoint;
    case 'midpoint':
      return t.snapModeMidpoint;
    case 'intersection':
      return t.snapModeIntersection;
    case 'perpendicular':
      return t.snapModePerpendicular;
    case 'nearest':
      return t.snapModeNearest;
  }
}

export function getSnapModeLabels(t: Translations): Array<[SnapMode, string]> {
  return SNAP_MODES.map((mode) => [mode, getSnapModeLabel(mode, t)]);
}
