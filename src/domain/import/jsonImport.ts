import type { ProjectData } from '@/domain/structural/types';
import { validateProject } from '@/domain/validation';
import type { ValidationError } from '@/domain/validation';

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

  const result = validateProject(parsed);
  if (!result.ok) {
    return { ok: false, errors: result.errors };
  }

  return { ok: true, data: parsed as ProjectData };
}
