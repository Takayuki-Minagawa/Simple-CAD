import * as THREE from 'three';
import type { Member, Opening, Section } from '@/domain/structural/types';
import {
  columnAxisOffsetToWorld,
  effectiveLinearAxisOffset,
  linearAxisOffsetToWorld,
  slabAxisOffsetToWorld,
} from '@/domain/structural/eccentricity';
import {
  getBeamRectSize,
  getColumnRectSize,
  getSlabThickness,
  getWallThickness,
} from '@/domain/structural/memberShape';
import { resolveMemberLocalAxes } from '@/domain/structural/localAxis';

export type GeometryEngine = 'native' | 'opencascade';

export interface GeometryBuildInput {
  member: Member;
  section?: Section;
  openings: Opening[];
}

interface OpenCascadeGeometryOutput {
  positions: number[];
  indices?: number[];
  normals?: number[];
}

interface OpenCascadeGeometryRuntime {
  buildMemberGeometry(input: GeometryBuildInput): OpenCascadeGeometryOutput | null;
}

declare global {
  interface Window {
    openCascadeGeometryRuntime?: OpenCascadeGeometryRuntime;
  }
}

export function isOpenCascadeRuntimeAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.openCascadeGeometryRuntime);
}

export function buildMemberGeometry(
  input: GeometryBuildInput,
  engine: GeometryEngine,
): THREE.BufferGeometry | null {
  if (engine === 'opencascade') {
    const geometry = buildWithOpenCascadeRuntime(input);
    if (geometry) return geometry;
  }
  return buildNativeGeometry(input);
}

function buildWithOpenCascadeRuntime(input: GeometryBuildInput): THREE.BufferGeometry | null {
  const runtime = window.openCascadeGeometryRuntime;
  if (!runtime) return null;

  const output = runtime.buildMemberGeometry(input);
  if (!output || output.positions.length === 0) return null;
  if (output.positions.length % 3 !== 0) return null;
  if (!output.positions.every(Number.isFinite)) return null;

  const vertexCount = output.positions.length / 3;
  if (output.indices && output.indices.some((i) => i < 0 || i >= vertexCount)) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(output.positions, 3));
  if (output.normals && output.normals.length === output.positions.length) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(output.normals, 3));
  }
  if (output.indices && output.indices.length > 0) {
    geometry.setIndex(output.indices);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildNativeGeometry({
  member,
  section,
  openings,
}: GeometryBuildInput): THREE.BufferGeometry | null {
  switch (member.type) {
    case 'column':
      return buildColumnGeometry(member, section);
    case 'beam':
      return buildBeamGeometry(member, section);
    case 'wall':
      return buildWallGeometry(member, section, openings);
    case 'slab':
      return buildSlabGeometry(member, section, openings);
  }
}

/**
 * Returns the member-local axis eccentricity, or null when absent / zero.
 * `axisOffset.dx`/`dy` are perpendicular offsets of the solid relative to the
 * structural axis line. Members without it render unchanged.
 */
function getAxisOffset(member: Member): { dx: number; dy: number } | null {
  const offset = member.axisOffset;
  if (!offset) return null;
  if (offset.dx === 0 && offset.dy === 0) return null;
  return offset;
}

function buildColumnGeometry(
  member: Member & { type: 'column' },
  section: Section | undefined,
): THREE.BufferGeometry | null {
  const direction = new THREE.Vector3(
    member.end.x - member.start.x,
    member.end.y - member.start.y,
    member.end.z - member.start.z,
  );
  const length = direction.length();
  if (length < 1e-6) return null;

  const geometry = buildSectionGeometry(section, getColumnRectSize(section), length);
  const ecc = columnAxisOffsetToWorld(getAxisOffset(member) ?? undefined);
  orientLinearGeometry(
    geometry,
    member.start,
    member.end,
    member.rotation ?? 0,
    member.localAxis,
    ecc,
  );
  return geometry;
}

function buildBeamGeometry(
  member: Member & { type: 'beam' },
  section: Section | undefined,
): THREE.BufferGeometry | null {
  const start = new THREE.Vector3(member.start.x, member.start.y, member.start.z);
  const end = new THREE.Vector3(member.end.x, member.end.y, member.end.z);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length < 1e-6) return null;

  const geometry = buildSectionGeometry(section, getBeamRectSize(section), length);
  // Axis eccentricity resolved with the shared convention (dx = in-plan
  // perpendicular, dy = vertical) so 2D, 3D and IFC agree on placement.
  const width = getBeamRectSize(section).width;
  const ecc = linearAxisOffsetToWorld(
    effectiveLinearAxisOffset(member, width),
    member.start,
    member.end,
  );
  orientLinearGeometry(
    geometry,
    member.start,
    member.end,
    member.rotation ?? 0,
    member.localAxis,
    ecc,
  );
  return geometry;
}

