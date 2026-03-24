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
}

export interface DxfImportResult {
  annotations: Annotation[];
  primitiveCount: number;
  warnings: string[];
}

/**
 * Import DXF using a simple line-based parser.
 * Supports: LINE, LWPOLYLINE, CIRCLE, ARC, TEXT
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
        current.startPoint = { ...current.startPoint, x: parseFloat(value), y: current.startPoint?.y ?? 0 };
        break;
      case 20:
        current.startPoint = { ...current.startPoint, x: current.startPoint?.x ?? 0, y: parseFloat(value) };
        break;
      case 11:
        current.endPoint = { ...current.endPoint, x: parseFloat(value), y: current.endPoint?.y ?? 0 };
        break;
      case 21:
        current.endPoint = { ...current.endPoint, x: current.endPoint?.x ?? 0, y: parseFloat(value) };
        break;
      case 1:
        current.text = value;
        break;
      case 40:
        if (current.type === 'CIRCLE' || current.type === 'ARC') {
          current.radius = parseFloat(value);
        } else {
          current.textHeight = parseFloat(value);
        }
        break;
    }
  }

  if (current) entities.push(current);
  return entities;
}
