import { asNumber, asRef, asRefList, asString } from './step';
import type { StepEntity, StepValue } from './types';

/**
 * Resolve the IFC project length unit to a millimetre scale factor (3-3).
 *
 * IFC files declare their units via `IFCUNITASSIGNMENT`, which references one
 * `IFCSIUNIT` (e.g. `.METRE.` with an optional `.MILLI.` prefix) or an
 * `IFCCONVERSIONBASEDUNIT` (e.g. inch/foot defined against an SI unit). Our
 * importer works internally in millimetres, so we multiply every coordinate /
 * length by this factor. Falls back to 1 (assume mm) when no length unit is
 * found, preserving prior behaviour.
 */
export function resolveLengthUnitScale(entities: Map<number, StepEntity>): number {
  const assignment = [...entities.values()].find((e) => e.type === 'IFCUNITASSIGNMENT');
  if (!assignment) return 1;

  for (const unitRef of asRefList(assignment.args[0])) {
    const unit = entities.get(unitRef);
    if (!unit) continue;
    const scale = unitToMm(unit, entities);
    if (scale !== null) return scale;
  }
  return 1;
}

/** Returns the mm-scale for a single length unit, or null if it isn't a length unit. */
function unitToMm(unit: StepEntity, entities: Map<number, StepEntity>): number | null {
  if (unit.type === 'IFCSIUNIT') {
    // IFCSIUNIT(*, .LENGTHUNIT., <prefix?>, .METRE.)
    const unitType = enumValue(unit.args[1]);
    if (unitType !== 'LENGTHUNIT') return null;
    const name = enumValue(unit.args[3]);
    if (name !== 'METRE') return null; // only METRE is a length SI unit
    const prefix = enumValue(unit.args[2]);
    return SI_PREFIX_TO_METRE_FACTOR(prefix) * 1000; // metre → mm
  }

  if (unit.type === 'IFCCONVERSIONBASEDUNIT') {
    // IFCCONVERSIONBASEDUNIT(<dimensions>, .LENGTHUNIT., <name>, <measureWithUnit>)
    const unitType = enumValue(unit.args[1]);
    if (unitType !== 'LENGTHUNIT') return null;
    const measureRef = asRef(unit.args[3]);
    const measure = measureRef ? entities.get(measureRef) : null;
    if (!measure || measure.type !== 'IFCMEASUREWITHUNIT') return null;
    // IFCMEASUREWITHUNIT(<valueComponent>, <unitComponent>)
    const factor = asNumber(measure.args[0]);
    const baseRef = asRef(measure.args[1]);
    const base = baseRef ? entities.get(baseRef) : null;
    const baseScale = base ? unitToMm(base, entities) : null;
    if (factor === null || baseScale === null) return null;
    return factor * baseScale;
  }

  return null;
}

/** Map an SI prefix enum (.MILLI., .CENTI., …) to a factor relative to metre. */
function SI_PREFIX_TO_METRE_FACTOR(prefix: string | null): number {
  switch (prefix) {
    case 'MILLI': return 1e-3;
    case 'CENTI': return 1e-2;
    case 'DECI': return 1e-1;
    case 'DECA': return 1e1;
    case 'HECTO': return 1e2;
    case 'KILO': return 1e3;
    case 'MICRO': return 1e-6;
    case 'NANO': return 1e-9;
    case null:
    case undefined:
      return 1;
    default:
      return 1;
  }
}

/**
 * Enum values are parsed as bare strings by the STEP parser, which (because its
 * word charset includes '.') leaves a trailing dot, e.g. `.MILLI.` → "MILLI.".
 * Normalize by stripping surrounding dots so comparisons are robust.
 */
function enumValue(value: StepValue | undefined): string | null {
  const s = asString(value);
  if (s === null) return null;
  return s.replace(/^\.+|\.+$/g, '');
}
