import type { ProjectData } from '@/domain/structural/types';
import type { ValidationResult } from './types';
import { mergeResults } from './types';
import { validateSchema } from './schemaValidator';
import { validateReferences } from './referenceValidator';
import { validateGeometry } from './geometryValidator';
import { validateTopology } from './topologyValidator';
import { validateSections } from './sectionValidator';

export { validateReferences } from './referenceValidator';
export { validateGeometry } from './geometryValidator';
export { validateSections } from './sectionValidator';

export type { ValidationResult, ValidationError } from './types';

const MAX_EXTERNAL_REF_DEPTH = 8;

/**
 * 4-stage validation pipeline:
 * 1. JSON Schema structural validation
 * 2. Reference integrity check
 * 3. Geometry validation
 * 4. Topology / level / joint integrity (warnings)
 * 5. Section plausibility checks (warnings)
 */
export function validateProject(data: unknown): ValidationResult {
  return validateProjectAtDepth(data, 0);
}

function validateProjectAtDepth(data: unknown, depth: number): ValidationResult {
  // Stage 1: Schema
  const schemaResult = validateSchema(data);
  if (!schemaResult.ok) return schemaResult;

  // After schema passes, we can safely cast
  const project = data as ProjectData;

  // Stage 2: Reference integrity
  const refResult = validateReferences(project);

  // Stage 3: Geometry
  const geoResult = validateGeometry(project);

  // Stage 4: Topology / level / joint integrity
  const topoResult = validateTopology(project);

  // Stage 5: engineering plausibility of section dimensions
  const sectionResult = validateSections(project);

  const externalResults: ValidationResult[] = [];
  for (let index = 0; index < (project.externalRefs?.length ?? 0); index += 1) {
    const reference = project.externalRefs![index];
    if (depth >= MAX_EXTERNAL_REF_DEPTH) {
      externalResults.push({
        ok: false,
        errors: [
          {
            level: 'error',
            message: `ExternalRef "${reference.id}": ネスト深度が上限 ${MAX_EXTERNAL_REF_DEPTH} を超えています`,
            path: `/externalRefs/${index}/data`,
          },
        ],
      });
      continue;
    }
    const nested = validateProjectAtDepth(reference.data, depth + 1);
    externalResults.push({
      ok: nested.ok,
      errors: nested.errors.map((error) => ({
        ...error,
        message: `ExternalRef "${reference.id}": ${error.message}`,
        path: `/externalRefs/${index}/data${error.path ?? ''}`,
      })),
    });
  }

  return mergeResults(
    schemaResult,
    refResult,
    geoResult,
    topoResult,
    sectionResult,
    ...externalResults,
  );
}
