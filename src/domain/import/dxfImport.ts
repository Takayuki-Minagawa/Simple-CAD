import type { Annotation, Dimension, Member, Section } from '@/domain/structural/types';
import { generateId } from '@/domain/idGenerator';
import { parseDxfEntities } from './dxfParser';
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

  try {
    const entities = parseDxfEntities(content);

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

  return {
    annotations,
    members,
    dimensions,
    primitiveCount,
    warnings,
    /** Expose auto-generated sections for the caller to register */
    ...( convertGeometry ? { _autoSections: sections.getAllSections() } : {}),
  } as DxfImportResult & { _autoSections?: Section[] };
}

/** Helper to retrieve auto-generated sections from an import result */
export function getAutoSections(result: DxfImportResult): Section[] {
  return (result as DxfImportResult & { _autoSections?: Section[] })._autoSections ?? [];
}
