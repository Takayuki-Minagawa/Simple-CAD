import type { ProjectData } from '@/domain/structural/types';
import type { ValidationResult } from './types';
import { mergeResults } from './types';
import { validateSchema } from './schemaValidator';
import { validateReferences } from './referenceValidator';
import { validateGeometry } from './geometryValidator';
import { validateTopology } from './topologyValidator';

export type { ValidationResult, ValidationError } from './types';

/**
 * 4-stage validation pipeline:
 * 1. JSON Schema structural validation
 * 2. Reference integrity check
 * 3. Geometry validation
 * 4. Topology / level / joint integrity (warnings)
 */
export function validateProject(data: unknown): ValidationResult {
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

  return mergeResults(schemaResult, refResult, geoResult, topoResult);
}
