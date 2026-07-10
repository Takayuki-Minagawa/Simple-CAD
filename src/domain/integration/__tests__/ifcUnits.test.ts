import { describe, it, expect } from 'vitest';
import { buildStoryHeights } from '@/domain/integration/ifc/stories';
import { insUnitsToMm } from '@/domain/import/dxfImport';
import { parseIfcEntities } from '@/domain/integration/ifc/step';
import { resolveLengthUnit } from '@/domain/integration/ifc/units';
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

  it('maps every standard AutoCAD INSUNITS length code (1-24)', () => {
    const surveyFoot = (1200 / 3937) * 1000;
    const expected = new Map<number, number>([
      [1, 25.4],
      [2, 304.8],
      [3, 1_609_344],
      [4, 1],
      [5, 10],
      [6, 1000],
      [7, 1e6],
      [8, 0.0000254],
      [9, 0.0254],
      [10, 914.4],
      [11, 1e-7],
      [12, 1e-6],
      [13, 1e-3],
      [14, 100],
      [15, 10_000],
      [16, 100_000],
      [17, 1e12],
      [18, 149_597_870_700_000],
      [19, 9.4607304725808e18],
      [20, 3.085677581491367e19],
      [21, surveyFoot],
      [22, surveyFoot / 12],
      [23, surveyFoot * 3],
      [24, surveyFoot * 5280],
    ]);

    for (const [code, millimetres] of expected) {
      const actual = insUnitsToMm(code);
      expect(actual, `INSUNITS ${code}`).not.toBeNull();
      expect(actual! / millimetres, `INSUNITS ${code}`).toBeCloseTo(1, 12);
    }
    expect(insUnitsToMm(25)).toBeNull();
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

describe('IFC length-unit diagnostics', () => {
  it('distinguishes a missing unit from an unsupported assignment', () => {
    const wrap = (body: string) =>
      `ISO-10303-21;HEADER;ENDSEC;DATA;${body}ENDSEC;END-ISO-10303-21;`;
    expect(resolveLengthUnit(parseIfcEntities(wrap(''))).status).toBe('missing');
    expect(
      resolveLengthUnit(
        parseIfcEntities(
          wrap('#1=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);#2=IFCUNITASSIGNMENT((#1));'),
        ),
      ).status,
    ).toBe('unsupported');
  });
});
