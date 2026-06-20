import * as THREE from 'three';
import type { Member, Section } from '@/domain/structural/types';

/**
 * Candidate snap point for the 3D measurement tool, expressed in CAD-space
 * (millimetres, same coordinate frame as `member.start`/`member.end`).
 */
export interface MeasureSnapPoint {
  point: THREE.Vector3;
  memberId: string;
}

/**
 * Collect snappable endpoints (and a few characteristic points) for a member in
 * CAD coordinates. Used to snap the raycast hit to the nearest member endpoint.
 */
export function getMemberSnapPoints(member: Member, section: Section | undefined): THREE.Vector3[] {
  // section is currently unused but kept for future section-aware snapping.
  void section;
  switch (member.type) {
    case 'column':
    case 'beam': {
      const start = new THREE.Vector3(member.start.x, member.start.y, member.start.z);
      const end = new THREE.Vector3(member.end.x, member.end.y, member.end.z);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      return [start, end, mid];
    }
    case 'wall': {
      const z0 = member.start.z;
      const z1 = member.start.z + member.height;
      return [
        new THREE.Vector3(member.start.x, member.start.y, z0),
        new THREE.Vector3(member.end.x, member.end.y, z0),
        new THREE.Vector3(member.start.x, member.start.y, z1),
        new THREE.Vector3(member.end.x, member.end.y, z1),
      ];
    }
    case 'slab': {
      const z = member.level;
      return member.polygon.map((p) => new THREE.Vector3(p.x, p.y, z));
    }
  }
}

/** CAD-space length of a linear member, or null for non-linear members. */
export function getMemberLength(member: Member): number | null {
  if (member.type === 'slab') return null;
  const dx = member.end.x - member.start.x;
  const dy = member.end.y - member.start.y;
  const dz = member.end.z - member.start.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Human-readable section name for the hover probe. */
export function getSectionLabel(section: Section | undefined): string {
  if (!section) return '-';
  switch (section.kind) {
    case 'rc_column_rect':
    case 'rc_beam_rect':
    case 's_column_h':
    case 's_beam_h':
      return `${section.id} (${section.width}×${section.depth})`;
    case 'rc_slab':
    case 'rc_wall':
      return `${section.id} (t${section.thickness})`;
    case 's_pipe':
      return `${section.id} (⌀${section.diameter})`;
  }
}

export interface MeasureComponents {
  /** Straight-line 3D distance in mm. */
  distance: number;
  dx: number;
  dy: number;
  dz: number;
}

/**
 * Distance + axis components between two CAD-space points (mm).
 */
export function measureBetween(a: THREE.Vector3, b: THREE.Vector3): MeasureComponents {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return {
    distance: Math.sqrt(dx * dx + dy * dy + dz * dz),
    dx,
    dy,
    dz,
  };
}

/** Format a millimetre value for display (no decimals beyond ~mm precision). */
export function formatMm(value: number): string {
  const rounded = Math.round(value);
  return `${rounded}`;
}
