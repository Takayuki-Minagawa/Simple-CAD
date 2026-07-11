import { describe, expect, it } from 'vitest';
import {
  instantiateHSection,
  JIS_H_SECTION_LIBRARY,
  uniqueHSectionId,
} from '../sectionLibrary';

describe('JIS H-section library', () => {
  it('contains valid rolled H geometries and instantiates either member kind', () => {
    expect(JIS_H_SECTION_LIBRARY.length).toBeGreaterThanOrEqual(10);
    for (const entry of JIS_H_SECTION_LIBRARY) {
      expect(entry.tw).toBeLessThan(entry.width);
      expect(entry.tf * 2).toBeLessThan(entry.depth);
    }

    const section = instantiateHSection(JIS_H_SECTION_LIBRARY[0], 's_beam_h', 'SEC-B-H100');
    expect(section).toEqual({
      id: 'SEC-B-H100',
      kind: 's_beam_h',
      width: 100,
      depth: 100,
      tw: 6,
      tf: 8,
    });
    expect(
      uniqueHSectionId(JIS_H_SECTION_LIBRARY[0], 's_beam_h', [
        'SEC-B-H100x100x6x8',
        'SEC-B-H100x100x6x8-2',
      ]),
    ).toBe('SEC-B-H100x100x6x8-3');
  });
});
