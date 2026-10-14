import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject } from 'ajv';
import schema from '@/schemas/project.schema.json';
import type { ValidationError, ValidationResult } from './types';

const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(schema);

/** Discriminator properties used by the schema's `oneOf` unions. */
const DISCRIMINATORS = ['type', 'kind'] as const;

type SchemaNode = Record<string, unknown>;

const rootSchema = schema as unknown as SchemaNode;
const defs = (rootSchema.$defs ?? {}) as Record<string, SchemaNode>;

function resolveRef(node: SchemaNode | undefined): SchemaNode | undefined {
  let current = node;
  for (let guard = 0; current && typeof current.$ref === 'string' && guard < 8; guard += 1) {
    const ref = current.$ref as string;
    const match = ref.match(/^#\/\$defs\/([^/]+)$/);
    if (!match) return current;
    current = defs[match[1]];
  }
  return current;
}

/** Walk the schema along a JSON pointer, resolving `$ref`, `properties` and `items`. */
function schemaAt(instancePath: string): SchemaNode | undefined {
  let node: SchemaNode | undefined = resolveRef(rootSchema);
  for (const segment of instancePath.split('/').filter(Boolean)) {
    if (!node) return undefined;
    const properties = node.properties as Record<string, SchemaNode> | undefined;
    if (properties && segment in properties) {
      node = resolveRef(properties[segment]);
    } else if (node.items && /^\d+$/.test(segment)) {
      node = resolveRef(node.items as SchemaNode);
    } else {
      return undefined;
    }
  }
  return node;
}

function valueAt(data: unknown, instancePath: string): unknown {
  let current: unknown = data;
  for (const segment of instancePath.split('/').filter(Boolean)) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

const branchValidators = new Map<SchemaNode, ReturnType<typeof ajv.compile>>();

function compileBranch(branch: SchemaNode) {
  let compiled = branchValidators.get(branch);
  if (!compiled) {
    // Re-root the branch so that its nested `#/$defs/...` references still resolve.
    const standalone = resolveRef(branch) ?? branch;
    compiled = ajv.compile({ ...standalone, $defs: defs });
    branchValidators.set(branch, compiled);
  }
  return compiled;
}

function discriminatorOf(branch: SchemaNode): { key: string; value: unknown } | null {
  const properties = (resolveRef(branch)?.properties ?? {}) as Record<string, SchemaNode>;
  for (const key of DISCRIMINATORS) {
    const property = properties[key];
    if (property && 'const' in property) return { key, value: property.const };
  }
  return null;
}

/**
 * Collapse the error fan-out that Ajv produces for `oneOf` unions. For every
 * object that failed a union, pick the branch whose discriminator (`type` /
 * `kind`) matches the object and re-validate against that branch alone, so only
 * the errors the user can act on remain (R03). When no branch matches, a single
 * error naming the allowed discriminator values is kept instead.
 */
export function consolidateSchemaErrors(errors: ErrorObject[], data: unknown): ErrorObject[] {
  const unionPaths = errors.filter((error) => error.keyword === 'oneOf').map((error) => error.instancePath);
  if (unionPaths.length === 0) return errors;

  let result = errors;
  for (const path of unionPaths) {
    const node = schemaAt(path);
    const branches = node?.oneOf as SchemaNode[] | undefined;
    if (!branches) continue;
    const value = valueAt(data, path) as Record<string, unknown> | undefined;
    const discriminators = branches.map(discriminatorOf);
    const matchIndex = discriminators.findIndex(
      (d) => d && value && typeof value === 'object' && value[d.key] === d.value,
    );

    const outside = result.filter(
      (error) => error.instancePath !== path && !error.instancePath.startsWith(`${path}/`),
    );
    if (matchIndex >= 0) {
      const validateBranch = compileBranch(branches[matchIndex]);
      validateBranch(value);
      const replacement = (validateBranch.errors ?? []).map((error) => ({
        ...error,
        instancePath: `${path}${error.instancePath}`,
      }));
      result = [...outside, ...replacement];
    } else {
      const known = discriminators.filter((d): d is { key: string; value: unknown } => d != null);
      const key = known[0]?.key ?? 'type';
      const allowed = known.map((d) => String(d.value));
      result = [
        ...outside,
        {
          keyword: 'enum',
          instancePath: `${path}/${key}`,
          schemaPath: '#/oneOf',
          params: { allowedValues: allowed },
          message: `must be equal to one of the allowed values`,
        } as ErrorObject,
      ];
    }
  }
  return result;
}

/** Human-readable (Japanese) reason for a schema violation. */
export function describeSchemaError(error: ErrorObject): string {
  const params = error.params as Record<string, unknown>;
  switch (error.keyword) {
    case 'required':
      return `必須項目「${String(params.missingProperty)}」がありません`;
    case 'exclusiveMinimum':
      return `${String(params.limit)} より大きい値にしてください`;
    case 'minimum':
      return `${String(params.limit)} 以上の値にしてください`;
    case 'exclusiveMaximum':
      return `${String(params.limit)} より小さい値にしてください`;
    case 'maximum':
      return `${String(params.limit)} 以下の値にしてください`;
    case 'minLength':
      return '空にできません';
    case 'minItems':
      return `${String(params.limit)} 個以上の要素が必要です`;
    case 'type':
      return `型が不正です（${String(params.type)} が必要）`;
    case 'const':
      return `「${String(params.allowedValue)}」である必要があります`;
    case 'enum':
      return `次のいずれかにしてください: ${(params.allowedValues as unknown[]).map(String).join(', ')}`;
    case 'additionalProperties':
      return `不明な項目「${String(params.additionalProperty)}」があります`;
    case 'oneOf':
      return '定義されたいずれの種別にも一致しません';
    default:
      return error.message ?? 'unknown error';
  }
}

/**
 * Resolve `/collection/index/field...` to the entity ID and field name so that
 * the UI can show `beam-001 › lineWeight` instead of `/members/13/lineWeight`.
 */
export function resolveSchemaErrorTarget(
  data: unknown,
  instancePath: string,
): { entityId?: string; field?: string } {
  const segments = instancePath.split('/').filter(Boolean);
  if (segments.length === 0) return {};
  const [collection, index, ...rest] = segments;
  const root = data as Record<string, unknown> | null;
  const list = root && typeof root === 'object' ? root[collection] : undefined;
  if (Array.isArray(list) && index != null && /^\d+$/.test(index)) {
    const item = list[Number(index)] as { id?: unknown } | undefined;
    const entityId = item && typeof item.id === 'string' ? item.id : undefined;
    return { entityId, field: rest.length > 0 ? rest.join('.') : undefined };
  }
  return { field: segments.join('.') };
}

export function validateSchema(data: unknown): ValidationResult {
  const valid = validate(data);
  if (valid) return { ok: true, errors: [] };
  const errors: ValidationError[] = consolidateSchemaErrors(validate.errors ?? [], data).map((e) => {
    const target = resolveSchemaErrorTarget(data, e.instancePath);
    const reason = describeSchemaError(e);
    const subject = target.entityId
      ? `${target.entityId}${target.field ? ` › ${target.field}` : ''}`
      : e.instancePath || '/';
    return {
      level: 'error' as const,
      message: `Schema: ${subject}: ${reason}`,
      path: e.instancePath || undefined,
      entityId: target.entityId,
      field: target.field,
      detail: `${e.instancePath || '/'} ${e.message ?? 'unknown error'}`,
    };
  });
  return { ok: false, errors };
}
