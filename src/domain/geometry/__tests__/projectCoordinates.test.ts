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

  it('preserves dimensionless direction and reference vectors exactly', () => {
    const base = sampleProject as ProjectData;
    const first = base.members.find((member) => member.type !== 'slab');
    if (!first) throw new Error('linear fixture required');
    const direction = { x: 0.999999239631, y: 0.001233127891 };
    const referenceVector = { x: 0.000000731, y: 0.707106411, z: 0.707107151 };
    const project: ProjectData = {
      ...base,
      members: [{ ...first, localAxis: { rotation: 0, referenceVector } }],
      constructionLines: [
        { id: 'CL-1', story: first.story, type: 'xline', origin: { x: 0, y: 0 }, direction },
      ],
    };

    const normalized = normalizeProjectCoordinates(project);

    expect(normalized.constructionLines?.[0].direction).toEqual(direction);
    expect(normalized.members[0].localAxis?.referenceVector).toEqual(referenceVector);
  });
});
