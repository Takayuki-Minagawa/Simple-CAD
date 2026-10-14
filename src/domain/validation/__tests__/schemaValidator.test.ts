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

describe('schema error consolidation (R03)', () => {
  it('reports one actionable error for a negative line weight instead of the oneOf fan-out', () => {
    const data = structuredClone(sampleProject) as typeof sampleProject & {
      members: Array<Record<string, unknown>>;
    };
    const index = data.members.findIndex((member) => member.type === 'beam');
    data.members[index] = { ...data.members[index], lineWeight: -20 };
    const result = validateSchema(data);
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    const [error] = result.errors;
    expect(error.entityId).toBe(data.members[index].id);
    expect(error.field).toBe('lineWeight');
    expect(error.message).toContain(`${String(data.members[index].id)} › lineWeight`);
    expect(error.message).toContain('0 より大きい値にしてください');
    expect(error.detail).toContain('/lineWeight must be > 0');
  });

  it('keeps the union error when no branch matches the discriminator', () => {
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
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ entityId: 'test', field: 'type' });
    expect(result.errors[0].message).toContain('column, beam, wall, slab');
  });
});
