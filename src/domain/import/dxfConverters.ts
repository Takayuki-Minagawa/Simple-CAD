import type { Point2D } from '@/domain/geometry/types';
import type { Dimension, Member, Material, Section } from '@/domain/structural/types';
import { generateId } from '@/domain/idGenerator';
import type { DxfEntity } from './dxfParser';
import {
  columnAxisOffsetToWorld,
  effectiveLinearAxisOffset,
  linearAxisOffsetToWorld,
  slabAxisOffsetToWorld,
} from '@/domain/structural/eccentricity';
import { getBeamRectSize, getWallThickness } from '@/domain/structural/memberShape';

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
const DEFAULT_BEAM_DEPTH = 600;

export type DxfLayerRole =
  | 'column'
  | 'beam'
  | 'wall'
  | 'slab'
  | 'grid'
  | 'dimension'
  | 'annotation'
  | 'construction'
  | 'unknown';

/** Classify the canonical layers emitted by Simple-CAD (case-insensitive). */
export function classifyDxfLayer(layer: string | undefined): DxfLayerRole {
  const normalized = layer?.trim().toUpperCase() ?? '';
  switch (normalized) {
    case 'COLUMN':
    case 'COL':
      return 'column';
    case 'BEAM':
      return 'beam';
    case 'WALL':
    case 'WALLS':
      return 'wall';
    case 'SLAB':
      return 'slab';
    case 'GRID':
      return 'grid';
    case 'DIMENSION':
    case 'DIM':
      return 'dimension';
    case 'ANNOTATION':
    case 'NOTES':
      return 'annotation';
    case 'CONSTRUCTION':
      return 'construction';
    default:
      return 'unknown';
  }
}

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
    // Preserve width/depth order: the orientation is carried by member.rotation,
    // so swapping them here would rotate a non-square column 90° on round-trip.
    const w = Math.round(width);
    const d = Math.round(depth);
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
    const w = Math.round(width);
    const d = Math.round(depth);
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

  findSection(id: string): Section | undefined {
    return [...this.sections.values()].find((section) => section.id === id);
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
  rotation = 0,
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
    ...(rotation ? { rotation } : {}),
  };
}

function createWallMember(
  start: { x: number; y: number; z?: number },
  end: { x: number; y: number; z?: number },
  story: string,
  sections: SectionRegistry,
  usedIds: Set<string>,
  thickness = DEFAULT_WALL_THICKNESS,
): Member {
  const wallSection = sections.getWallSection(thickness);
  return {
    id: generateId('wall', usedIds),
    type: 'wall',
    story,
    sectionId: wallSection.id,
    materialId: DXF_MATERIAL_ID,
    start: { x: start.x, y: start.y, z: start.z ?? 0 },
    end: { x: end.x, y: end.y, z: end.z ?? 0 },
    height: DEFAULT_STORY_HEIGHT,
    thickness,
  };
}

function createBeamMember(
  start: Point2D,
  end: Point2D,
  width: number,
  story: string,
  sections: SectionRegistry,
  usedIds: Set<string>,
): Member {
  const beamSection = sections.getBeamSection(width, DEFAULT_BEAM_DEPTH);
  return {
    id: generateId('beam', usedIds),
    type: 'beam',
    story,
    sectionId: beamSection.id,
    materialId: DXF_MATERIAL_ID,
    start: { x: start.x, y: start.y, z: 0 },
    end: { x: end.x, y: end.y, z: 0 },
  };
}

