export interface ValidationError {
  level: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  /** ID of the entity the issue belongs to, when it can be resolved. */
  entityId?: string;
  /** Dotted field path inside the entity (e.g. `lineWeight`, `start.x`). */
  field?: string;
  /** Raw/technical detail (e.g. the original JSON Schema error). */
  detail?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

export function mergeResults(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  return {
    ok: errors.every((e) => e.level !== 'error'),
    errors,
  };
}
