import Ajv2020 from 'ajv/dist/2020';
import schema from '@/schemas/project.schema.json';
import type { ValidationResult } from './types';

const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(schema);

export function validateSchema(data: unknown): ValidationResult {
  const valid = validate(data);
  if (valid) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: (validate.errors ?? []).map((e) => ({
      level: 'error' as const,
      message: `Schema: ${e.instancePath || '/'} ${e.message ?? 'unknown error'}`,
      path: e.instancePath || undefined,
    })),
  };
}
