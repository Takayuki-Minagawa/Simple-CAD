import { describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { importProjectJson } from '../jsonImport';

describe('importProjectJson', () => {
  it('returns schema errors instead of throwing for a malformed object', () => {
    expect(() => importProjectJson('{}')).not.toThrow();

    const result = importProjectJson('{}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.message.startsWith('Schema:'))).toBe(true);
    }
  });

  it('normalizes coordinates only after validating the migrated shape', () => {
    const input = structuredClone(sampleProject);
    input.grids[0].position = 1234.56789;

    const result = importProjectJson(JSON.stringify(input));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.grids[0].position).toBe(1234.568);
    }
  });

  it('migrates legacy mixed material keys and the old Poisson limit before validation', () => {
    const input = structuredClone(sampleProject);
    Object.assign(input.materials[0], {
      type: 'steel',
      Fc: 24,
      F: 235,
      Fy: 325,
      poissonRatio: 0.5,
    });

    const result = importProjectJson(JSON.stringify(input));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.materials[0]).toMatchObject({
        type: 'steel',
        F: 235,
        Fy: 325,
        poissonRatio: 0.499999,
      });
      expect('Fc' in result.data.materials[0]).toBe(false);
    }
  });

  it('also migrates materials in nested external references', () => {
    const input = structuredClone(sampleProject) as unknown as ProjectData;
    const nested = structuredClone(sampleProject) as unknown as ProjectData;
    Object.assign(nested.materials[0], { type: 'other', Fc: 24, F: 235 });
    input.externalRefs = [
      { id: 'X1', name: 'Legacy xref', data: nested, offsetX: 0, offsetY: 0, visible: true },
    ];

    const result = importProjectJson(JSON.stringify(input));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.externalRefs?.[0].data.materials[0]).toEqual({
        id: nested.materials[0].id,
        name: nested.materials[0].name,
        type: 'other',
      });
    }
  });
});
