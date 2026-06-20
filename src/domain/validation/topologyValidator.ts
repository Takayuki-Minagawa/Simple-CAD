import type { ProjectData } from '@/domain/structural/types';
import type { Point3D } from '@/domain/geometry/types';
import type { ValidationError, ValidationResult } from './types';

/**
 * Topology / level-integrity / joint-integrity validation.
 *
 * These checks are intentionally emitted as `warning` (not `error`) so that
 * existing valid projects with minor modeling looseness continue to load. They
 * surface structural-consistency hints that would otherwise silently break the
 * analysis model:
 *  - story elevation monotonicity / duplication
 *  - grid position duplication per axis
 *  - level integrity (adjacent EL continuity, slab/wall within story range)
 *  - joint integrity (beam-end → column/beam connectivity, column stacking)
 */

/** Tolerance for "near" comparisons of elevations / plan positions (mm). */
const JOINT_TOLERANCE = 1; // 1mm — generous enough for hand-modeled data
const LEVEL_TOLERANCE = 1;

export function validateTopology(data: ProjectData): ValidationResult {
  const errors: ValidationError[] = [];

  validateStoryElevations(data, errors);
  validateGridDuplication(data, errors);
  validateLevelIntegrity(data, errors);
  validateJointIntegrity(data, errors);

  return { ok: errors.every((e) => e.level !== 'error'), errors };
}

// ── Story elevation monotonicity / duplication ───────────────

function validateStoryElevations(data: ProjectData, errors: ValidationError[]) {
  const stories = data.stories;
  const seen = new Map<number, string>();
  for (const s of stories) {
    const dup = seen.get(s.elevation);
    if (dup !== undefined) {
      errors.push({
        level: 'warning',
        message: `Story "${s.id}": elevation ${s.elevation} が Story "${dup}" と重複`,
        path: `/stories/${s.id}`,
      });
    } else {
      seen.set(s.elevation, s.id);
    }
  }

  // Monotonicity: stories listed in order should be strictly increasing in EL.
  for (let i = 1; i < stories.length; i++) {
    const prev = stories[i - 1];
    const cur = stories[i];
    if (cur.elevation < prev.elevation) {
      errors.push({
        level: 'warning',
        message: `Story "${cur.id}": elevation ${cur.elevation} が直前の Story "${prev.id}" (${prev.elevation}) より低い（逆順）`,
        path: `/stories/${cur.id}`,
      });
    }
  }

  // Adjacent EL continuity: lowerEL + height ≈ upperEL.
  const ordered = [...stories].sort((a, b) => a.elevation - b.elevation);
  for (let i = 1; i < ordered.length; i++) {
    const lower = ordered[i - 1];
    const upper = ordered[i];
    const expected = lower.elevation + lower.height;
    if (Math.abs(expected - upper.elevation) > LEVEL_TOLERANCE) {
      errors.push({
        level: 'warning',
        message: `Story "${lower.id}": elevation+height (${expected}) が上階 "${upper.id}" の elevation (${upper.elevation}) と不一致`,
        path: `/stories/${lower.id}`,
      });
    }
  }
}

// ── Grid position duplication per axis ───────────────────────

function validateGridDuplication(data: ProjectData, errors: ValidationError[]) {
  const byAxis = new Map<string, Map<number, string>>();
  for (const g of data.grids) {
    let seen = byAxis.get(g.axis);
    if (!seen) {
      seen = new Map<number, string>();
      byAxis.set(g.axis, seen);
    }
    const dup = seen.get(g.position);
    if (dup !== undefined) {
      errors.push({
        level: 'warning',
        message: `Grid "${g.id}": ${g.axis} 軸の position ${g.position} が Grid "${dup}" と重複`,
        path: `/grids/${g.id}`,
      });
    } else {
      seen.set(g.position, g.id);
    }
  }
}

// ── Level integrity (slab / wall within story range) ─────────