export function convertLineToMember(
  entity: DxfEntity,
  story: string,
  sections: SectionRegistry,
  usedIds: Set<string>,
  role: DxfLayerRole = classifyDxfLayer(entity.layer),
): Member | null {
  if (!entity.startPoint || !entity.endPoint) return null;

  if (role === 'beam') {
    return createBeamMember(entity.startPoint, entity.endPoint, 300, story, sections, usedIds);
  }
  if (role !== 'wall' && role !== 'unknown') return null;
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
  role: DxfLayerRole = classifyDxfLayer(entity.layer),
): Member[] {
  const verts = entity.vertices;
  if (!verts || verts.length < 2) return [];

  const isClosed = entity.closed ?? false;
  const points2D: Point2D[] = verts.map((v) => ({ x: v.x, y: v.y }));

  if (isClosed && role === 'slab' && points2D.length >= 3) {
    const slabSection = sections.getSlabSection(DEFAULT_SLAB_THICKNESS);
    return applyDxfMemberMetadata(
      entity,
      [
        {
          id: generateId('slab', usedIds),
          type: 'slab',
          story,
          sectionId: slabSection.id,
          materialId: DXF_MATERIAL_ID,
          polygon: points2D,
          level: 0,
        },
      ],
      usedIds,
      sections,
    );
  }

  if (isClosed && points2D.length === 4) {
    const rectInfo = isRectangle(points2D);
    if (rectInfo.isRect) {
      const { width, height, center, angle } = rectInfo;
      if (role === 'column' || (role === 'unknown' && isSquarish(width, height))) {
        // Column at centroid. Recover rotation from the box orientation so it
        // round-trips with the DXF exporter (B5 / 3-8). Normalize to (-π/2, π/2]
        // since a rectangle has 180°/box symmetry.
        let rot = angle;
        while (rot > Math.PI / 2) rot -= Math.PI;
        while (rot <= -Math.PI / 2) rot += Math.PI;
        return applyDxfMemberMetadata(
          entity,
          [createColumnMember(center, width, height, story, sections, usedIds, rot)],
          usedIds,
          sections,
        );
      } else if (role === 'beam' || role === 'wall' || role === 'unknown') {
        // Elongated rectangle → beam along long axis
        const { start, end, transverseWidth } = rectangleAxis(points2D, width, height);
        if (role === 'wall') {
          return applyDxfMemberMetadata(
            entity,
            [createWallMember(start, end, story, sections, usedIds, transverseWidth)],
            usedIds,
            sections,
          );
        }
        return applyDxfMemberMetadata(
          entity,
          [createBeamMember(start, end, transverseWidth, story, sections, usedIds)],
          usedIds,
          sections,
        );
      }
    }
  }

  if (isClosed && points2D.length >= 4 && role === 'unknown') {
    // Non-rectangular closed polygon → slab
    const slabSection = sections.getSlabSection(DEFAULT_SLAB_THICKNESS);
    return applyDxfMemberMetadata(
      entity,
      [
        {
          id: generateId('slab', usedIds),
          type: 'slab',
          story,
          sectionId: slabSection.id,
          materialId: DXF_MATERIAL_ID,
          polygon: points2D,
          level: 0,
        },
      ],
      usedIds,
      sections,
    );
  }

  if (role === 'column' || role === 'slab') return [];

  // Open polyline → series of layer-aware linear members.
  const members: Member[] = [];
  const segmentCount = isClosed ? points2D.length : points2D.length - 1;
  for (let i = 0; i < segmentCount; i++) {
    const next = points2D[(i + 1) % points2D.length];
    members.push(
      role === 'beam'
        ? createBeamMember(points2D[i], next, 300, story, sections, usedIds)
        : createWallMember(points2D[i], next, story, sections, usedIds),
    );
  }
  return applyDxfMemberMetadata(entity, members, usedIds, sections);
}

function applyDxfMemberMetadata(
  entity: DxfEntity,
  members: Member[],
  usedIds: Set<string>,
  sections: SectionRegistry,
): Member[] {
  const metadata = readSimpleCadMetadata<Record<string, unknown>>(entity, 'MEMBER');
  if (!metadata) return members;
  return members.map((member, index) => {
    let id = member.id;
    if (typeof metadata.id === 'string' && index === 0 && metadata.id !== member.id) {
      id = reserveMetadataId(metadata.id, member.type, usedIds);
    }
    const rotation =
      typeof metadata.rotation === 'number' && Number.isFinite(metadata.rotation)
        ? metadata.rotation
        : member.rotation;
    const axisOffset = isAxisOffset(metadata.axisOffset) ? metadata.axisOffset : member.axisOffset;
    const faceAlign =
      metadata.faceAlign === 'center' ||
      metadata.faceAlign === 'left' ||
      metadata.faceAlign === 'right'
        ? metadata.faceAlign
        : member.faceAlign;
    const referenceMember = restoreDxfReferenceGeometry(
      member,
      axisOffset,
      faceAlign,
      sections.findSection(member.sectionId),
    );
    return {
      ...referenceMember,
      id,
      ...(rotation !== undefined ? { rotation } : {}),
      ...(axisOffset ? { axisOffset } : {}),
      ...(faceAlign ? { faceAlign } : {}),
      ...(isLocalAxis(metadata.localAxis) ? { localAxis: metadata.localAxis } : {}),
      ...(isRecord(metadata.releases)
        ? { releases: metadata.releases as unknown as NonNullable<Member['releases']> }
        : {}),
      ...(isRecord(metadata.rigidZones)
        ? { rigidZones: metadata.rigidZones as unknown as NonNullable<Member['rigidZones']> }
        : {}),
    };
  });
}

