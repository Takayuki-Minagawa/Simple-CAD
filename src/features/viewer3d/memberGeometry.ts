import * as THREE from 'three';
import type { Member, Opening, Section } from '@/domain/structural/types';

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

export function buildMemberGeometry(input: GeometryBuildInput, engine: GeometryEngine): THREE.BufferGeometry | null {
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

function buildNativeGeometry({ member, section, openings }: GeometryBuildInput): THREE.BufferGeometry | null {
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

function buildColumnGeometry(
  member: Member & { type: 'column' },
  section: Section | undefined,
): THREE.BufferGeometry {
  const width = section && 'width' in section ? section.width : 600;
  const depth = section && 'depth' in section ? section.depth : 600;
  const height = Math.max(Math.abs(member.end.z - member.start.z), 1);
  const geometry = new THREE.BoxGeometry(width, depth, height);
  geometry.translate(member.start.x, member.start.y, (member.start.z + member.end.z) / 2);
  return geometry;
}

function buildBeamGeometry(
  member: Member & { type: 'beam' },
  section: Section | undefined,
): THREE.BufferGeometry | null {
  const width = section && 'width' in section ? section.width : 300;
  const depth = section && 'depth' in section ? section.depth : 600;
  const start = new THREE.Vector3(member.start.x, member.start.y, member.start.z);
  const end = new THREE.Vector3(member.end.x, member.end.y, member.end.z);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length < 1e-6) return null;

  const geometry = new THREE.BoxGeometry(width, depth, length);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction.clone().normalize(),
  );
  geometry.applyQuaternion(quaternion);
  geometry.translate((member.start.x + member.end.x) / 2, (member.start.y + member.end.y) / 2, (member.start.z + member.end.z) / 2);
  return geometry;
}

function buildWallGeometry(
  member: Member & { type: 'wall' },
  section: Section | undefined,
  openings: Opening[],
): THREE.BufferGeometry | null {
  const thickness = section && 'thickness' in section ? section.thickness : member.thickness;
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

  const axis = direction.clone().normalize();
  for (const opening of openings) {
    const relative = new THREE.Vector3(
      opening.position.x - member.start.x,
      opening.position.y - member.start.y,
      opening.position.z - member.start.z,
    );
    const offset = relative.dot(axis);
    const left = offset - opening.width / 2;
    const right = offset + opening.width / 2;
    const bottom = opening.position.z - member.start.z;
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

  const up = new THREE.Vector3(0, 0, 1);
  const normal = new THREE.Vector3().crossVectors(axis, up);
  if (normal.lengthSq() < 1e-6) {
    normal.set(1, 0, 0);
  } else {
    normal.normalize();
  }

  const matrix = new THREE.Matrix4().makeBasis(axis, up, normal);
  matrix.setPosition(start);
  geometry.applyMatrix4(matrix);
  return geometry;
}

function buildSlabGeometry(
  member: Member & { type: 'slab' },
  section: Section | undefined,
  openings: Opening[],
): THREE.BufferGeometry | null {
  if (member.polygon.length < 3) return null;
  const thickness = section && 'thickness' in section ? section.thickness : 180;

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
  geometry.translate(0, 0, member.level - thickness);
  return geometry;
}
