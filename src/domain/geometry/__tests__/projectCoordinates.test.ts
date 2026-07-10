import { describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { normalizeProjectCoordinates } from '../projectCoordinates';

describe('normalizeProjectCoordinates', () => {
  it('quantizes imported/member/support/result positions at the project boundary', () => {
    const base = sampleProject as ProjectData;
    const first = base.members[0];
    if (first.type === 'slab') throw new Error('linear fixture required');
    const project: ProjectData = {
      ...base,
      members: [
        {
          ...first,
          start: { ...first.start, x: 1.00049 },
        },
      ],
      supports: [
        {
          id: 'SUP',
          storyId: first.story,
          position: { x: 2.00051, y: 0, z: 0 },
          restraints: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
        },
      ],
      analysisResults: {
        source: 'test',
        analysisType: 'static',
        generatedAt: '2026-01-01T00:00:00Z',
        nodeDisplacements: [
          { position: { x: 3.00049, y: 0, z: 0 }, dx: 0, dy: 0, dz: 0 },
        ],
      },
    };

    const normalized = normalizeProjectCoordinates(project);
    const member = normalized.members[0];
    expect(member.type !== 'slab' && member.start.x).toBe(1);
    expect(normalized.supports?.[0].position.x).toBe(2.001);
    expect(normalized.analysisResults?.nodeDisplacements?.[0].position.x).toBe(3);
  });
});
