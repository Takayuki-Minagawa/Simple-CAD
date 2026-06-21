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

  let current = data as Record<string, unknown>;
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
