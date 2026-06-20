import { describe, it, expect } from 'vitest';
import { buildStoryHeights } from '@/domain/integration/ifc/stories';
import { insUnitsToMm } from '@/domain/import/dxfImport';
import type { IfcStoryInfo } from '@/domain/integration/ifc/types';

describe('DXF insUnitsToMm', () => {
  it('maps mils (code 9) to 0.0254 mm, distinct from microinches (code 8)', () => {
    expect(insUnitsToMm(8)).toBeCloseTo(0.0000254, 12);
    expect(insUnitsToMm(9)).toBeCloseTo(0.0254, 6);
  });
  it('maps common units correctly', () => {
    expect(insUnitsToMm(4)).toBe(1); // mm
    expect(insUnitsToMm(6)).toBe(1000); // metres
    expect(insUnitsToMm(1)).toBe(25.4); // inches
    expect(insUnitsToMm(0)).toBeNull();
  });
});

describe('buildStoryHeights unit scaling', () => {
  const stories: IfcStoryInfo[] = [
    { id: '1F', name: '1F', elevation: 0 },
    { id: '2F', name: '2F', elevation: 3 }, // metres
  ];

  it('produces mm-range elevations/heights for a metre IFC (unitScale=1000)', () => {
    const out = buildStoryHeights(stories, [], new Map(), new Map(), 1000);
    expect(out[0].elevation).toBe(0);
    expect(out[0].height).toBe(3000); // 3 m → 3000 mm, not 3 mm or 3,000,000 mm
    expect(out[1].elevation).toBe(3000);
    expect(out[1].height).toBe(3000); // default storey fallback, in mm
  });

  it('is unchanged for already-mm data (unitScale defaults to 1)', () => {
    const mmStories: IfcStoryInfo[] = [{ id: '1F', name: '1F', elevation: 0 }];
    const out = buildStoryHeights(mmStories, [], new Map(), new Map());
    expect(out[0].elevation).toBe(0);
    expect(out[0].height).toBe(3000);
  });
});
