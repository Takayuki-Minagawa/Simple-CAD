import type { Point2D } from '@/domain/geometry/types';
import type { Annotation, Dimension, Member, Material, Section } from '@/domain/structural/types';
import { generateId } from '@/domain/idGenerator';

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
  majorAxisEndpoint?: { x: number; y: number };
  minorAxisRatio?: number;
  startAngle?: number;
  endAngle?: number;
  // DIMENSION entity fields
  dimLineOrigin?: { x: number; y: number };
  dimExt1?: { x: number; y: number };
  dimExt2?: { x: number; y: number };
  closed?: boolean;
  /** Internal flag: classic POLYLINE is expecting vertex coordinates from next group codes */
  _pendingVertex?: boolean;
}

export interface DxfImportResult {
  annotations: Annotation[];
  members: Member[];
  dimensions: Dimension[];
  primitiveCount: number;
  warnings: string[];
}

/** Auto-generated material for DXF imports */
export const DXF_MATERIAL_ID = 'MAT-DXF-IMPORT';
export const DXF_MATERIAL: Material = {
  id: DXF_MATERIAL_ID,
  name: 'DXF Import',
  type: 'concrete',
};

const DEFAULT_WALL_THICKNESS = 200;
const DEFAULT_SLAB_THICKNESS = 200;
const DEFAULT_STORY_HEIGHT = 3000;

// ── Detection helpers ────────────────────────────────────────

interface RectangleInfo {
  isRect: boolean;
  width: number;
  height: number;
  center: Point2D;
  angle: number;
}

export function isRectangle(vertices: Point2D[], tolerance = 50): RectangleInfo {
  const fail: RectangleInfo = { isRect: false, width: 0, height: 0, center: { x: 0, y: 0 }, angle: 0 };
  if (vertices.length !== 4) return fail;

  // Compute edge vectors
  const edges: Point2D[] = [];
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    edges.push({ x: vertices[next].x - vertices[i].x, y: vertices[next].y - vertices[i].y });
  }

  // Check that opposite edges are parallel and equal length
  const len = (v: Point2D) => Math.sqrt(v.x * v.x + v.y * v.y);
  const dot = (a: Point2D, b: Point2D) => a.x * b.x + a.y * b.y;

  const l0 = len(edges[0]);
  const l1 = len(edges[1]);
  const l2 = len(edges[2]);
  const l3 = len(edges[3]);

  // Opposite edges should have similar length
  if (Math.abs(l0 - l2) > tolerance || Math.abs(l1 - l3) > tolerance) return fail;

  // Adjacent edges should be perpendicular (dot product ~ 0)
  const d01 = Math.abs(dot(edges[0], edges[1]));
  if (d01 > tolerance * Math.max(l0, l1)) return fail;

  // Compute center
  const cx = (vertices[0].x + vertices[1].x + vertices[2].x + vertices[3].x) / 4;
  const cy = (vertices[0].y + vertices[1].y + vertices[2].y + vertices[3].y) / 4;

  // width = length of edge 0, height = length of edge 1
  const width = l0;
  const height = l1;

  // angle of the first edge
  const angle = Math.atan2(edges[0].y, edges[0].x);

  return { isRect: true, width, height, center: { x: cx, y: cy }, angle };
}

export function isSquarish(width: number, height: number, threshold = 2): boolean {
  if (width === 0 || height === 0) return false;
  const ratio = width > height ? width / height : height / width;
  return ratio < threshold;
}

// ── Section deduplication ────────────────────────────────────

class SectionRegistry {
  private sections = new Map<string, Section>();

  getWallSection(thickness: number): Section {
    const key = `rc_wall:${thickness}`;
    if (!this.sections.has(key)) {
      this.sections.set(key, {
        id: `SEC-DXF-WALL-${thickness}`,
        kind: 'rc_wall',
        thickness,
      });
    }
    return this.sections.get(key)!;
  }

  getSlabSection(thickness: number): Section {
    const key = `rc_slab:${thickness}`;
    if (!this.sections.has(key)) {
      this.sections.set(key, {
        id: `SEC-DXF-SLAB-${thickness}`,
        kind: 'rc_slab',
        thickness,
      });
    }
    return this.sections.get(key)!;
  }

