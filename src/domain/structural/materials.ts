import type { Material, MaterialBase } from './types';

export type MaterialType = Material['type'];

/** Runtime guard used at import/store boundaries. */
export function isMaterialType(value: unknown): value is MaterialType {
  return value === 'concrete' || value === 'steel' || value === 'wood' || value === 'other';
}

/**
 * Merge editable properties and rebuild the discriminated branch from known
 * keys. Rebuilding is deliberate: changing type cannot retain stale strength
 * fields from the previous material family.
 */
export function mergeMaterial(material: Material, updates: Partial<Material>): Material {
  const source = { ...material, ...updates } as Material;
  const type = isMaterialType(source.type) ? source.type : material.type;
  const common: Omit<MaterialBase, 'type'> = {
    id: source.id ?? material.id,
    name: source.name ?? material.name,
    ...(source.elasticModulus !== undefined ? { elasticModulus: source.elasticModulus } : {}),
    ...(source.shearModulus !== undefined ? { shearModulus: source.shearModulus } : {}),
    ...(source.poissonRatio !== undefined ? { poissonRatio: source.poissonRatio } : {}),
    ...(source.unitWeight !== undefined ? { unitWeight: source.unitWeight } : {}),
  };

  switch (type) {
    case 'concrete':
      return {
        ...common,
        type,
        ...(source.Fc !== undefined ? { Fc: source.Fc } : {}),
      };
    case 'steel':
      return {
        ...common,
        type,
        ...(source.F !== undefined ? { F: source.F } : {}),
        ...(source.Fy !== undefined ? { Fy: source.Fy } : {}),
      };
    case 'wood':
      return {
        ...common,
        type,
        ...(source.referenceStrength !== undefined
          ? { referenceStrength: source.referenceStrength }
          : {}),
        ...(source.moistureContent !== undefined
          ? { moistureContent: source.moistureContent }
          : {}),
        ...(source.allowableBendingStress !== undefined
          ? { allowableBendingStress: source.allowableBendingStress }
          : {}),
        ...(source.allowableCompressionStress !== undefined
          ? { allowableCompressionStress: source.allowableCompressionStress }
          : {}),
        ...(source.allowableShearStress !== undefined
          ? { allowableShearStress: source.allowableShearStress }
          : {}),
      };
    case 'other':
      return { ...common, type };
  }
}

/** Change the discriminant while preserving common fields and clearing old family fields. */
export function changeMaterialType(material: Material, type: MaterialType): Material {
  return mergeMaterial(material, { type } as Partial<Material>);
}
