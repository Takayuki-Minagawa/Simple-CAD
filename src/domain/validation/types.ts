export interface ValidationError {
  level: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
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
