import type { Annotation } from '@/domain/structural/types';
import { v4 as uuidv4 } from 'uuid';

interface DxfEntity {
  type: string;
  layer?: string;
  startPoint?: { x: number; y: number; z?: number };
  endPoint?: { x: number; y: number; z?: number };
  vertices?: Array<{ x: number; y: number; z?: number }>;
  text?: string;
  textHeight?: number;
  center?: { x: number; y: number; z?: number };
  radius?: number;
  majorRadius?: number;
  minorRadius?: number;
  startAngle?: number;
  endAngle?: number;
}

export interface DxfImportResult {
  annotations: Annotation[];
  primitiveCount: number;
  warnings: string[];
}

/**
 * Import DXF using a simple line-based parser.
 * Supports: LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, TEXT, MTEXT, SPLINE, HATCH, ELLIPSE
 * Unsupported entities are skipped with warnings.
 */
export function importDxf(content: string, defaultStory: string): DxfImportResult {
  const annotations: Annotation[] = [];
  const warnings: string[] = [];
  let primitiveCount = 0;

  try {
    const entities = parseDxfEntities(content);

    for (const entity of entities) {
      switch (entity.type) {
        case 'LINE':
          primitiveCount++;
          break;
        case 'LWPOLYLINE':
        case 'POLYLINE':
          primitiveCount++;
          break;
        case 'CIRCLE':
          primitiveCount++;
          break;
        case 'ARC':
        case 'SPLINE':
        case 'HATCH':
        case 'ELLIPSE':
          primitiveCount++;
          break;
        case 'TEXT':
        case 'MTEXT':
          if (entity.startPoint && entity.text) {
            annotations.push({
              id: uuidv4(),
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

  return { annotations, primitiveCount, warnings };
}

/**
 * Minimal DXF parser - extracts entity types and basic properties.
 */
function parseDxfEntities(content: string): DxfEntity[] {
  const lines = content.split(/\r?\n/);
  const entities: DxfEntity[] = [];
  let inEntities = false;
  let current: DxfEntity | null = null;

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    const value = lines[i + 1]?.trim() ?? '';

    if (code === 0 && value === 'SECTION') {
      const nextCode = parseInt(lines[i + 2]?.trim() ?? '', 10);
      const nextVal = lines[i + 3]?.trim() ?? '';
      if (nextCode === 2 && nextVal === 'ENTITIES') {
        inEntities = true;
        i += 2;
        continue;
      }
    }

    if (code === 0 && value === 'ENDSEC') {
      if (current) entities.push(current);
      current = null;
      inEntities = false;
      continue;
    }

    if (!inEntities) continue;

    if (code === 0) {
      if (current) entities.push(current);
      current = { type: value };
      continue;
    }

    if (!current) continue;

    switch (code) {
      case 8:
        current.layer = value;
        break;
      case 10:
        assignPrimaryX(current, parseFloat(value));
        break;
      case 20:
        assignPrimaryY(current, parseFloat(value));
        break;
      case 11:
        if (current.type === 'ELLIPSE') {
          current.majorRadius = parseFloat(value);
        } else {
          current.endPoint = { ...current.endPoint, x: parseFloat(value), y: current.endPoint?.y ?? 0 };
        }
        break;
      case 21:
        if (current.type === 'ELLIPSE') {
          current.minorRadius = parseFloat(value);
        } else {
          current.endPoint = { ...current.endPoint, x: current.endPoint?.x ?? 0, y: parseFloat(value) };
        }
        break;
      case 1:
        current.text = current.text ? `${current.text} ${normalizeDxfText(value)}` : normalizeDxfText(value);
        break;
      case 3:
        current.text = current.text ? `${current.text} ${normalizeDxfText(value)}` : normalizeDxfText(value);
        break;
      case 40:
        if (current.type === 'CIRCLE' || current.type === 'ARC') {
          current.radius = parseFloat(value);
        } else if (current.type === 'ELLIPSE') {
          current.minorRadius = parseFloat(value) * (current.majorRadius ?? 0);
        } else {
          current.textHeight = parseFloat(value);
        }
        break;
      case 50:
        current.startAngle = parseFloat(value);
        break;
      case 51:
        current.endAngle = parseFloat(value);
        break;
    }
  }

  if (current) entities.push(current);
  return entities;
}

function isVertexEntity(type: string): boolean {
  return type === 'LWPOLYLINE' || type === 'POLYLINE' || type === 'SPLINE' || type === 'HATCH';
}

function assignPrimaryX(entity: DxfEntity, value: number) {
  if (entity.type === 'CIRCLE' || entity.type === 'ARC' || entity.type === 'ELLIPSE') {
    entity.center = { ...entity.center, x: value, y: entity.center?.y ?? 0 };
    return;
  }
  if (isVertexEntity(entity.type)) {
    entity.vertices ??= [];
    entity.vertices.push({ x: value, y: 0 });
    return;
  }
  entity.startPoint = { ...entity.startPoint, x: value, y: entity.startPoint?.y ?? 0 };
}

function assignPrimaryY(entity: DxfEntity, value: number) {
  if (entity.type === 'CIRCLE' || entity.type === 'ARC' || entity.type === 'ELLIPSE') {
    entity.center = { ...entity.center, x: entity.center?.x ?? 0, y: value };
    return;
  }
  if (isVertexEntity(entity.type)) {
    entity.vertices ??= [];
    const last = entity.vertices[entity.vertices.length - 1];
    if (last) {
      last.y = value;
    } else {
      entity.vertices.push({ x: 0, y: value });
    }
    return;
  }
  entity.startPoint = { ...entity.startPoint, x: entity.startPoint?.x ?? 0, y: value };
}

function normalizeDxfText(value: string): string {
  return value.replace(/\\P/g, ' ').trim();
}