/**
 * Build a section in the local XY plane and extrude it along local Z. Unlike a
 * bounding-box approximation, this preserves H-shape flanges/webs and pipe
 * hollows in the 3D viewer. Missing optional H plate dimensions use a visible,
 * conservative 5% preview thickness; validation/export preflight reports the
 * missing engineering values separately.
 */
function buildSectionGeometry(
  section: Section | undefined,
  fallback: { width: number; depth: number },
  length: number,
): THREE.BufferGeometry {
  if (section?.kind === 's_pipe') {
    const radius = section.diameter / 2;
    const innerRadius = Math.max(radius - section.thickness, 0);
    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
    if (innerRadius > 1e-6) {
      const hole = new THREE.Path();
      hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    return centerExtrusion(shape, length, 48);
  }

  if (section?.kind === 's_column_h' || section?.kind === 's_beam_h') {
    const width = section.width;
    const depth = section.depth;
    const web = Math.min(Math.max(section.tw ?? width * 0.05, 0.1), width);
    const flange = Math.min(Math.max(section.tf ?? depth * 0.05, 0.1), depth / 2);
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const halfWeb = web / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-halfWidth, -halfDepth);
    shape.lineTo(halfWidth, -halfDepth);
    shape.lineTo(halfWidth, -halfDepth + flange);
    shape.lineTo(halfWeb, -halfDepth + flange);
    shape.lineTo(halfWeb, halfDepth - flange);
    shape.lineTo(halfWidth, halfDepth - flange);
    shape.lineTo(halfWidth, halfDepth);
    shape.lineTo(-halfWidth, halfDepth);
    shape.lineTo(-halfWidth, halfDepth - flange);
    shape.lineTo(-halfWeb, halfDepth - flange);
    shape.lineTo(-halfWeb, -halfDepth + flange);
    shape.lineTo(-halfWidth, -halfDepth + flange);
    shape.closePath();
    return centerExtrusion(shape, length);
  }

  return new THREE.BoxGeometry(fallback.width, fallback.depth, length);
}

function centerExtrusion(shape: THREE.Shape, length: number, curveSegments = 12): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: false,
    curveSegments,
  });
  geometry.translate(0, 0, -length / 2);
  return geometry;
}

/**
 * Place a local-Z extrusion along a member while keeping local Y as close as
 * possible to global up. This explicit orthonormal basis avoids the shortest-
 * arc quaternion roll ambiguity that previously swapped beam width/depth based
 * on member direction.
 */
function orientLinearGeometry(
  geometry: THREE.BufferGeometry,
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  roll: number,
  localAxis: Member['localAxis'],
  offset: { x: number; y: number; z: number },
) {
  const axes = resolveMemberLocalAxes(start, end, roll, localAxis);
  const localX = new THREE.Vector3(axes.x.x, axes.x.y, axes.x.z);
  const localY = new THREE.Vector3(axes.y.x, axes.y.y, axes.y.z);
  const localZ = new THREE.Vector3(axes.z.x, axes.z.y, axes.z.z);

  const matrix = new THREE.Matrix4().makeBasis(localX, localY, localZ);
  matrix.setPosition(
    (start.x + end.x) / 2 + offset.x,
    (start.y + end.y) / 2 + offset.y,
    (start.z + end.z) / 2 + offset.z,
  );
  geometry.applyMatrix4(matrix);
}

