import { describe, it, expect } from 'vitest';
import { validateGeometry } from '../geometryValidator';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';

const validData = sampleProject as unknown as ProjectData;

describe('validateGeometry', () => {
  it('passes for valid sample project', () => {
    const result = validateGeometry(validData);
    expect(result.ok).toBe(true);
  });

  it('detects zero-length column', () => {
    const data: ProjectData = {
      ...validData,
      members: [
        {
          id: 'C-ZERO',
          type: 'column',
          story: '1F',
          sectionId: 'SEC-C600',
          materialId: 'MAT-RC-24',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 0, y: 0, z: 0 },
        },
      ],
    };
    const result = validateGeometry(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('長さ0'))).toBe(true);
  });

  it('detects non-finite coordinates (NaN/Infinity)', () => {
    const data: ProjectData = {
      ...validData,
      members: [
        {
          id: 'C-NAN',
          type: 'column',
          story: '1F',
          sectionId: 'SEC-C600',
          materialId: 'MAT-RC-24',
          start: { x: 0, y: 0, z: 0 },
          end: { x: Number.NaN, y: 0, z: 3000 },
        },
      ],
    };
    const result = validateGeometry(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('有限値'))).toBe(true);
  });

  it('warns on a self-intersecting slab polygon', () => {
    const data: ProjectData = {
      ...validData,
      members: [
        {
          id: 'SLAB-BOWTIE',
          type: 'slab',
          story: '1F',
          sectionId: 'SEC-SLAB180',
          materialId: 'MAT-RC-24',
          // Self-intersecting ordering with non-zero net area.
          polygon: [
            { x: 0, y: 0 },
            { x: 2000, y: 0 },
            { x: 0, y: 1000 },
            { x: 2000, y: 1000 },
          ],
          level: 3000,
        },
      ],
    };
    const result = validateGeometry(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.level === 'error' && e.message.includes('自己交差'))).toBe(true);
  });

  it('rejects a duplicate-vertex slab polygon', () => {
    const data: ProjectData = {
      ...validData,
      members: [
        {
          id: 'SLAB-DUP',
          type: 'slab',
          story: '1F',
          sectionId: 'SEC-SLAB180',
          materialId: 'MAT-RC-24',
          polygon: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
            { x: 1000, y: 0 },
            { x: 1000, y: 1000 },
            { x: 0, y: 1000 },
          ],
          level: 3000,
        },
      ],
    };
    const result = validateGeometry(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.level === 'error' && e.message.includes('重複頂点'))).toBe(true);
  });

  it('rejects a collinear (degenerate) slab polygon', () => {
    const data: ProjectData = {
      ...validData,
      members: [
        {
          id: 'SLAB-LINE',
          type: 'slab',
          story: '1F',
          sectionId: 'SEC-SLAB180',
          materialId: 'MAT-RC-24',
          polygon: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
            { x: 2000, y: 0 },
          ],
          level: 3000,
        },
      ],
    };
    const result = validateGeometry(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.level === 'error' && e.message.includes('共線退化'))).toBe(true);
  });

  it('detects slab with less than 3 vertices', () => {
    const data: ProjectData = {
      ...validData,
      members: [
        {
          id: 'SLAB-BAD',
          type: 'slab',
          story: '1F',
          sectionId: 'SEC-SLAB180',
          materialId: 'MAT-RC-24',
          polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }],
          level: 3000,
        },
      ],
    };
    const result = validateGeometry(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('頂点が3未満'))).toBe(true);
  });

  it('rejects rigid zones whose total reaches the member length', () => {
    const beam = validData.members.find((member) => member.type === 'beam')!;
    const length = Math.hypot(
      beam.end.x - beam.start.x,
      beam.end.y - beam.start.y,
      beam.end.z - beam.start.z,
    );
    const data: ProjectData = {
      ...validData,
      members: [{ ...beam, rigidZones: { start: length / 2, end: length / 2 } }],
    };

    const result = validateGeometry(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.message.includes('rigidZones'))).toBe(true);
  });

  it('rejects negative mass components and missing kind-specific member-load values', () => {
    const data: ProjectData = {
      ...validData,
      loadCases: [{ id: 'LC', name: 'Load', type: 'other' }],
      masses: [
        { id: 'M1', storyId: '1F', position: { x: 0, y: 0, z: 0 }, mass: { x: -1, y: 1, z: 1 } },
      ],
      memberLoads: [
        {
          id: 'P1', loadCaseId: 'LC', memberId: validData.members[0].id,
          kind: 'point', direction: 'globalZ', magnitude: -1,
        },
        {
          id: 'T1', loadCaseId: 'LC', memberId: validData.members[0].id,
          kind: 'trapezoidal', direction: 'globalZ', magnitude: -1,
        },
      ],
    };

    const result = validateGeometry(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.message.includes('0以上'))).toBe(true);
    expect(result.errors.some((error) => error.message.includes('position'))).toBe(true);
    expect(result.errors.some((error) => error.message.includes('endMagnitude'))).toBe(true);
  });

  it('rejects a local-axis reference vector parallel to the member axis', () => {
    const beam = validData.members.find((member) => member.type === 'beam');
    expect(beam?.type).toBe('beam');
    if (!beam || beam.type !== 'beam') return;
    const axis = {
      x: beam.end.x - beam.start.x,
      y: beam.end.y - beam.start.y,
      z: beam.end.z - beam.start.z,
    };
    const result = validateGeometry({
      ...validData,
      members: [{ ...beam, localAxis: { rotation: 0, referenceVector: axis } }],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.message.includes('referenceVector'))).toBe(true);
  });
});
