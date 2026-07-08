import * as THREE from 'three';
import type { Member, ProjectData, Section } from '@/domain/structural/types';
import { getSlabThickness } from '@/domain/structural/memberShape';

export type SectionMode = 'off' | 'clip' | 'slice' | 'box';
export type SectionAxis = 'x' | 'y' | 'z';

export interface SectionBoxState {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

export interface ModelExtents {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

export const SCALE = 0.001;

export function computeModelExtents(
  data: ProjectData | null,
  members: Member[],
  sectionMap: Map<string, Section>,
): ModelExtents {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];

  for (const grid of data?.grids ?? []) {
    if (grid.axis === 'X') xs.push(grid.position);
    if (grid.axis === 'Y') ys.push(grid.position);
  }

  for (const story of data?.stories ?? []) {
    zs.push(story.elevation, story.elevation + story.height);
  }

  for (const member of members) {
    if (member.type === 'slab') {
      const section = sectionMap.get(member.sectionId);
      const thickness = getSlabThickness(section);
      for (const point of member.polygon) {
        xs.push(point.x);
        ys.push(point.y);
      }
      zs.push(member.level - thickness, member.level);
      continue;
    }

    xs.push(member.start.x, member.end.x);
    ys.push(member.start.y, member.end.y);
    zs.push(member.start.z, member.end.z);
    if (member.type === 'wall') {
      zs.push(member.start.z + member.height, member.end.z + member.height);
    }
  }

  if (xs.length === 0) xs.push(0, 8000);
  if (ys.length === 0) ys.push(0, 6000);
  if (zs.length === 0) zs.push(0, 3000);

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);

  return {
    xMin: xMin - Math.max((xMax - xMin) * 0.05, 1000),
    xMax: xMax + Math.max((xMax - xMin) * 0.05, 1000),
    yMin: yMin - Math.max((yMax - yMin) * 0.05, 1000),
    yMax: yMax + Math.max((yMax - yMin) * 0.05, 1000),
    // Keep negative Z in view so columns placed downward from the active level are not clipped.
    zMin: zMin - 500,
    zMax: zMax + 500,
  };
}

export function getAxisRange(extents: ModelExtents, axis: SectionAxis) {
  switch (axis) {
    case 'x':
      return { min: extents.xMin, max: extents.xMax };
    case 'y':
      return { min: extents.yMin, max: extents.yMax };
    case 'z':
      return { min: extents.zMin, max: extents.zMax };
  }
}

export function clampSectionBox(box: SectionBoxState, extents: ModelExtents): SectionBoxState {
  const xMin = clamp(box.xMin, extents.xMin, extents.xMax - 100);
  const xMax = clamp(box.xMax, xMin + 100, extents.xMax);
  const yMin = clamp(box.yMin, extents.yMin, extents.yMax - 100);
  const yMax = clamp(box.yMax, yMin + 100, extents.yMax);
  const zMin = clamp(box.zMin, extents.zMin, extents.zMax - 100);
  const zMax = clamp(box.zMax, zMin + 100, extents.zMax);
  return { xMin, xMax, yMin, yMax, zMin, zMax };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function buildMinPlane(axis: SectionAxis, position: number): THREE.Plane {
  const normal = cadAxisToWorldBasis(axis);
  return new THREE.Plane(normal, -position * SCALE);
}

export function buildMaxPlane(axis: SectionAxis, position: number): THREE.Plane {
  const normal = cadAxisToWorldBasis(axis).clone().multiplyScalar(-1);
  return new THREE.Plane(normal, position * SCALE);
}

function cadAxisToWorldBasis(axis: SectionAxis): THREE.Vector3 {
  switch (axis) {
    case 'x':
      return new THREE.Vector3(1, 0, 0);
    case 'y':
      return new THREE.Vector3(0, 0, -1);
    case 'z':
      return new THREE.Vector3(0, 1, 0);
  }
}
