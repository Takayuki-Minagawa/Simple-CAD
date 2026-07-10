import { describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
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
});
