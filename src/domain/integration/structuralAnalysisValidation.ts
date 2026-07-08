import Ajv2020 from 'ajv/dist/2020';
import type { ValidationError } from '@/domain/validation';
import analysisSchema from '@/schemas/structuralAnalysis.schema.json';
import type { StructuralAnalysisModel } from './structuralAnalysisJson';

const ajv = new Ajv2020({ allErrors: true });
const validateAnalysisSchema = ajv.compile(analysisSchema);

/**
 * Validate the structural-analysis JSON with the JSON Schema plus
 * reference-integrity checks that schema alone cannot express.
 */
export function validateStructuralAnalysisModel(
  value: unknown,
  expectedSchema: string,
): ValidationError[] {
  if (isRecord(value) && value.schema !== expectedSchema) {
    return [
      {
        level: 'error',
        message: `Unsupported structural analysis schema: ${String(value.schema)}`,
        path: '/schema',
      },
    ];
  }

  const valid = validateAnalysisSchema(value);
  if (!valid) {
    return (validateAnalysisSchema.errors ?? []).map((error) => ({
      level: 'error' as const,
      message: `Schema: ${error.instancePath || '/'} ${error.message ?? 'unknown error'}`,
      path: error.instancePath || undefined,
    }));
  }

  const model = value as unknown as StructuralAnalysisModel;
  const errors: ValidationError[] = [];
  const nodeIds = new Set(model.nodes.map((node) => node.id));

  for (const member of model.linearMembers) {
    if (!nodeIds.has(member.startNodeId)) {
      errors.push({
        level: 'error',
        message: `linearMember ${member.id} references missing startNode ${member.startNodeId}`,
        path: '/linearMembers',
      });
    }
    if (!nodeIds.has(member.endNodeId)) {
      errors.push({
        level: 'error',
        message: `linearMember ${member.id} references missing endNode ${member.endNodeId}`,
        path: '/linearMembers',
      });
    }
  }

  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
