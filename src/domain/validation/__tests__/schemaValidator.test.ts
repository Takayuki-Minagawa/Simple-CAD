import { describe, it, expect } from 'vitest';
import { validateSchema } from '../schemaValidator';
import sampleProject from '@/samples/sample-project.json';

describe('validateSchema', () => {
  it('accepts valid sample project', () => {
    const result = validateSchema(sampleProject);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing schemaVersion', () => {
    const rest = { ...sampleProject };
    delete (rest as { schemaVersion?: string }).schemaVersion;
    const result = validateSchema(rest);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid member type', () => {
    const data = {
      ...sampleProject,
      members: [
        {
          id: 'test',
          type: 'invalid',
          story: '1F',
          sectionId: 'SEC-C600',
          materialId: 'MAT-RC-24',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 0, y: 0, z: 3000 },
        },
      ],
    };
    const result = validateSchema(data);
    expect(result.ok).toBe(false);
  });

  it('rejects non-object input', () => {
    const result = validateSchema('not an object');
    expect(result.ok).toBe(false);
  });

  it('rejects empty object', () => {
    const result = validateSchema({});
    expect(result.ok).toBe(false);
  });
});
