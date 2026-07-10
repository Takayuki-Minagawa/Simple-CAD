import type { ProjectData } from '@/domain/structural/types';
import type { Point3D } from '@/domain/geometry/types';
import { JOINT_MERGE_TOLERANCE } from '@/domain/geometry/precision';
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
const JOINT_TOLERANCE = JOINT_MERGE_TOLERANCE;
const LEVEL_TOLERANCE = 1;

export function validateTopology(data: ProjectData): ValidationResult {
  const errors: ValidationError[] = [];

  validateStoryElevations(data, errors);
  validateGridDuplication(data, errors);
  validateLevelIntegrity(data, errors);
  validateJointIntegrity(data, errors);
  validateSlabBoundarySupport(data, errors);

  return { ok: errors.every((e) => e.level !== 'error'), errors };
}

// ── Slab boundary ↔ beam/wall loop consistency ──────────────

function validateSlabBoundarySupport(data: ProjectData, errors: ValidationError[]) {
  for (const slab of data.members) {
    if (slab.type !== 'slab' || slab.polygon.length < 3) continue;
    const supports = data.members.filter(
      (member): member is Extract<ProjectData['members'][number], { type: 'beam' | 'wall' }> =>
        member.story === slab.story && (member.type === 'beam' || member.type === 'wall'),
    );
    for (let index = 0; index < slab.polygon.length; index += 1) {
      const start = slab.polygon[index];
      const end = slab.polygon[(index + 1) % slab.polygon.length];
      // Multiple collinear beams may support one slab edge. Sampling catches
      // both a split support line and a material gap without requiring IDs to
      // be modeled in the same segmentation as the slab polygon.
      const edgeSupported = [0, 0.25, 0.5, 0.75, 1].every((ratio) => {
        const point = {
          x: start.x + (end.x - start.x) * ratio,
          y: start.y + (end.y - start.y) * ratio,
        };
        return supports.some(
          (member) => pointToSegmentDistance2D(point, member.start, member.end) <= JOINT_TOLERANCE,
        );
      });
      if (!edgeSupported) {
        errors.push({
          level: 'warning',
          message: `Member "${slab.id}": slab外周 edge ${index + 1} が同一階の梁・壁の閉ループに一致しません`,
          path: `/members/${slab.id}/polygon/${index}`,
        });
      }
    }
  }
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
    } else if (m.type === 'beam') {
      const expectedLevel = story.elevation + story.height;
      if (
        Math.abs(m.start.z - expectedLevel) > LEVEL_TOLERANCE ||
        Math.abs(m.end.z - expectedLevel) > LEVEL_TOLERANCE
      ) {
        errors.push({
          level: 'warning',
          message: `Member "${m.id}": 梁端レベル [${m.start.z}, ${m.end.z}] が階の梁レベル ${expectedLevel}mm と不一致`,
          path: `/members/${m.id}`,
        });
      }
    } else if (m.type === 'column') {
      const verticalSpan = Math.abs(m.end.z - m.start.z);
      if (Math.abs(verticalSpan - story.height) > LEVEL_TOLERANCE) {
        errors.push({
          level: 'warning',
          message: `Member "${m.id}": 柱の鉛直スパン ${verticalSpan}mm が階高 ${story.height}mm と不一致`,
          path: `/members/${m.id}`,
        });
      }
      const columnBottom = Math.min(m.start.z, m.end.z);
      const columnTop = Math.max(m.start.z, m.end.z);
      const storyTop = story.elevation + story.height;
      if (
        Math.abs(columnBottom - story.elevation) > LEVEL_TOLERANCE ||
        Math.abs(columnTop - storyTop) > LEVEL_TOLERANCE
      ) {
        errors.push({
          level: 'warning',
          message: `Member "${m.id}": 柱端レベル [${columnBottom}, ${columnTop}] が階範囲 [${story.elevation}, ${storyTop}] と不一致`,
          path: `/members/${m.id}`,
        });
      }
    } else if (m.type === 'wall') {
      if (
        Math.abs(m.start.z - story.elevation) > LEVEL_TOLERANCE ||
        Math.abs(m.end.z - story.elevation) > LEVEL_TOLERANCE
      ) {
        errors.push({
          level: 'warning',
          message: `Member "${m.id}": wall基準レベルが階EL ${story.elevation}mm と不一致`,
          path: `/members/${m.id}`,
        });
      }
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
      const nearColumn = columnPoints.some((p) => near3D(p, ep));
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
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= tol;
}

/** Plan (x, y) proximity, ignoring z. */
function near3DPlan(a: Point3D, b: Point3D, tol = JOINT_TOLERANCE): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= tol;
}

function planKey(p: Point3D): string {
  return `${Math.round(p.x)}:${Math.round(p.y)}`;
}

function pointToSegmentDistance2D(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (start.x + dx * ratio), point.y - (start.y + dy * ratio));
}
