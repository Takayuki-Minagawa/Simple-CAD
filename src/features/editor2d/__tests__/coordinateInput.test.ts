import { describe, expect, it } from 'vitest';
import { parseCoordinate, parseCoordinateResult, buildPolarInput } from '../coordinateInput';

describe('parseCoordinate', () => {
  it('parses absolute comma and space separated coordinates', () => {
    expect(parseCoordinate('1000,2000', null)).toEqual({ x: 1000, y: 2000 });
    expect(parseCoordinate('1000 2000', null)).toEqual({ x: 1000, y: 2000 });
    expect(parseCoordinate('-1000 -2000', null)).toEqual({ x: -1000, y: -2000 });
    expect(parseCoordinate('1.5 2.5', null)).toEqual({ x: 1.5, y: 2.5 });
    expect(parseCoordinate('  1000   2000  ', null)).toEqual({ x: 1000, y: 2000 });
  });

  it('parses relative comma and space separated coordinates', () => {
    const lastPoint = { x: 500, y: -200 };
    expect(parseCoordinate('@100,300', lastPoint)).toEqual({ x: 600, y: 100 });
    expect(parseCoordinate('@100 300', lastPoint)).toEqual({ x: 600, y: 100 });
  });

  it('keeps polar input support', () => {
    const point = parseCoordinate('@100<90', { x: 10, y: 20 });
    expect(point?.x).toBeCloseTo(10);
    expect(point?.y).toBeCloseTo(120);
  });

  it('uses distance-only input along the preview direction', () => {
    const point = parseCoordinate('@500', { x: 100, y: 200 }, { x: 1100, y: 200 });
    expect(point).toEqual({ x: 600, y: 200 });

    const negativePoint = parseCoordinate('@-500', { x: 100, y: 200 }, { x: 1100, y: 200 });
    expect(negativePoint).toEqual({ x: -400, y: 200 });
  });

  it('rejects distance-only input without a usable direction', () => {
    expect(parseCoordinate('@500', { x: 100, y: 200 }, null)).toBeNull();
    expect(parseCoordinate('@500', { x: 100, y: 200 }, { x: 100, y: 200 })).toBeNull();
  });

  it('rejects incomplete coordinate pairs', () => {
    expect(parseCoordinate('1000', null)).toBeNull();
    expect(parseCoordinate('@100 200 300', null)).toBeNull();
    expect(parseCoordinate('abc def', null)).toBeNull();
  });
});

describe('parseCoordinateResult', () => {
  it('returns ok with the point on success', () => {
    expect(parseCoordinateResult('1000,2000', null)).toEqual({
      ok: true,
      point: { x: 1000, y: 2000 },
    });
  });

  it('returns empty for blank input', () => {
    expect(parseCoordinateResult('   ', null)).toEqual({ ok: false, error: 'empty' });
  });

  it('flags a missing direction for distance-only input', () => {
    expect(parseCoordinateResult('@500', { x: 0, y: 0 }, null)).toEqual({
      ok: false,
      error: 'no-direction',
    });
  });

  it('flags an unparseable absolute value', () => {
    expect(parseCoordinateResult('abc def', null)).toEqual({ ok: false, error: 'unparseable' });
  });

  it('flags an invalid relative pair', () => {
    expect(parseCoordinateResult('@abc', { x: 0, y: 0 })).toEqual({
      ok: false,
      error: 'invalid-pair',
    });
  });

  it('stays consistent with parseCoordinate', () => {
    const cases: [string, { x: number; y: number } | null][] = [
      ['1000,2000', null],
      ['@100,300', { x: 500, y: -200 }],
    ];
    for (const [input, last] of cases) {
      const res = parseCoordinateResult(input, last);
      const legacy = parseCoordinate(input, last);
      expect(res.ok ? res.point : null).toEqual(legacy);
    }
  });
});

describe('buildPolarInput', () => {
  it('formats a polar coordinate string parseable by parseCoordinate', () => {
    const str = buildPolarInput(1000, 90);
    expect(str).toBe('@1000<90');
    const point = parseCoordinate(str, { x: 0, y: 0 });
    expect(point?.x).toBeCloseTo(0);
    expect(point?.y).toBeCloseTo(1000);
  });
});
