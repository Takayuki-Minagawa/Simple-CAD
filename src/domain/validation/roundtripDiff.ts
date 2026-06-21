import type { Member, ProjectData, Section } from '@/domain/structural/types';
import { isLinearMember } from '@/domain/structural/types';

/**
 * Tolerance-based round-trip comparison of two ProjectData snapshots (3-1).
 *
 * Export→import pipelines (DXF / IFC / analysis JSON) must preserve coordinates,
 * member lengths, section dimensions and member counts within a tolerance. This
 * module computes a structured diff that round-trip tests assert on, so
 * asymmetric bugs (z-base, rotation loss, unit scaling) are caught as
 * regressions instead of silently drifting.
 */

export interface RoundtripTolerance {
  /** Max absolute coordinate / length difference in mm. */
  coord: number;
  /** Max absolute rotation difference in radians. */
  angle: number;
}

export const DEFAULT_ROUNDTRIP_TOLERANCE: RoundtripTolerance = {
  coord: 1, // 1mm
  angle: 1e-3,
};

export interface RoundtripDiff {
  ok: boolean;
  /** Human-readable differences exceeding tolerance. */
  differences: string[];
  /** Count summary for quick assertions. */
  counts: {
    expectedMembers: number;
    actualMembers: number;
    matchedMembers: number;
  };
}

interface MemberMetrics {
  type: Member['type'];
  /** Sorted endpoint set for linear members (order-independent). */
  points: { x: number; y: number; z: number }[];
  length: number;
  rotation: number;
  /** Section signature: dimensions resolved from the project's sections. */
  section: number[];
}

function resolveSection(sectionId: string, sections: Section[]): number[] {
  const sec = sections.find((s) => s.id === sectionId);
  if (!sec) return [];
  if (sec.kind === 's_pipe') return [sec.diameter, sec.thickness];
  if (sec.kind === 'rc_wall' || sec.kind === 'rc_slab') return [sec.thickness];
  return [sec.width, sec.depth];
}

function memberMetrics(m: Member, sections: Section[]): MemberMetrics {
  const section = resolveSection(m.sectionId, sections);
  if (m.type === 'slab') {
    const pts = m.polygon.map((p) => ({ x: p.x, y: p.y, z: m.level }));
    return { type: m.type, points: sortPoints(pts), length: 0, rotation: m.rotation ?? 0, section };
  }
  const pts = [m.start, m.end].map((p) => ({ x: p.x, y: p.y, z: p.z }));
  const length = Math.hypot(m.end.x - m.start.x, m.end.y - m.start.y, m.end.z - m.start.z);
  return { type: m.type, points: sortPoints(pts), length, rotation: m.rotation ?? 0, section };
}

function sortPoints(pts: { x: number; y: number; z: number }[]): { x: number; y: number; z: number }[] {
  return [...pts].sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z);
}

/**
 * Compare two projects member-by-member with tolerance. Members are matched
 * greedily by type + nearest endpoint set (round-trips don't preserve ids/order
 * across DXF/IFC), then their length / section / rotation are compared.
 */
export function diffProjects(
  expected: ProjectData,
  actual: ProjectData,
  tol: RoundtripTolerance = DEFAULT_ROUNDTRIP_TOLERANCE,
): RoundtripDiff {
  const differences: string[] = [];

  const expMetrics = expected.members.map((m) => memberMetrics(m, expected.sections));
  const actMetrics = actual.members.map((m) => memberMetrics(m, actual.sections));

  if (expMetrics.length !== actMetrics.length) {
    differences.push(`member count: expected ${expMetrics.length}, got ${actMetrics.length}`);
  }

  const used = new Set<number>();
  let matched = 0;

  for (const exp of expMetrics) {
    let bestIdx = -1;
    let bestCost = Infinity;
    for (let i = 0; i < actMetrics.length; i++) {
      if (used.has(i)) continue;
      const act = actMetrics[i];
      if (act.type !== exp.type) continue;
      if (act.points.length !== exp.points.length) continue;
      const cost = pointSetCost(exp.points, act.points);
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) {
      differences.push(`no ${exp.type} match for member at ${describePoints(exp.points)}`);
      continue;
    }

    used.add(bestIdx);
    matched++;
    const act = actMetrics[bestIdx];

    if (bestCost > tol.coord) {
      differences.push(
        `${exp.type} endpoints differ by ${bestCost.toFixed(3)}mm at ${describePoints(exp.points)}`,
      );
    }
    if (Math.abs(exp.length - act.length) > tol.coord) {
      differences.push(
        `${exp.type} length: expected ${exp.length.toFixed(2)}, got ${act.length.toFixed(2)}`,
      );
    }
    if (exp.section.length === act.section.length) {
      for (let i = 0; i < exp.section.length; i++) {
        if (Math.abs(exp.section[i] - act.section[i]) > tol.coord) {
          differences.push(
            `${exp.type} section dim[${i}]: expected ${exp.section[i]}, got ${act.section[i]}`,
          );
        }
      }
    } else {
      differences.push(`${exp.type} section signature mismatch`);
    }
    if (angleDiff(exp.rotation, act.rotation) > tol.angle) {
      differences.push(
        `${exp.type} rotation: expected ${exp.rotation.toFixed(4)}, got ${act.rotation.toFixed(4)}`,
      );
    }
  }

  return {
    ok: differences.length === 0,
    differences,
    counts: {
      expectedMembers: expMetrics.length,
      actualMembers: actMetrics.length,
      matchedMembers: matched,
    },
  };
}

/** Average nearest-point distance between two equal-size sorted point sets. */
function pointSetCost(
  a: { x: number; y: number; z: number }[],
  b: { x: number; y: number; z: number }[],
): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    total += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y, a[i].z - b[i].z);
  }
  return total / Math.max(a.length, 1);
}

/** Smallest difference between two angles, accounting for π symmetry of sections. */
function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % Math.PI;
  if (d > Math.PI / 2) d = Math.PI - d;
  return d;
}

function describePoints(pts: { x: number; y: number; z: number }[]): string {
  return pts.map((p) => `(${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)})`).join('-');
}

/** Convenience: true when every linear member's endpoints match within tol. */
export function endpointsPreserved(
  expected: ProjectData,
  actual: ProjectData,
  tol: RoundtripTolerance = DEFAULT_ROUNDTRIP_TOLERANCE,
): boolean {
  const linearExpected = expected.members.filter(isLinearMember).length;
  const diff = diffProjects(expected, actual, tol);
  return diff.ok && diff.counts.matchedMembers >= linearExpected;
}
