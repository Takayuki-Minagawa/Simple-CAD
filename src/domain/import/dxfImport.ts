import type { Annotation, Dimension, Member, Section } from '@/domain/structural/types';
import { generateId } from '@/domain/idGenerator';
import { parseDxfEntities, parseDxfHeader, type DxfEntity } from './dxfParser';
import {
  SectionRegistry,
  convertCircleToMember,
  convertDimensionEntity,
  convertLineToMember,
  convertPolylineToMembers,
} from './dxfConverters';

export { DXF_MATERIAL, DXF_MATERIAL_ID, isRectangle, isSquarish } from './dxfConverters';

export interface DxfImportResult {
  annotations: Annotation[];
  members: Member[];
  dimensions: Dimension[];
  primitiveCount: number;
  warnings: string[];
}

export interface DxfImportOptions {
  /** When true, convert geometry entities to structural members. Default: false (annotations only). */
  convertGeometry?: boolean;
  /**
   * Override the source unit→mm scale. When omitted the scale is read from the
   * HEADER `$INSUNITS` variable, falling back to a bounding-box heuristic.
   */
  unitScale?: number;
}

/**
 * Map a DXF `$INSUNITS` code to a millimetre scale factor.
 * Returns null for "unitless" (0) or unknown codes so the caller can fall back
 * to a heuristic.
 */
export function insUnitsToMm(code: number | undefined): number | null {
  switch (code) {
    case 1: return 25.4;       // inches
    case 2: return 304.8;      // feet
    case 4: return 1;          // millimetres
    case 5: return 10;         // centimetres
    case 6: return 1000;       // metres
    case 7: return 1e6;        // kilometres
    case 8: return 0.0000254;  // microinches (1µin = 2.54e-5 mm)
    case 9: return 0.0000254;  // mils (this code overlaps; treat as microinch)
    case 13: return 1e-6;      // nanometres → mm
    case 14: return 100;       // decimetres (1 dm = 100 mm)
    default: return null;      // 0 = unitless / unknown
  }
}

/**
 * Heuristic unit guess from the drawing magnitude when no `$INSUNITS` is present.
 * Structural drawings in mm have extents in the thousands; metre-unit drawings
 * are in the tens. Returns the mm scale and whether a guess was made.
 */
export function heuristicUnitScale(maxExtent: number): { scale: number; guessed: boolean } {
  if (!Number.isFinite(maxExtent) || maxExtent <= 0) return { scale: 1, guessed: false };
  // A typical building is >= ~3m. If the largest extent is under ~200, the
  // drawing is almost certainly in metres (a 50m building → 50 units).
  if (maxExtent < 200) return { scale: 1000, guessed: true };
  return { scale: 1, guessed: false };
}

function entityExtent(entities: DxfEntity[]): number {
  let min = Infinity;
  let max = -Infinity;
  const acc = (n: number | undefined) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return;
    if (n < min) min = n;
    if (n > max) max = n;
  };
  for (const e of entities) {
    acc(e.startPoint?.x); acc(e.startPoint?.y);
    acc(e.endPoint?.x); acc(e.endPoint?.y);
    acc(e.center?.x); acc(e.center?.y);
    for (const v of e.vertices ?? []) { acc(v.x); acc(v.y); }
  }
  if (!Number.isFinite(min)) return 0;
  return max - min;
}

function scaleMember(m: Member, s: number): Member {
  if (s === 1) return m;
  const sp = (p: { x: number; y: number; z: number }) => ({ x: p.x * s, y: p.y * s, z: p.z * s });
  if (m.type === 'slab') {
    return { ...m, polygon: m.polygon.map((p) => ({ x: p.x * s, y: p.y * s })), level: m.level * s };
  }
  if (m.type === 'wall') {
    return { ...m, start: sp(m.start), end: sp(m.end), height: m.height * s, thickness: m.thickness * s };
  }
  return { ...m, start: sp(m.start), end: sp(m.end) };
}

function scaleSection(sec: Section, s: number): Section {
  if (s === 1) return sec;
  if (sec.kind === 'rc_wall' || sec.kind === 'rc_slab') {
    return { ...sec, thickness: sec.thickness * s };
  }
  return { ...sec, width: sec.width * s, depth: sec.depth * s };
}

/**
 * Import DXF using a simple line-based parser.
 * Supports: LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, TEXT, MTEXT, SPLINE, HATCH, ELLIPSE, DIMENSION
 * Unsupported entities are skipped with warnings.
 */