/**
 * Simple-CAD exports the physical plan outline, while its model stores an
 * independently editable reference axis plus eccentricity/face alignment.
 * Reconstruct the reference geometry before restoring that metadata; otherwise
 * a DXF round-trip would apply the offset twice when the member is drawn again.
 */
function restoreDxfReferenceGeometry(
  member: Member,
  axisOffset: Member['axisOffset'],
  faceAlign: Member['faceAlign'],
  section: Section | undefined,
): Member {
  if (!axisOffset && !faceAlign) return member;

  if (member.type === 'column') {
    const offset = columnAxisOffsetToWorld(axisOffset);
    return {
      ...member,
      start: { ...member.start, x: member.start.x - offset.x, y: member.start.y - offset.y },
      end: { ...member.end, x: member.end.x - offset.x, y: member.end.y - offset.y },
    };
  }

  if (member.type === 'beam' || member.type === 'wall') {
    const width =
      member.type === 'beam'
        ? getBeamRectSize(section).width
        : getWallThickness(member, section);
    const offset = linearAxisOffsetToWorld(
      effectiveLinearAxisOffset({ axisOffset, faceAlign }, width),
      member.start,
      member.end,
    );
    return {
      ...member,
      start: {
        x: member.start.x - offset.x,
        y: member.start.y - offset.y,
        // A plan DXF does not encode the vertical (`dy`) eccentricity in its
        // outline, so preserve the reconstructed source elevation here.
        z: member.start.z,
      },
      end: {
        x: member.end.x - offset.x,
        y: member.end.y - offset.y,
        z: member.end.z,
      },
    };
  }

  const offset = slabAxisOffsetToWorld(axisOffset);
  return {
    ...member,
    polygon: member.polygon.map((point) => ({
      x: point.x - offset.x,
      y: point.y - offset.y,
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAxisOffset(value: unknown): value is { dx: number; dy: number } {
  return (
    isRecord(value) &&
    typeof value.dx === 'number' &&
    Number.isFinite(value.dx) &&
    typeof value.dy === 'number' &&
    Number.isFinite(value.dy)
  );
}

function isLocalAxis(value: unknown): value is NonNullable<Member['localAxis']> {
  return (
    isRecord(value) &&
    typeof value.rotation === 'number' &&
    Number.isFinite(value.rotation) &&
    (value.referenceVector === undefined ||
      (isRecord(value.referenceVector) &&
        ['x', 'y', 'z'].every(
          (axis) =>
            typeof (value.referenceVector as Record<string, unknown>)[axis] === 'number' &&
            Number.isFinite((value.referenceVector as Record<string, unknown>)[axis]),
        )))
  );
}

function rectangleAxis(
  points: Point2D[],
  edge0Length: number,
  edge1Length: number,
): { start: Point2D; end: Point2D; transverseWidth: number } {
  if (edge0Length >= edge1Length) {
    return {
      start: midpoint(points[0], points[3]),
      end: midpoint(points[1], points[2]),
      transverseWidth: edge1Length,
    };
  }
  return {
    start: midpoint(points[0], points[1]),
    end: midpoint(points[2], points[3]),
    transverseWidth: edge0Length,
  };
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

  const metadata = readSimpleCadMetadata<Partial<Dimension>>(entity, 'DIMENSION');
  const id = reserveMetadataId(metadata?.id, 'dim', usedIds);
  const lineType = metadata?.lineType;
  return {
    id,
    story,
    start: { x: entity.dimExt1.x, y: entity.dimExt1.y },
    end: { x: entity.dimExt2.x, y: entity.dimExt2.y },
    offset,
    text: entity.text ?? metadata?.text,
    ...(typeof metadata?.color === 'string' ? { color: metadata.color } : {}),
    ...(typeof metadata?.lineWeight === 'number' && metadata.lineWeight > 0
      ? { lineWeight: metadata.lineWeight }
      : {}),
    ...(lineType && ['solid', 'dashed', 'dotted', 'chain', 'dashdot'].includes(lineType)
      ? { lineType }
      : {}),
  };
}

export function readSimpleCadMetadata<T>(
  entity: DxfEntity,
  kind: string,
): T | undefined {
  const prefix = `SIMPLECAD_${kind}:`;
  const encoded = entity.metadata?.find((item) => item.startsWith(prefix))?.slice(prefix.length);
  if (!encoded) return undefined;
  try {
    return JSON.parse(decodeURIComponent(encoded)) as T;
  } catch {
    return undefined;
  }
}

export function reserveMetadataId(
  preferred: string | undefined,
  prefix: string,
  usedIds: Set<string>,
): string {
  if (preferred && !usedIds.has(preferred)) {
    usedIds.add(preferred);
    return preferred;
  }
  return generateId(prefix, usedIds);
}
