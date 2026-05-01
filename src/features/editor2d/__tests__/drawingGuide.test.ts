import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { getDrawingGuideText } from '../toolGuide';

describe('getDrawingGuideText', () => {
  it('returns no guide for passive tools', () => {
    expect(getDrawingGuideText('select', 0, en)).toBeNull();
    expect(getDrawingGuideText('pan', 0, en)).toBeNull();
  });

  it('advances guide text for two-point tools', () => {
    expect(getDrawingGuideText('beam', 0, en)).toBe(en.guideBeamStart);
    expect(getDrawingGuideText('beam', 1, en)).toBe(en.guideBeamEnd);
    expect(getDrawingGuideText('wall', 0, en)).toBe(en.guideWallStart);
    expect(getDrawingGuideText('wall', 1, en)).toBe(en.guideWallEnd);
  });

  it('uses completion guidance for polygon-style tools', () => {
    expect(getDrawingGuideText('slab', 0, en)).toBe(en.guideSlabStart);
    expect(getDrawingGuideText('slab', 2, en)).toBe(en.guideSlabNext);
    expect(getDrawingGuideText('spline', 0, en)).toBe(en.guideSplineStart);
    expect(getDrawingGuideText('spline', 1, en)).toBe(en.guideSplineNext);
  });

  it('uses guide-specific keys for edit tools', () => {
    expect(getDrawingGuideText('trim', 0, en)).toBe(en.guideTrimPrompt);
    expect(getDrawingGuideText('extend', 0, en)).toBe(en.guideExtendSource);
    expect(getDrawingGuideText('extend', 1, en)).toBe(en.guideExtendTarget);
  });
});
