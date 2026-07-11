import { describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { validateSections } from '../sectionValidator';

describe('validateSections', () => {
  it('warns about implausibly small RC dimensions and cover', () => {
    const data = structuredClone(sampleProject) as unknown as ProjectData;
    data.sections = [
      { id: 'SMALL-C', kind: 'rc_column_rect', width: 90, depth: 100, cover: 5 },
    ];

    const result = validateSections(data);
    expect(result.ok).toBe(true);
    expect(result.errors.some((error) => error.message.includes('幅・せい'))).toBe(true);
    expect(result.errors.some((error) => error.message.includes('かぶり'))).toBe(true);
  });

  it('warns when an H section is missing its plate thicknesses', () => {
    const data = structuredClone(sampleProject) as unknown as ProjectData;
    data.sections = [{ id: 'H-BAD', kind: 's_beam_h', width: 200, depth: 400 }];

    expect(validateSections(data).errors.some((error) => error.message.includes('tw/tf'))).toBe(true);
  });

  it('rejects impossible H-plate and pipe proportions from external data', () => {
    const data = structuredClone(sampleProject) as unknown as ProjectData;
    data.sections = [
      { id: 'H-IMPOSSIBLE', kind: 's_beam_h', width: 100, depth: 100, tw: 100, tf: 50 },
      { id: 'P-IMPOSSIBLE', kind: 's_pipe', diameter: 100, thickness: 50 },
    ];

    const result = validateSections(data);
    expect(result.ok).toBe(false);
    expect(result.errors.filter((error) => error.level === 'error')).toHaveLength(3);
  });
});
