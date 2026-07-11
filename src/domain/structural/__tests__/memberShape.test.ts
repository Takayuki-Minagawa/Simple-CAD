import { describe, expect, it } from 'vitest';
import type { Member, Section } from '../types';
import {
  buildLinearMemberPolygon,
  getBeamRectSize,
  getColumnRectSize,
  getMemberPlanPolygon,
  getSlabThickness,
  getWallThickness,
} from '../memberShape';

describe('memberShape', () => {
  it('resolves section dimensions with stable defaults', () => {
    expect(getColumnRectSize(undefined)).toEqual({ width: 600, depth: 600 });
    expect(getBeamRectSize(undefined)).toEqual({ width: 300, depth: 600 });
    expect(getSlabThickness(undefined)).toBe(180);

    const wall: Member & { type: 'wall' } = {
      id: 'W1',
      type: 'wall',
      story: '1F',
      sectionId: 'S1',
      materialId: 'M1',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1000, y: 0, z: 0 },
      height: 3000,
      thickness: 250,
    };
    expect(getWallThickness(wall, undefined)).toBe(250);
  });

  it('builds linear member plan polygon with axis offset', () => {
    const polygon = buildLinearMemberPolygon({ x: 0, y: 0 }, { x: 1000, y: 0 }, 200, {
      dx: 50,
      dy: 0,
    });

    expect(polygon).toEqual([
      { x: 0, y: 150 },
      { x: 1000, y: 150 },
      { x: 1000, y: -50 },
      { x: 0, y: -50 },
    ]);
  });

  it('places beam and wall faces on the reference axis', () => {
    const beam: Member = {
      id: 'B1', type: 'beam', story: '1F', sectionId: 'SB', materialId: 'M1',
      start: { x: 0, y: 0, z: 3000 }, end: { x: 1000, y: 0, z: 3000 },
      faceAlign: 'left',
    };
    const section: Section = { id: 'SB', kind: 'rc_beam_rect', width: 200, depth: 400 };
    expect(getMemberPlanPolygon(beam, section)).toEqual([
      { x: 0, y: 200 },
      { x: 1000, y: 200 },
      { x: 1000, y: 0 },
      { x: 0, y: 0 },
    ]);

    expect(getMemberPlanPolygon({ ...beam, faceAlign: 'right' }, section)).toEqual([
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: -200 },
      { x: 0, y: -200 },
    ]);
  });

  it('applies column rotation and slab offset in plan polygons', () => {
    const column: Member = {
      id: 'C1',
      type: 'column',
      story: '1F',
      sectionId: 'SC',
      materialId: 'M1',
      start: { x: 1000, y: 1000, z: 0 },
      end: { x: 1000, y: 1000, z: 3000 },
      rotation: Math.PI / 2,
    };
    const columnSection: Section = { id: 'SC', kind: 'rc_column_rect', width: 200, depth: 400 };
    const columnPolygon = getMemberPlanPolygon(column, columnSection);
    expect(columnPolygon?.[0].x).toBeCloseTo(1200);
    expect(columnPolygon?.[0].y).toBeCloseTo(900);

    const slab: Member = {
      id: 'S1',
      type: 'slab',
      story: '1F',
      sectionId: 'SS',
      materialId: 'M1',
      polygon: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 0, y: 1000 },
      ],
      level: 3000,
      axisOffset: { dx: 10, dy: 20 },
    };
    expect(getMemberPlanPolygon(slab, undefined)).toEqual([
      { x: 10, y: 20 },
      { x: 1010, y: 20 },
      { x: 10, y: 1020 },
    ]);
  });
});
