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

  it('enforces nonnegative masses and member-load kind-specific fields', () => {
    const invalidMass = {
      ...sampleProject,
      masses: [
        { id: 'M1', storyId: '1F', position: { x: 0, y: 0, z: 0 }, mass: { x: -1, y: 1, z: 1 } },
      ],
    };
    expect(validateSchema(invalidMass).ok).toBe(false);

    const missingPointPosition = {
      ...sampleProject,
      memberLoads: [
        {
          id: 'P1', loadCaseId: 'LC', memberId: 'B1', kind: 'point',
          direction: 'globalZ', magnitude: -1,
        },
      ],
    };
    expect(validateSchema(missingPointPosition).ok).toBe(false);
  });

  it('accepts complete wood properties and rejects mixed material-family keys', () => {
    const wood = {
      ...sampleProject,
      materials: [
        {
          id: 'MAT-WOOD',
          name: 'Wood E70',
          type: 'wood',
          elasticModulus: 7000,
          shearModulus: 440,
          poissonRatio: 0.3,
          unitWeight: 3.8,
          referenceStrength: 21.6,
          moistureContent: 15,
          allowableBendingStress: 7.2,
          allowableCompressionStress: 6,
          allowableShearStress: 0.6,
        },
      ],
      members: [],
      openings: [],
      dimensions: [],
      annotations: [],
    };
    expect(validateSchema(wood).ok).toBe(true);

    const mixed = structuredClone(wood);
    Object.assign(mixed.materials[0], { Fc: 24, Fy: 235 });
    expect(validateSchema(mixed).ok).toBe(false);
  });

  it('enforces material property ranges', () => {
    const invalid = {
      ...sampleProject,
      materials: [
        {
          id: 'MAT-WOOD',
          name: 'Invalid wood',
          type: 'wood',
          elasticModulus: 0,
          poissonRatio: 0.5,
          moistureContent: 101,
        },
      ],
      members: [],
      openings: [],
      dimensions: [],
      annotations: [],
    };
    expect(validateSchema(invalid).ok).toBe(false);
  });
});