  getColumnSection(width: number, depth: number): Section {
    // Normalize so width <= depth
    const w = Math.round(Math.min(width, depth));
    const d = Math.round(Math.max(width, depth));
    const key = `rc_column_rect:${w}x${d}`;
    if (!this.sections.has(key)) {
      this.sections.set(key, {
        id: `SEC-DXF-COL-${w}x${d}`,
        kind: 'rc_column_rect',
        width: w,
        depth: d,
      });
    }
    return this.sections.get(key)!;
  }

  getBeamSection(width: number, depth: number): Section {
    const w = Math.round(Math.min(width, depth));
    const d = Math.round(Math.max(width, depth));
    const key = `rc_beam_rect:${w}x${d}`;
    if (!this.sections.has(key)) {
      this.sections.set(key, {
        id: `SEC-DXF-BEAM-${w}x${d}`,
        kind: 'rc_beam_rect',
        width: w,
        depth: d,
      });
    }
    return this.sections.get(key)!;
  }

  getAllSections(): Section[] {
    return Array.from(this.sections.values());
  }
}

// ── Geometry-to-member conversion ────────────────────────────

function convertLineToMember(
  entity: DxfEntity,
  story: string,
  sections: SectionRegistry,
  usedIds: Set<string>,
): Member | null {
  if (!entity.startPoint || !entity.endPoint) return null;

  const wallSection = sections.getWallSection(DEFAULT_WALL_THICKNESS);

  return {
    id: generateId('wall', usedIds),
    type: 'wall',
    story,
    sectionId: wallSection.id,
    materialId: DXF_MATERIAL_ID,
    start: {
      x: entity.startPoint.x,
      y: entity.startPoint.y,
      z: entity.startPoint.z ?? 0,
    },
    end: {
      x: entity.endPoint.x,
      y: entity.endPoint.y,
      z: entity.endPoint.z ?? 0,
    },
    height: DEFAULT_STORY_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
  };
}

function convertCircleToMember(
  entity: DxfEntity,
  story: string,
  sections: SectionRegistry,
  usedIds: Set<string>,
): Member | null {
  if (!entity.center || !entity.radius) return null;

  const diameter = Math.round(entity.radius * 2);
  const colSection = sections.getColumnSection(diameter, diameter);

  return {
    id: generateId('col', usedIds),
    type: 'column',
    story,
    sectionId: colSection.id,
    materialId: DXF_MATERIAL_ID,
    start: { x: entity.center.x, y: entity.center.y, z: 0 },
    end: { x: entity.center.x, y: entity.center.y, z: DEFAULT_STORY_HEIGHT },
  };
}

