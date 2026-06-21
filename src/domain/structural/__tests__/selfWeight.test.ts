import { describe, expect, it } from 'vitest';
import {
  computeMemberSelfWeight,
  computeSelfWeights,
  linearSelfWeightPerLength,
  sectionAreaMm2,
  slabSelfWeightPerArea,
} from '@/domain/structural/selfWeight';
import type { Material, Member, Section } from '@/domain/structural/types';

const concrete: Material = {
  id: 'MAT-RC',
  name: 'RC',
  type: 'concrete',
  unitWeight: 24, // kN/m³
};

const steel: Material = {
  id: 'MAT-S',
  name: 'SN400',
  type: 'steel',
  unitWeight: 77, // kN/m³
};

describe('sectionAreaMm2', () => {
  it('rectangular section = width × depth (mm²)', () => {
    const sec: Section = { id: 'S', kind: 'rc_column_rect', width: 600, depth: 600 };
    expect(sectionAreaMm2(sec)).toBe(360000);
  });

  it('H-shape = 2·B·tf + (H−2tf)·tw when tw/tf present', () => {
    const sec: Section = {
      id: 'H',
      kind: 's_beam_h',
      width: 200, // B
      depth: 400, // H
      tw: 8,
      tf: 13,
    };
    // 2·200·13 + (400−26)·8 = 5200 + 2992 = 8192
    expect(sectionAreaMm2(sec)).toBe(8192);
  });

  it('pipe = π/4·(D² − (D−2t)²)', () => {
    const sec: Section = { id: 'P', kind: 's_pipe', diameter: 200, thickness: 6 };
    const expected = (Math.PI / 4) * (200 * 200 - 188 * 188);
    expect(sectionAreaMm2(sec)).toBeCloseTo(expected, 6);
  });

  it('returns undefined for slab/wall (area-type)', () => {
    expect(sectionAreaMm2({ id: 'SL', kind: 'rc_slab', thickness: 180 })).toBeUndefined();
    expect(sectionAreaMm2({ id: 'W', kind: 'rc_wall', thickness: 200 })).toBeUndefined();
  });
});

describe('linearSelfWeightPerLength', () => {
  it('= unitWeight · area(m²) → kN/m', () => {
    const sec: Section = { id: 'C', kind: 'rc_column_rect', width: 600, depth: 600 };
    // area = 0.36 m²; 24 · 0.36 = 8.64 kN/m
    expect(linearSelfWeightPerLength(sec, concrete)).toBeCloseTo(8.64, 6);
  });

  it('returns undefined when material lacks unitWeight', () => {
    const sec: Section = { id: 'C', kind: 'rc_column_rect', width: 600, depth: 600 };
    expect(
      linearSelfWeightPerLength(sec, { id: 'M', name: 'm', type: 'concrete' }),
    ).toBeUndefined();
  });

  it('returns undefined for slab section', () => {
    expect(
      linearSelfWeightPerLength({ id: 'SL', kind: 'rc_slab', thickness: 180 }, concrete),
    ).toBeUndefined();
  });
});

describe('slabSelfWeightPerArea', () => {
  it('= unitWeight · thickness(m) → kN/m²', () => {
    // 24 · 0.18 = 4.32 kN/m²
    expect(slabSelfWeightPerArea(180, concrete)).toBeCloseTo(4.32, 6);
  });
});

describe('computeMemberSelfWeight', () => {
  it('column: distributed kN/m and total kN', () => {
    const member: Member = {
      id: 'C1',
      type: 'column',
      story: 'S1',
      sectionId: 'C',
      materialId: 'MAT-RC',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 0, y: 0, z: 3000 }, // 3 m
    };
    const sec: Section = { id: 'C', kind: 'rc_column_rect', width: 600, depth: 600 };
    const sw = computeMemberSelfWeight(member, sec, concrete);
    expect(sw).toBeDefined();
    expect(sw!.kind).toBe('distributed');
    expect(sw!.intensity).toBeCloseTo(8.64, 6); // kN/m
    expect(sw!.total).toBeCloseTo(25.92, 6); // 8.64 · 3
  });

  it('steel beam H-shape: total uses cross-section area', () => {
    const member: Member = {
      id: 'B1',
      type: 'beam',
      story: 'S1',
      sectionId: 'H',
      materialId: 'MAT-S',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 6000, y: 0, z: 0 }, // 6 m
    };
    const sec: Section = { id: 'H', kind: 's_beam_h', width: 200, depth: 400, tw: 8, tf: 13 };
    const sw = computeMemberSelfWeight(member, sec, steel);
    // area 8192 mm² = 0.008192 m²; w = 77 · 0.008192 = 0.630784 kN/m
    expect(sw!.intensity).toBeCloseTo(0.630784, 6);
    expect(sw!.total).toBeCloseTo(0.630784 * 6, 5);
  });

  it('slab: area load and total via polygon area', () => {
    const member: Member = {
      id: 'SL1',
      type: 'slab',
      story: 'S1',
      sectionId: 'SL',
      materialId: 'MAT-RC',
      polygon: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 5000 },
        { x: 0, y: 5000 },
      ],
      level: 3000,
    };
    const sec: Section = { id: 'SL', kind: 'rc_slab', thickness: 180 };
    const sw = computeMemberSelfWeight(member, sec, concrete);
    expect(sw!.kind).toBe('area');
    expect(sw!.intensity).toBeCloseTo(4.32, 6); // kN/m²
    // area = 4 · 5 = 20 m²; total = 4.32 · 20 = 86.4 kN
    expect(sw!.total).toBeCloseTo(86.4, 5);
  });

  it('wall: panel area load total = q · length · height', () => {
    const member: Member = {
      id: 'W1',
      type: 'wall',
      story: 'S1',
      sectionId: 'W',
      materialId: 'MAT-RC',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 5000, y: 0, z: 0 }, // 5 m
      height: 3000, // 3 m
      thickness: 200,
    };
    const sec: Section = { id: 'W', kind: 'rc_wall', thickness: 200 };
    const sw = computeMemberSelfWeight(member, sec, concrete);
    // q = 24 · 0.2 = 4.8 kN/m²; total = 4.8 · 5 · 3 = 72 kN
    expect(sw!.intensity).toBeCloseTo(4.8, 6);
    expect(sw!.total).toBeCloseTo(72, 5);
  });

  it('returns undefined when material has no unitWeight', () => {
    const member: Member = {
      id: 'C1',
      type: 'column',
      story: 'S1',
      sectionId: 'C',
      materialId: 'M',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 0, y: 0, z: 3000 },
    };
    const sec: Section = { id: 'C', kind: 'rc_column_rect', width: 600, depth: 600 };
    expect(
      computeMemberSelfWeight(member, sec, { id: 'M', name: 'm', type: 'concrete' }),
    ).toBeUndefined();
  });
});

describe('computeSelfWeights', () => {
  it('skips members without enough data and keeps the rest', () => {
    const members: Member[] = [
      {
        id: 'C1',
        type: 'column',
        story: 'S1',
        sectionId: 'C',
        materialId: 'MAT-RC',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 0, z: 3000 },
      },
      {
        id: 'C2',
        type: 'column',
        story: 'S1',
        sectionId: 'C',
        materialId: 'MAT-NONE', // no material → skipped
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 0, z: 3000 },
      },
    ];
    const sections: Section[] = [{ id: 'C', kind: 'rc_column_rect', width: 600, depth: 600 }];
    const result = computeSelfWeights(members, sections, [concrete]);
    expect(result).toHaveLength(1);
    expect(result[0].memberId).toBe('C1');
  });
});
