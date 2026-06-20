import type { ProjectData } from '@/domain/structural/types';
import { validateProject } from '@/domain/validation';
import type { ValidationError } from '@/domain/validation';
import { migrate } from '@/domain/migration';

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

  const result = validateProject(migrated);
  if (!result.ok) {
    return { ok: false, errors: result.errors };
  }

  return { ok: true, data: migrated };
}