function convertPolylineToMembers(
  entity: DxfEntity,
  story: string,
  sections: SectionRegistry,
  usedIds: Set<string>,
): Member[] {
  const verts = entity.vertices;
  if (!verts || verts.length < 2) return [];

  const isClosed = entity.closed ?? false;
  const points2D: Point2D[] = verts.map((v) => ({ x: v.x, y: v.y }));

  if (isClosed && points2D.length === 4) {
    const rectInfo = isRectangle(points2D);
    if (rectInfo.isRect) {
      const { width, height, center } = rectInfo;
      if (isSquarish(width, height)) {
        // Column at centroid
        const w = Math.round(Math.min(width, height));
        const d = Math.round(Math.max(width, height));
        const colSection = sections.getColumnSection(w, d);
        return [
          {
            id: generateId('col', usedIds),
            type: 'column',
            story,
            sectionId: colSection.id,
            materialId: DXF_MATERIAL_ID,
            start: { x: center.x, y: center.y, z: 0 },
            end: { x: center.x, y: center.y, z: DEFAULT_STORY_HEIGHT },
          },
        ];
      } else {
        // Elongated rectangle → beam along long axis
        const w = Math.round(Math.min(width, height));
        const d = Math.round(Math.max(width, height));
        const beamSection = sections.getBeamSection(w, d);

        // Find the midpoints of the short edges for beam start/end
        let startPt: Point2D;
        let endPt: Point2D;
        if (width >= height) {
          // edge 0 is the long edge
          startPt = {
            x: (points2D[0].x + points2D[3].x) / 2,
            y: (points2D[0].y + points2D[3].y) / 2,
          };
          endPt = {
            x: (points2D[1].x + points2D[2].x) / 2,
            y: (points2D[1].y + points2D[2].y) / 2,
          };
        } else {
          // edge 1 is the long edge
          startPt = {
            x: (points2D[0].x + points2D[1].x) / 2,
            y: (points2D[0].y + points2D[1].y) / 2,
          };
          endPt = {
            x: (points2D[2].x + points2D[3].x) / 2,
            y: (points2D[2].y + points2D[3].y) / 2,
          };
        }

        return [
          {
            id: generateId('beam', usedIds),
            type: 'beam',
            story,
            sectionId: beamSection.id,
            materialId: DXF_MATERIAL_ID,
            start: { x: startPt.x, y: startPt.y, z: 0 },
            end: { x: endPt.x, y: endPt.y, z: 0 },
          },
        ];
      }
    }
  }

  if (isClosed && points2D.length >= 4) {
    // Non-rectangular closed polygon → slab
    const slabSection = sections.getSlabSection(DEFAULT_SLAB_THICKNESS);
    return [
      {
        id: generateId('slab', usedIds),
        type: 'slab',
        story,
        sectionId: slabSection.id,
        materialId: DXF_MATERIAL_ID,
        polygon: points2D,
        level: 0,
      },
    ];
  }

  // Open polyline → series of wall segments
  const wallSection = sections.getWallSection(DEFAULT_WALL_THICKNESS);
  const members: Member[] = [];
  for (let i = 0; i < points2D.length - 1; i++) {
    members.push({
      id: generateId('wall', usedIds),
      type: 'wall',
      story,
      sectionId: wallSection.id,
      materialId: DXF_MATERIAL_ID,
      start: { x: points2D[i].x, y: points2D[i].y, z: 0 },
      end: { x: points2D[i + 1].x, y: points2D[i + 1].y, z: 0 },
      height: DEFAULT_STORY_HEIGHT,
      thickness: DEFAULT_WALL_THICKNESS,
    });
  }
  return members;
}

// ── DIMENSION entity conversion ──────────────────────────────

function convertDimensionEntity(entity: DxfEntity, story: string, usedIds: Set<string>): Dimension | null {
  if (!entity.dimExt1 || !entity.dimExt2) return null;

  // Compute signed offset by projecting dimLineOrigin onto the perpendicular of the measured segment
  let offset = 0;
  if (entity.dimLineOrigin) {
    const dx = entity.dimExt2.x - entity.dimExt1.x;
    const dy = entity.dimExt2.y - entity.dimExt1.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-9) {
      // Perpendicular direction (same convention as DimensionLayer)
      const perpX = -dy / len;
      const perpY = dx / len;
      const midX = (entity.dimExt1.x + entity.dimExt2.x) / 2;
      const midY = (entity.dimExt1.y + entity.dimExt2.y) / 2;
      // Signed projection onto perpendicular
      offset = (entity.dimLineOrigin.x - midX) * perpX + (entity.dimLineOrigin.y - midY) * perpY;
    }
  }

  return {
    id: generateId('dim', usedIds),
    story,
    start: { x: entity.dimExt1.x, y: entity.dimExt1.y },
    end: { x: entity.dimExt2.x, y: entity.dimExt2.y },
    offset,
    text: entity.text,
  };
}

