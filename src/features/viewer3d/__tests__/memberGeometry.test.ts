import { describe, expect, it } from 'vitest';
import type { Member, Section } from '@/domain/structural/types';
import { buildMemberGeometry } from '../memberGeometry';

function dimensions(member: Member, section: Section) {
  const geometry = buildMemberGeometry({ member, section, openings: [] }, 'native');
  expect(geometry).not.toBeNull();
  geometry!.computeBoundingBox();
  const box = geometry!.boundingBox!;
  const result = {
    x: box.max.x - box.min.x,
    y: box.max.y - box.min.y,
    z: box.max.z - box.min.z,
  };
  geometry!.dispose();
  return result;
}

function bounds(member: Member, section: Section) {
  const geometry = buildMemberGeometry({ member, section, openings: [] }, 'native');
  expect(geometry).not.toBeNull();
  geometry!.computeBoundingBox();
  const box = geometry!.boundingBox!;
  const result = {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };
  geometry!.dispose();
  return result;
}

describe('native member section geometry', () => {
  it('keeps beam width horizontal and depth vertical for a +X beam', () => {
    const section: Section = { id: 'B', kind: 'rc_beam_rect', width: 300, depth: 600 };
    const member: Member = {
      id: 'B1',
      type: 'beam',
      story: '1F',
      sectionId: section.id,
      materialId: 'M1',
      start: { x: 0, y: 0, z: 3000 },
      end: { x: 4000, y: 0, z: 3000 },
    };

    expect(dimensions(member, section)).toEqual({ x: 4000, y: 300, z: 600 });
  });

  it('renders an H section with its declared outer dimensions', () => {
    const section: Section = {
      id: 'HC',
      kind: 's_column_h',
      width: 300,
      depth: 500,
      tw: 12,
      tf: 20,
    };
    const member: Member = {
      id: 'C1',
      type: 'column',
      story: '1F',
      sectionId: section.id,
      materialId: 'M1',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 0, y: 0, z: 3000 },
    };

    expect(dimensions(member, section)).toEqual({ x: 300, y: 500, z: 3000 });
  });

  it('renders pipe sections as a circular hollow extrusion', () => {
    const section: Section = { id: 'P', kind: 's_pipe', diameter: 300, thickness: 12 };
    const member: Member = {
      id: 'B-P',
      type: 'beam',
      story: '1F',
      sectionId: section.id,
      materialId: 'M1',
      start: { x: 0, y: 0, z: 3000 },
      end: { x: 4000, y: 0, z: 3000 },
    };

    const size = dimensions(member, section);
    expect(size.x).toBeCloseTo(4000, 6);
    expect(size.y).toBeCloseTo(300, 4);
    expect(size.z).toBeCloseTo(300, 4);
  });

  it('applies local-axis roll and face alignment without swapping semantic offsets', () => {
    const section: Section = { id: 'B-ROLL', kind: 'rc_beam_rect', width: 100, depth: 200 };
    const member: Member = {
      id: 'B-ROLL',
      type: 'beam',
      story: '1F',
      sectionId: section.id,
      materialId: 'M1',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 4000, y: 0, z: 0 },
      faceAlign: 'left',
      localAxis: { rotation: Math.PI / 2 },
    };

    const box = bounds(member, section);
    expect(box.max.x - box.min.x).toBeCloseTo(4000, 6);
    expect(box.max.y - box.min.y).toBeCloseTo(200, 6);
    expect(box.max.z - box.min.z).toBeCloseTo(100, 6);
    expect((box.min.y + box.max.y) / 2).toBeCloseTo(50, 6);
  });

  it('places a left-face-aligned wall wholly to the left of its reference axis', () => {
    const section: Section = { id: 'W', kind: 'rc_wall', thickness: 200 };
    const member: Member = {
      id: 'W1',
      type: 'wall',
      story: '1F',
      sectionId: section.id,
      materialId: 'M1',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 4000, y: 0, z: 0 },
      height: 3000,
      thickness: 200,
      faceAlign: 'left',
    };

    const box = bounds(member, section);
    expect(box.min.y).toBeCloseTo(0, 6);
    expect(box.max.y).toBeCloseTo(200, 6);
    expect(box.max.z - box.min.z).toBeCloseTo(3000, 6);
  });
});
