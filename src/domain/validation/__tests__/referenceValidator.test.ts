import { describe, it, expect } from 'vitest';
import { validateReferences } from '../referenceValidator';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';

const validData = sampleProject as unknown as ProjectData;

describe('validateReferences', () => {
  it('passes for valid sample project', () => {
    const result = validateReferences(validData);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects invalid story reference in member', () => {
    const data: ProjectData = {
      ...validData,
      members: [
        {
          id: 'C-TEST',
          type: 'column',
          story: 'NON_EXISTENT',
          sectionId: 'SEC-C600',
          materialId: 'MAT-RC-24',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 0, y: 0, z: 3000 },
        },
      ],
    };
    const result = validateReferences(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('story'))).toBe(true);
  });

  it('detects duplicate IDs', () => {
    const data: ProjectData = {
      ...validData,
      stories: [
        { id: '1F', name: '1F', elevation: 0, height: 3000 },
        { id: '1F', name: '1F duplicate', elevation: 3000, height: 3000 },
      ],
    };
    const result = validateReferences(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('重複'))).toBe(true);
  });
});