// ── Main import function ─────────────────────────────────────

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
      // Classic POLYLINE: accumulate VERTEX rows into parent, finalize on SEQEND
      if (current && current.type === 'POLYLINE' && value === 'VERTEX') {
        // Mark that the next 10/20 codes should update (not push) a vertex
        current._pendingVertex = true;
        continue;
      }
      if (current && current.type === 'POLYLINE' && value === 'SEQEND') {
        entities.push(current);
        current = null;
        continue;
      }
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
      case 30:
        assignPrimaryZ(current, parseFloat(value));
        break;
      case 11:
        if (current.type === 'ELLIPSE') {
          current.majorAxisEndpoint = { ...current.majorAxisEndpoint, x: parseFloat(value), y: current.majorAxisEndpoint?.y ?? 0 };
        } else {
          current.endPoint = { ...current.endPoint, x: parseFloat(value), y: current.endPoint?.y ?? 0 };
        }
        break;
      case 21:
        if (current.type === 'ELLIPSE') {
          current.majorAxisEndpoint = { ...current.majorAxisEndpoint, x: current.majorAxisEndpoint?.x ?? 0, y: parseFloat(value) };
        } else {
          current.endPoint = { ...current.endPoint, x: current.endPoint?.x ?? 0, y: parseFloat(value) };
        }
        break;
      case 31:
        if (current.endPoint) {
          current.endPoint.z = parseFloat(value);
        }
        break;
      case 13:
        // DIMENSION: first extension line origin X
        if (current.type === 'DIMENSION') {
          current.dimExt1 = { ...current.dimExt1, x: parseFloat(value), y: current.dimExt1?.y ?? 0 };
        }
        break;
      case 23:
        // DIMENSION: first extension line origin Y
        if (current.type === 'DIMENSION') {
          current.dimExt1 = { ...current.dimExt1, x: current.dimExt1?.x ?? 0, y: parseFloat(value) };
        }
        break;
      case 14:
        // DIMENSION: second extension line origin X
        if (current.type === 'DIMENSION') {
          current.dimExt2 = { ...current.dimExt2, x: parseFloat(value), y: current.dimExt2?.y ?? 0 };
        }
        break;
      case 24:
        // DIMENSION: second extension line origin Y
        if (current.type === 'DIMENSION') {
          current.dimExt2 = { ...current.dimExt2, x: current.dimExt2?.x ?? 0, y: parseFloat(value) };
        }
        break;
      case 70:
        // For LWPOLYLINE: flag for closed polyline (bit 0 = closed)
        if (current.type === 'LWPOLYLINE' || current.type === 'POLYLINE') {
          current.closed = (parseInt(value, 10) & 1) !== 0;
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
          current.minorAxisRatio = parseFloat(value);
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

function isDimensionEntity(type: string): boolean {
  return type === 'DIMENSION';
}

function assignPrimaryX(entity: DxfEntity, value: number) {
  if (entity.type === 'CIRCLE' || entity.type === 'ARC' || entity.type === 'ELLIPSE') {
    entity.center = { ...entity.center, x: value, y: entity.center?.y ?? 0 };
    return;
  }
  if (isDimensionEntity(entity.type)) {
    entity.dimLineOrigin = { ...entity.dimLineOrigin, x: value, y: entity.dimLineOrigin?.y ?? 0 };
    return;
  }
  if (isVertexEntity(entity.type)) {
    entity.vertices ??= [];
    if (entity._pendingVertex) {
      // Classic POLYLINE VERTEX: push new vertex with this X
      entity.vertices.push({ x: value, y: 0 });
      entity._pendingVertex = false;
    } else {
      entity.vertices.push({ x: value, y: 0 });
    }
    return;
  }
  entity.startPoint = { ...entity.startPoint, x: value, y: entity.startPoint?.y ?? 0 };
}

function assignPrimaryY(entity: DxfEntity, value: number) {
  if (entity.type === 'CIRCLE' || entity.type === 'ARC' || entity.type === 'ELLIPSE') {
    entity.center = { ...entity.center, x: entity.center?.x ?? 0, y: value };
    return;
  }
  if (isDimensionEntity(entity.type)) {
    entity.dimLineOrigin = { ...entity.dimLineOrigin, x: entity.dimLineOrigin?.x ?? 0, y: value };
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

function assignPrimaryZ(entity: DxfEntity, value: number) {
  if (entity.type === 'CIRCLE' || entity.type === 'ARC' || entity.type === 'ELLIPSE') {
    if (entity.center) entity.center.z = value;
    return;
  }
  if (isVertexEntity(entity.type)) {
    entity.vertices ??= [];
    const last = entity.vertices[entity.vertices.length - 1];
    if (last) {
      last.z = value;
    }
    return;
  }
  if (isDimensionEntity(entity.type)) {
    // z not used for dimensions
    return;
  }
  if (entity.startPoint) entity.startPoint.z = value;
}

function normalizeDxfText(value: string): string {
  return value.replace(/\\P/g, ' ').trim();
}
