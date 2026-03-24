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
