import type { EditorTool } from '@/app/store';
import type { Translations } from '@/i18n';

export function getDrawingGuideText(
  tool: EditorTool,
  pointCount: number,
  t: Translations,
): string | null {
  switch (tool) {
    case 'select':
    case 'pan':
      return null;
    case 'column':
      return t.guideColumnPlace;
    case 'beam':
      return pointCount === 0 ? t.guideBeamStart : t.guideBeamEnd;
    case 'wall':
      return pointCount === 0 ? t.guideWallStart : t.guideWallEnd;
    case 'slab':
      return pointCount === 0 ? t.guideSlabStart : t.guideSlabNext;
    case 'dimension':
      return pointCount === 0 ? t.guideDimensionStart : t.guideDimensionEnd;
    case 'annotation':
      return t.guideAnnotationPlace;
    case 'xline':
      return pointCount === 0 ? t.guideXlineStart : t.guideXlineDirection;
    case 'spline':
      return pointCount === 0 ? t.guideSplineStart : t.guideSplineNext;
    case 'trim':
      return t.guideTrimPrompt;
    case 'extend':
      return pointCount === 0 ? t.guideExtendSource : t.guideExtendTarget;
  }
}
