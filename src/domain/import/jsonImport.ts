import type { ProjectData } from '@/domain/structural/types';
import { validateProject } from '@/domain/validation';
import type { ValidationError } from '@/domain/validation';
import { migrate } from '@/domain/migration';
import { normalizeProjectCoordinates } from '@/domain/geometry/projectCoordinates';

export function importProjectJson(
  rawContent: string,
): { ok: true; data: ProjectData } | { ok: false; errors: ValidationError[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (e) {
    return {
      ok: false,
      errors: [{ level: 'error', message: `JSON parse error: ${String(e)}` }],
    };
  }

  // Up-migrate older/legacy payloads to the current schema version BEFORE
  // schema validation, so strict `additionalProperties:false` rules don't reject
  // forward-compatible files (3-7).
  const migrated = migrate(parsed);

  // Coordinate normalization traverses every persisted collection. Validate
  // the migrated payload first so malformed JSON (for example `{}` or a
  // missing `members` array) is reported as a structured validation failure
  // instead of escaping as a TypeError from the normalizer.
  const migratedResult = validateProject(migrated);
  if (!migratedResult.ok) {
    return { ok: false, errors: migratedResult.errors };
  }

  const normalized = normalizeProjectCoordinates(migrated);
  const result = validateProject(normalized);
  if (!result.ok) {
    return { ok: false, errors: result.errors };
  }

  return { ok: true, data: normalized };
}