function validateLevelIntegrity(data: ProjectData, errors: ValidationError[]) {
  const storyById = new Map(data.stories.map((s) => [s.id, s]));

  for (const m of data.members) {
    const story = storyById.get(m.story);
    if (!story) continue; // reference validator handles missing story

    if (m.type === 'slab') {
      const top = story.elevation + story.height;
      if (m.level < story.elevation - LEVEL_TOLERANCE || m.level > top + LEVEL_TOLERANCE) {
        errors.push({
          level: 'warning',
          message: `Member "${m.id}": slab level ${m.level} が階 "${story.id}" の範囲 [${story.elevation}, ${top}] 外`,
          path: `/members/${m.id}`,
        });
      }
    } else if (m.type === 'wall') {
      if (m.height > story.height + LEVEL_TOLERANCE) {
        errors.push({
          level: 'warning',
          message: `Member "${m.id}": wall height ${m.height} が階高 ${story.height} を超過`,
          path: `/members/${m.id}`,
        });
      }
    }
  }
}

// ── Joint integrity ──────────────────────────────────────────

function validateJointIntegrity(data: ProjectData, errors: ValidationError[]) {
  const columns = data.members.filter((m) => m.type === 'column') as Extract<
    ProjectData['members'][number],
    { type: 'column' }
  >[];
  const beams = data.members.filter((m) => m.type === 'beam') as Extract<
    ProjectData['members'][number],
    { type: 'beam' }
  >[];

  // Column foot/head plan positions, for beam-end snapping.
  const columnPoints: Point3D[] = [];
  for (const c of columns) {
    columnPoints.push(c.start, c.end);
  }
  // Other beam endpoints.
  const beamEndpoints: Point3D[] = [];
  for (const b of beams) {
    beamEndpoints.push(b.start, b.end);
  }

  // Each beam endpoint should be near a column or another beam endpoint.
  for (const b of beams) {
    for (const [label, ep] of [
      ['start', b.start],
      ['end', b.end],
    ] as const) {
      const nearColumn = columnPoints.some((p) => near3DPlan(p, ep));
      const nearBeam = beamEndpoints.some((p) => p !== ep && near3D(p, ep));
      if (!nearColumn && !nearBeam) {
        errors.push({
          level: 'warning',
          message: `Member "${b.id}": ${label} 端点が柱・他梁端点に接続していない（接合未成立）`,
          path: `/members/${b.id}`,
        });
      }
    }
  }

  // Upper/lower columns sharing a plan position should be plane-coincident
  // (vertically continuous). Group columns by plan (x, y) and verify stacking.
  const planGroups = new Map<string, typeof columns>();
  for (const c of columns) {
    const key = planKey(c.start);
    const arr = planGroups.get(key);
    if (arr) arr.push(c);
    else planGroups.set(key, [c]);
  }
  for (const group of planGroups.values()) {
    if (group.length < 2) continue;
    // All columns in a plan group should share the same plan position at both
    // ends (vertical members). Cross-check start/end plan coincidence.
    for (const c of group) {
      if (!near3DPlan(c.start, c.end)) {
        errors.push({
          level: 'warning',
          message: `Member "${c.id}": 柱の上下端の平面位置が一致しない（非鉛直）`,
          path: `/members/${c.id}`,
        });
      }
    }
  }
}

// ── helpers ──────────────────────────────────────────────────

function near3D(a: Point3D, b: Point3D, tol = JOINT_TOLERANCE): boolean {
  return (
    Math.abs(a.x - b.x) <= tol &&
    Math.abs(a.y - b.y) <= tol &&
    Math.abs(a.z - b.z) <= tol
  );
}

/** Plan (x, y) proximity, ignoring z. */
function near3DPlan(a: Point3D, b: Point3D, tol = JOINT_TOLERANCE): boolean {
  return Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
}

function planKey(p: Point3D): string {
  return `${Math.round(p.x)}:${Math.round(p.y)}`;
}
