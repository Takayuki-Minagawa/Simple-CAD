import { JOINT_MERGE_TOLERANCE, SpatialPointIndex3D } from '@/domain/geometry/precision';
import type {
  AnalysisMemberResult,
  AnalysisNodeDisplacement,
  Member,
} from '@/domain/structural/types';
import type { Point3D } from '@/domain/geometry/types';

export interface DisplacedPoint extends Point3D {
  hasResult: boolean;
}

export function buildDisplacementMap(
  displacements: AnalysisNodeDisplacement[] | undefined,
): SpatialPointIndex3D<AnalysisNodeDisplacement> {
  const index = new SpatialPointIndex3D<AnalysisNodeDisplacement>(JOINT_MERGE_TOLERANCE);
  for (const displacement of displacements ?? []) {
    index.insert(displacement.position, displacement);
  }
  return index;
}

/** Keep result markers only for nodes belonging to the currently visible members. */
export function filterNodeDisplacementsForMembers(
  displacements: AnalysisNodeDisplacement[] | undefined,
  members: Member[],
): AnalysisNodeDisplacement[] {
  if (!displacements || members.length === 0) return [];
  const nodes = new SpatialPointIndex3D<boolean>(JOINT_MERGE_TOLERANCE);
  for (const member of members) {
    if (member.type === 'slab') {
      for (const point of member.polygon) {
        nodes.insert({ ...point, z: member.level }, true);
      }
    } else {
      nodes.insert(member.start, true);
      nodes.insert(member.end, true);
    }
  }
  return displacements.filter((displacement) => nodes.find(displacement.position));
}

export function displacePoint(
  point: Point3D,
  displacementMap: SpatialPointIndex3D<AnalysisNodeDisplacement>,
  scale: number,
): DisplacedPoint {
  const displacement = displacementMap.find(point);
  if (!displacement) return { ...point, hasResult: false };
  return {
    x: point.x + displacement.dx * scale,
    y: point.y + displacement.dy * scale,
    z: point.z + displacement.dz * scale,
    hasResult: true,
  };
}

export function buildUtilizationMap(
  results: AnalysisMemberResult[] | undefined,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const result of results ?? []) {
    if (result.utilization == null || !Number.isFinite(result.utilization)) continue;
    map.set(result.memberId, result.utilization);
  }
  return map;
}

function mix(start: number, end: number, amount: number): number {
  return Math.round(start + (end - start) * amount);
}

function hex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Green at zero, amber at unity and red for values at or above 1.5. */
export function utilizationColor(utilization: number | undefined): string | undefined {
  if (utilization == null || !Number.isFinite(utilization)) return undefined;
  const value = Math.max(0, Math.min(1.5, utilization));
  if (value <= 1) {
    const amount = value;
    return hex(mix(34, 245, amount), mix(197, 158, amount), mix(94, 11, amount));
  }
  const amount = (value - 1) / 0.5;
  return hex(mix(245, 220, amount), mix(158, 38, amount), mix(11, 38, amount));
}

export function utilizationRange(results: AnalysisMemberResult[] | undefined): {
  min: number;
  max: number;
} | null {
  const values = (results ?? [])
    .map((result) => result.utilization)
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}