export function importDxf(
  content: string,
  defaultStory: string,
  options: DxfImportOptions = {},
): DxfImportResult {
  const annotations: Annotation[] = [];
  const members: Member[] = [];
  const dimensions: Dimension[] = [];
  const warnings: string[] = [];
  let primitiveCount = 0;

  const convertGeometry = options.convertGeometry ?? false;
  const sections = new SectionRegistry();
  const usedIds = new Set<string>();
  let unitScale = 1;

  try {
    const entities = parseDxfEntities(content);

    // Determine the source unit → mm scale (3-3 / B4).
    if (typeof options.unitScale === 'number' && options.unitScale > 0) {
      unitScale = options.unitScale;
    } else {
      const header = parseDxfHeader(content);
      const fromHeader = insUnitsToMm(header.insUnits);
      if (fromHeader !== null) {
        unitScale = fromHeader;
        if (unitScale !== 1) {
          warnings.push(`$INSUNITS=${header.insUnits} を検出: 座標を mm に ${unitScale}倍 でスケールしました`);
        }
      } else {
        const guess = heuristicUnitScale(entityExtent(entities));
        unitScale = guess.scale;
        if (guess.guessed) {
          warnings.push(
            `$INSUNITS が無いため図面範囲から単位を推定: メートル単位とみなし ${unitScale}倍 でスケールしました（誤りの場合は単位を指定してください）`,
          );
        }
      }
    }

    for (const entity of entities) {
      switch (entity.type) {
        case 'LINE':
          primitiveCount++;
          if (convertGeometry) {
            const member = convertLineToMember(entity, defaultStory, sections, usedIds);
            if (member) members.push(member);
          }
          break;
        case 'LWPOLYLINE':
        case 'POLYLINE':
          primitiveCount++;
          if (convertGeometry) {
            const polyMembers = convertPolylineToMembers(entity, defaultStory, sections, usedIds);
            members.push(...polyMembers);
          }
          break;
        case 'CIRCLE':
          primitiveCount++;
          if (convertGeometry) {
            const colMember = convertCircleToMember(entity, defaultStory, sections, usedIds);
            if (colMember) members.push(colMember);
          }
          break;
        case 'ARC':
        case 'SPLINE':
        case 'HATCH':
        case 'ELLIPSE':
          primitiveCount++;
          break;
        case 'DIMENSION':
          primitiveCount++;
          if (convertGeometry) {
            const dim = convertDimensionEntity(entity, defaultStory, usedIds);
            if (dim) dimensions.push(dim);
          }
          break;
        case 'TEXT':
        case 'MTEXT':
          if (entity.startPoint && entity.text) {
            annotations.push({
              id: generateId('ann', usedIds),
              type: 'text',
              story: defaultStory,
              x: entity.startPoint.x,
              y: entity.startPoint.y,
              text: entity.text,
              fontSize: entity.textHeight ?? 250,
            });
          }
          primitiveCount++;
          break;
        default:
          warnings.push(`未対応エンティティ: ${entity.type} をスキップ`);
      }
    }
  } catch (e) {
    warnings.push(`DXF parse error: ${String(e)}`);
  }

  // Apply the unit→mm scale to all imported geometry (3-3 / B4).
  const scaledMembers = unitScale === 1 ? members : members.map((m) => scaleMember(m, unitScale));
  const scaledAnnotations =
    unitScale === 1
      ? annotations
      : annotations.map((a) => ({ ...a, x: a.x * unitScale, y: a.y * unitScale }));
  const scaledDimensions =
    unitScale === 1
      ? dimensions
      : dimensions.map((d) => ({
          ...d,
          start: { x: d.start.x * unitScale, y: d.start.y * unitScale },
          end: { x: d.end.x * unitScale, y: d.end.y * unitScale },
          offset: d.offset * unitScale,
        }));
  const scaledSections =
    unitScale === 1
      ? sections.getAllSections()
      : sections.getAllSections().map((s) => scaleSection(s, unitScale));

  return {
    annotations: scaledAnnotations,
    members: scaledMembers,
    dimensions: scaledDimensions,
    primitiveCount,
    warnings,
    /** Expose auto-generated sections for the caller to register */
    ...( convertGeometry ? { _autoSections: scaledSections } : {}),
  } as DxfImportResult & { _autoSections?: Section[] };
}

/** Helper to retrieve auto-generated sections from an import result */
export function getAutoSections(result: DxfImportResult): Section[] {
  return (result as DxfImportResult & { _autoSections?: Section[] })._autoSections ?? [];
}
