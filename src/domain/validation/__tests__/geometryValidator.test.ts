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
    expect(result.errors.some((e) => e.message.includes('自己交差'))).toBe(true);
  });

  it('warns on a duplicate-vertex slab polygon', () => {
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
    expect(result.errors.some((e) => e.message.includes('重複頂点'))).toBe(true);
  });

  it('warns on a collinear (degenerate) slab polygon', () => {
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
    expect(result.errors.some((e) => e.message.includes('共線退化'))).toBe(true);
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
});
