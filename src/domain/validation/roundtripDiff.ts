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
    expectedOpenings: number;
    actualOpenings: number;
    matchedOpenings: number;
    expectedGrids: number;
    actualGrids: number;
    matchedGrids: number;
    expectedMaterials: number;
    actualMaterials: number;
    matchedMaterials: number;
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

  const matchedOpenings = compareOpenings(expected, actual, tol, differences);
  // IFC does not require grids. Compare them when both sides expose grid data;
  // this still exercises analysis JSON and layer-aware DXF round-trips.
  const compareGridData = expected.grids.length > 0 && actual.grids.length > 0;
  const matchedGrids = compareGridData
    ? compareGrids(expected, actual, tol, differences)
    : 0;
  const matchedMaterials = compareMaterials(expected, actual, tol, differences);

  return {
    ok: differences.length === 0,
    differences,
    counts: {
      expectedMembers: expMetrics.length,
      actualMembers: actMetrics.length,
      matchedMembers: matched,
      expectedOpenings: expected.openings.length,
      actualOpenings: actual.openings.length,
      matchedOpenings,
      expectedGrids: expected.grids.length,
      actualGrids: actual.grids.length,
      matchedGrids,
      expectedMaterials: expected.materials.length,
      actualMaterials: actual.materials.length,
      matchedMaterials,
    },
  };
}

function compareOpenings(
  expected: ProjectData,
  actual: ProjectData,
  tolerance: RoundtripTolerance,
  differences: string[],
): number {
  if (expected.openings.length !== actual.openings.length) {
    differences.push(
      `opening count: expected ${expected.openings.length}, got ${actual.openings.length}`,
    );
  }
  let matched = 0;
  for (const opening of expected.openings) {
    const candidate = actual.openings.find((item) => item.id === opening.id);
    if (!candidate) {
      differences.push(`opening ${opening.id} is missing`);
      continue;
    }
    matched++;
    const positionDelta = Math.hypot(
      candidate.position.x - opening.position.x,
      candidate.position.y - opening.position.y,
      candidate.position.z - opening.position.z,
    );
    if (positionDelta > tolerance.coord) {
      differences.push(`opening ${opening.id} position differs by ${positionDelta.toFixed(3)}mm`);
    }
    if (
      Math.abs(candidate.width - opening.width) > tolerance.coord ||
      Math.abs(candidate.height - opening.height) > tolerance.coord
    ) {
      differences.push(`opening ${opening.id} dimensions differ`);
    }
    if (candidate.memberId !== opening.memberId || candidate.type !== opening.type) {
      differences.push(`opening ${opening.id} host/type differs`);
    }
  }
  return matched;
}

function compareGrids(
  expected: ProjectData,
  actual: ProjectData,
  tolerance: RoundtripTolerance,
  differences: string[],
): number {
  if (expected.grids.length !== actual.grids.length) {
    differences.push(`grid count: expected ${expected.grids.length}, got ${actual.grids.length}`);
  }
  const used = new Set<number>();
  let matched = 0;
  for (const grid of expected.grids) {
    const index = actual.grids.findIndex(
      (candidate, candidateIndex) =>
        !used.has(candidateIndex) &&
        candidate.axis === grid.axis &&
        Math.abs(candidate.position - grid.position) <= tolerance.coord,
    );
    if (index < 0) {
      differences.push(`grid ${grid.name} (${grid.axis}@${grid.position}) is missing`);
      continue;
    }
    used.add(index);
    matched++;
  }
  return matched;
}

function compareMaterials(
  expected: ProjectData,
  actual: ProjectData,
  tolerance: RoundtripTolerance,
  differences: string[],
): number {
  if (expected.materials.length !== actual.materials.length) {
    differences.push(
      `material count: expected ${expected.materials.length}, got ${actual.materials.length}`,
    );
  }
  let matched = 0;
  for (const material of expected.materials) {
    const candidate = actual.materials.find((item) => item.id === material.id);
    if (!candidate) {
      differences.push(`material ${material.id} is missing`);
      continue;
    }
    matched++;
    if (candidate.name !== material.name || candidate.type !== material.type) {
      differences.push(`material ${material.id} identity differs`);
    }
    for (const property of [
      'elasticModulus',
      'shearModulus',
      'poissonRatio',
      'unitWeight',
      'Fc',
      'F',
      'Fy',
      'referenceStrength',
      'moistureContent',
      'allowableBendingStress',
      'allowableCompressionStress',
      'allowableShearStress',
    ] as const) {
      const left = material[property];
      const right = candidate[property];
      if (left === undefined && right === undefined) continue;
      if (left === undefined || right === undefined || Math.abs(left - right) > tolerance.coord) {
        differences.push(`material ${material.id} ${property} differs`);
      }
    }
  }
  return matched;
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
