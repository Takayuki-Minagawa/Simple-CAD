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

  it('detects section.kind ↔ member.type mismatch', () => {
    const data: ProjectData = {
      ...validData,
      members: [
        {
          id: 'C-BADSEC',
          type: 'column',
          story: '1F',
          // rc_slab section used by a column → inconsistent
          sectionId: 'SEC-SLAB180',
          materialId: 'MAT-RC-24',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 0, y: 0, z: 3000 },
        },
      ],
    };
    const result = validateReferences(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('section.kind'))).toBe(true);
  });

  it('detects group referencing a missing member', () => {
    const data: ProjectData = {
      ...validData,
      groups: [{ id: 'G1', name: 'g', memberIds: ['NON_EXISTENT'] }],
    };
    const result = validateReferences(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Group'))).toBe(true);
  });

  it('detects viewport referencing a missing view', () => {
    const data: ProjectData = {
      ...validData,
      sheets: [
        {
          ...validData.sheets[0],
          viewports: [
            {
              id: 'VP1',
              sheetId: validData.sheets[0].id,
              viewId: 'NON_EXISTENT_VIEW',
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              scale: '1:100',
            },
          ],
        },
        ...validData.sheets.slice(1),
      ],
    };
    const result = validateReferences(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Viewport'))).toBe(true);
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
