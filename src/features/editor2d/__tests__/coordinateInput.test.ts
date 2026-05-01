import { describe, expect, it } from 'vitest';
import { parseCoordinate } from '../coordinateInput';

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
