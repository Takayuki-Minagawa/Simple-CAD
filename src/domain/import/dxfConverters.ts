import type { Point2D } from '@/domain/geometry/types';
import type { Dimension, Member, Material, Section } from '@/domain/structural/types';
import { generateId } from '@/domain/idGenerator';
import type { DxfEntity } from './dxfParser';

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

export class SectionRegistry {
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

function createColumnMember(
  center: Point2D,
  width: number,
  depth: number,
  story: string,
  sections: SectionRegistry,
  usedIds: Set<string>,
): Member {
  const colSection = sections.getColumnSection(width, depth);
  return {
    id: generateId('col', usedIds),
    type: 'column',
    story,
    sectionId: colSection.id,
    materialId: DXF_MATERIAL_ID,
    start: { x: center.x, y: center.y, z: 0 },
    end: { x: center.x, y: center.y, z: DEFAULT_STORY_HEIGHT },
  };
}

function createWallMember(
  start: { x: number; y: number; z?: number },
  end: { x: number; y: number; z?: number },
  story: string,
  sections: SectionRegistry,
  usedIds: Set<string>,
): Member {
  const wallSection = sections.getWallSection(DEFAULT_WALL_THICKNESS);
  return {
    id: generateId('wall', usedIds),
    type: 'wall',
    story,
    sectionId: wallSection.id,
    materialId: DXF_MATERIAL_ID,
    start: { x: start.x, y: start.y, z: start.z ?? 0 },
    end: { x: end.x, y: end.y, z: end.z ?? 0 },
    height: DEFAULT_STORY_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
  };
}

export function convertLineToMember(
  entity: DxfEntity,
  story: string,
  sections: SectionRegistry,
  usedIds: Set<string>,
): Member | null {
  if (!entity.startPoint || !entity.endPoint) return null;

  return createWallMember(entity.startPoint, entity.endPoint, story, sections, usedIds);
}

export function convertCircleToMember(
  entity: DxfEntity,
  story: string,
  sections: SectionRegistry,
  usedIds: Set<string>,
): Member | null {
  if (!entity.center || !entity.radius) return null;

  const diameter = Math.round(entity.radius * 2);
  return createColumnMember(entity.center, diameter, diameter, story, sections, usedIds);
}

export function convertPolylineToMembers(
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
        return [createColumnMember(center, width, height, story, sections, usedIds)];
      } else {
        // Elongated rectangle → beam along long axis
        const beamSection = sections.getBeamSection(width, height);

        // Find the midpoints of the short edges for beam start/end
        let startPt: Point2D;
        let endPt: Point2D;
        if (width >= height) {
          // edge 0 is the long edge
          startPt = midpoint(points2D[0], points2D[3]);
          endPt = midpoint(points2D[1], points2D[2]);
        } else {
          // edge 1 is the long edge
          startPt = midpoint(points2D[0], points2D[1]);
          endPt = midpoint(points2D[2], points2D[3]);
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
  const members: Member[] = [];
  for (let i = 0; i < points2D.length - 1; i++) {
    members.push(createWallMember(points2D[i], points2D[i + 1], story, sections, usedIds));
  }
  return members;
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ── DIMENSION entity conversion ──────────────────────────────

export function convertDimensionEntity(entity: DxfEntity, story: string, usedIds: Set<string>): Dimension | null {
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