function buildWallGeometry(
  member: Member & { type: 'wall' },
  section: Section | undefined,
  openings: Opening[],
): THREE.BufferGeometry | null {
  const thickness = getWallThickness(member, section);
  const start = new THREE.Vector3(member.start.x, member.start.y, member.start.z);
  const end = new THREE.Vector3(member.end.x, member.end.y, member.end.z);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length < 1e-6) return null;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  shape.lineTo(length, member.height);
  shape.lineTo(0, member.height);
  shape.closePath();

  const axes = resolveMemberLocalAxes(
    member.start,
    member.end,
    member.rotation ?? 0,
    member.localAxis,
  );
  const memberAxis = new THREE.Vector3(axes.z.x, axes.z.y, axes.z.z);
  const verticalAxis = new THREE.Vector3(axes.y.x, axes.y.y, axes.y.z);
  for (const opening of openings) {
    const relative = new THREE.Vector3(
      opening.position.x - member.start.x,
      opening.position.y - member.start.y,
      opening.position.z - member.start.z,
    );
    const offset = relative.dot(memberAxis);
    const left = offset - opening.width / 2;
    const right = offset + opening.width / 2;
    const bottom = relative.dot(verticalAxis);
    const top = bottom + opening.height;

    if (right <= 0 || left >= length || top <= 0 || bottom >= member.height) continue;

    const hole = new THREE.Path();
    hole.moveTo(Math.max(left, 0), Math.max(bottom, 0));
    hole.lineTo(Math.min(right, length), Math.max(bottom, 0));
    hole.lineTo(Math.min(right, length), Math.min(top, member.height));
    hole.lineTo(Math.max(left, 0), Math.min(top, member.height));
    hole.closePath();
    shape.holes.push(hole);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });
  geometry.translate(0, 0, -thickness / 2);

  const localX = new THREE.Vector3(axes.z.x, axes.z.y, axes.z.z);
  const localY = new THREE.Vector3(axes.y.x, axes.y.y, axes.y.z);
  const localZ = new THREE.Vector3(-axes.x.x, -axes.x.y, -axes.x.z);

  // Axis eccentricity resolved with the shared convention (dx = in-plan left
  // perpendicular of start→end, dy = vertical) so 2D, 3D and IFC agree on the
  // wall's placement — including its sign for +X-running walls. (The local
  // `normal` basis above is the thickness axis used to orient the solid, which
  // is direction-dependent; resolving the offset in world space avoids that.)
  const ecc = linearAxisOffsetToWorld(
    effectiveLinearAxisOffset(member, thickness),
    member.start,
    member.end,
  );
  const placement = start.clone();
  placement.x += ecc.x;
  placement.y += ecc.y;
  placement.z += ecc.z;

  const matrix = new THREE.Matrix4().makeBasis(localX, localY, localZ);
  matrix.setPosition(placement);
  geometry.applyMatrix4(matrix);
  return geometry;
}

function buildSlabGeometry(
  member: Member & { type: 'slab' },
  section: Section | undefined,
  openings: Opening[],
): THREE.BufferGeometry | null {
  if (member.polygon.length < 3) return null;
  const thickness = getSlabThickness(section);

  const shape = new THREE.Shape();
  shape.moveTo(member.polygon[0].x, member.polygon[0].y);
  for (let index = 1; index < member.polygon.length; index++) {
    shape.lineTo(member.polygon[index].x, member.polygon[index].y);
  }
  shape.closePath();

  for (const opening of openings) {
    const halfWidth = opening.width / 2;
    const halfDepth = Math.max(opening.height / 2, halfWidth);
    const hole = new THREE.Path();
    hole.moveTo(opening.position.x - halfWidth, opening.position.y - halfDepth);
    hole.lineTo(opening.position.x + halfWidth, opening.position.y - halfDepth);
    hole.lineTo(opening.position.x + halfWidth, opening.position.y + halfDepth);
    hole.lineTo(opening.position.x - halfWidth, opening.position.y + halfDepth);
    hole.closePath();
    shape.holes.push(hole);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });
  // Slab eccentricity maps directly into the X/Y plane via the shared helper so
  // 2D, 3D and IFC agree (dx→world X, dy→world Y).
  const ecc = slabAxisOffsetToWorld(getAxisOffset(member) ?? undefined);
  geometry.translate(ecc.x, ecc.y, member.level - thickness);
  return geometry;
}
