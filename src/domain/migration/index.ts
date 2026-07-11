import type { ProjectData } from '@/domain/structural/types';

/**
 * schemaVersion migration framework (3-7).
 *
 * `additionalProperties: false` in the project schema makes the validator strict,
 * so older JSON files (or files produced by future intermediate versions) must be
 * up-migrated to the current shape BEFORE schema validation. This module applies a
 * chain of single-step migrations keyed on the source `schemaVersion`.
 *
 * To add a step: register a `MigrationStep` whose `from` matches the stored
 * version and whose `to` is the next version, transforming the raw object. The
 * runner applies steps until it reaches `CURRENT_SCHEMA_VERSION` (or runs out of
 * applicable steps, in which case it returns the data untouched and lets schema
 * validation report any incompatibility).
 */

export const CURRENT_SCHEMA_VERSION = '1.0.0';

export interface MigrationStep {
  from: string;
  to: string;
  migrate: (data: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Ordered list of migration steps. Currently only the identity baseline at
 * 1.0.0 exists; future versions append steps here (e.g. 1.0.0 → 1.1.0 adding
 * material properties / steel section kinds).
 */
export const MIGRATIONS: MigrationStep[] = [];

const MATERIAL_FAMILY_FIELDS = [
  'Fc',
  'F',
  'Fy',
  'referenceStrength',
  'moistureContent',
  'allowableBendingStress',
  'allowableCompressionStress',
  'allowableShearStress',
] as const;

const MATERIAL_FIELDS_BY_TYPE: Record<string, ReadonlySet<string>> = {
  concrete: new Set(['Fc']),
  steel: new Set(['F', 'Fy']),
  wood: new Set([
    'referenceStrength',
    'moistureContent',
    'allowableBendingStress',
    'allowableCompressionStress',
    'allowableShearStress',
  ]),
  other: new Set(),
};

const LEGACY_MAX_POISSON_RATIO = 0.499999;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeMaterial(material: unknown): void {
  if (!isRecord(material) || typeof material.type !== 'string') return;
  const allowedFamilyFields = MATERIAL_FIELDS_BY_TYPE[material.type];
  if (!allowedFamilyFields) return;

  // Version 1.0 allowed all legacy strength keys on every material. A type
  // change therefore commonly left fields from the previous family behind.
  for (const field of MATERIAL_FAMILY_FIELDS) {
    if (!allowedFamilyFields.has(field)) delete material[field];
  }

  // Version 1.0 also allowed the incompressible limit itself. Keep legacy
  // documents loadable while moving the value just inside the current domain.
  if (material.poissonRatio === 0.5) {
    material.poissonRatio = LEGACY_MAX_POISSON_RATIO;
  }
}

function sanitizeProjectMaterialContainers(container: Record<string, unknown>): void {
  if (Array.isArray(container.materials)) {
    container.materials.forEach(sanitizeMaterial);
  }

  if (!Array.isArray(container.externalRefs)) return;
  for (const reference of container.externalRefs) {
    if (!isRecord(reference) || !isRecord(reference.data)) continue;
    sanitizeProjectMaterialContainers(reference.data);
  }
}

/**
 * Remove fields that were legal in version 1.0 documents but conflict with
 * the current discriminated material schema. This compatibility pass is
 * intentionally independent of schemaVersion because the legacy and current
 * document shapes share the same public version number.
 */
export function migrateLegacyMaterials<T>(data: T): T {
  if (!isRecord(data)) return data;
  const migrated = structuredClone(data) as T;
  sanitizeProjectMaterialContainers(migrated as Record<string, unknown>);
  return migrated;
}

function getVersion(data: unknown): string {
  if (data && typeof data === 'object' && 'schemaVersion' in data) {
    const v = (data as { schemaVersion?: unknown }).schemaVersion;
    if (typeof v === 'string') return v;
  }
  // Treat a missing/invalid version as the current baseline so untouched data
  // passes through; schema validation will catch genuinely malformed input.
  return CURRENT_SCHEMA_VERSION;
}

/**
 * Migrate raw project data up to the current schema version.
 *
 * Pure and defensive: unknown input is returned unchanged (validation runs
 * afterwards). The return type is `ProjectData` for caller ergonomics, but the
 * value is only guaranteed to be schema-valid after `validateProject`.
 */
export function migrate(data: unknown): ProjectData {
  if (!data || typeof data !== 'object') return data as ProjectData;

  let current = migrateLegacyMaterials(data) as Record<string, unknown>;
  let version = getVersion(current);

  // Apply steps until we reach the current version or no step applies.
  // Guard against cycles with a bounded iteration count.
  for (let guard = 0; guard < MIGRATIONS.length + 1; guard++) {
    if (version === CURRENT_SCHEMA_VERSION) break;
    const step = MIGRATIONS.find((s) => s.from === version);
    if (!step) break;
    current = step.migrate(current);
    current.schemaVersion = step.to;
    version = step.to;
  }

  return current as unknown as ProjectData;
}
