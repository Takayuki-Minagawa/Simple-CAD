import type { Point2D } from '@/domain/geometry/types';
import type { ProjectData, LinearMember } from './types';
import { isLinearMember } from './types';

/**
 * Find the intersection point of two line segments (2D).
 * Returns null if lines are parallel or intersection is outside both segments.
 */
export function lineLineIntersection(
  a1: Point2D,
  a2: Point2D,
  b1: Point2D,
  b2: Point2D,
): Point2D | null {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;

  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-10) return null; // parallel

  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom;
  const u = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / denom;

  // For trim we use segment-line intersection (t in [0,1], u unrestricted for extend)
  if (t < -1e-10 || t > 1 + 1e-10) return null;
  if (u < -1e-10 || u > 1 + 1e-10) return null;

  return {
    x: a1.x + t * dax,
    y: a1.y + t * day,
  };
}

/**
 * Find intersection point between a ray from a1 toward a2 and segment b1-b2.
 * The ray parameter t is unrestricted (for extend), but u must be in [0,1].
 */
function raySegmentIntersection(
  a1: Point2D,
  a2: Point2D,
  b1: Point2D,
  b2: Point2D,
): { point: Point2D; t: number } | null {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;

  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom;
  const u = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / denom;

  if (u < -1e-10 || u > 1 + 1e-10) return null;

  return {
    point: { x: a1.x + t * dax, y: a1.y + t * day },
    t,
  };
}

function getMember2DStart(m: LinearMember): Point2D {
  return { x: m.start.x, y: m.start.y };
}

function getMember2DEnd(m: LinearMember): Point2D {
  return { x: m.end.x, y: m.end.y };
}

/**
 * Trim a linear member at the nearest intersection point.
 * `side` = 'start' keeps the start side (trims from the cut toward end).
 * `side` = 'end' keeps the end side (trims from start toward the cut).
 */
export function trimMember(
  data: ProjectData,
  memberId: string,
  cutPoint: Point2D,
  side: 'start' | 'end',
): boolean {
  const member = data.members.find((m) => m.id === memberId);
  if (!member || !isLinearMember(member)) return false;

  const mStart = getMember2DStart(member);
  const mEnd = getMember2DEnd(member);

  // Find nearest intersection with other members
  let closestIntersection: Point2D | null = null;
  let closestDist = Infinity;

  for (const other of data.members) {
    if (other.id === memberId || !isLinearMember(other)) continue;
    const oStart = getMember2DStart(other);
    const oEnd = getMember2DEnd(other);
    const ix = lineLineIntersection(mStart, mEnd, oStart, oEnd);
    if (!ix) continue;

    const dist = Math.hypot(ix.x - cutPoint.x, ix.y - cutPoint.y);
    if (dist < closestDist) {
      closestDist = dist;
      closestIntersection = ix;
    }
  }

  if (!closestIntersection) return false;

  if (side === 'start') {
    // Keep start side: set end to intersection
    member.end.x = closestIntersection.x;
    member.end.y = closestIntersection.y;
  } else {
    // Keep end side: set start to intersection
    member.start.x = closestIntersection.x;
    member.start.y = closestIntersection.y;
  }

  return true;
}

/**
 * Extend a linear member to intersect with a target member.
 * Extends the closest endpoint of the member toward the target.
 */
export function extendMember(
  data: ProjectData,
  memberId: string,
  targetMemberId: string,
): boolean {
  const member = data.members.find((m) => m.id === memberId);
  const target = data.members.find((m) => m.id === targetMemberId);
  if (!member || !target || !isLinearMember(member) || !isLinearMember(target)) return false;

  const mStart = getMember2DStart(member);
  const mEnd = getMember2DEnd(member);
  const tStart = getMember2DStart(target);
  const tEnd = getMember2DEnd(target);

  // Try extending end point
  const endResult = raySegmentIntersection(mStart, mEnd, tStart, tEnd);
  // Try extending start point (reverse direction)
  const startResult = raySegmentIntersection(mEnd, mStart, tStart, tEnd);

  // Pick the one that actually extends (t > 1 means beyond the segment)
  if (endResult && endResult.t > 1) {
    member.end.x = endResult.point.x;
    member.end.y = endResult.point.y;
    return true;
  }

  if (startResult && startResult.t > 1) {
    member.start.x = startResult.point.x;
    member.start.y = startResult.point.y;
    return true;
  }

  return false;
}

/**
 * Fillet (clean intersection) — find where two walls meet and trim both to the intersection point.
 * This is the MVP "clean intersection" approach.
 */
export function filletWalls(
  data: ProjectData,
  wallId1: string,
  wallId2: string,
  _radius: number = 0,
): boolean {
  const wall1 = data.members.find((m) => m.id === wallId1);
  const wall2 = data.members.find((m) => m.id === wallId2);
  if (!wall1 || !wall2 || !isLinearMember(wall1) || !isLinearMember(wall2)) return false;

  const s1 = getMember2DStart(wall1);
  const e1 = getMember2DEnd(wall1);
  const s2 = getMember2DStart(wall2);
  const e2 = getMember2DEnd(wall2);

  // Find intersection using line-line (extend both lines infinitely)
  const dax = e1.x - s1.x;
  const day = e1.y - s1.y;
  const dbx = e2.x - s2.x;
  const dby = e2.y - s2.y;

  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-10) return false; // parallel

  const t = ((s2.x - s1.x) * dby - (s2.y - s1.y) * dbx) / denom;
  const intersection: Point2D = {
    x: s1.x + t * dax,
    y: s1.y + t * day,
  };

  // For wall1: adjust the closest endpoint to the intersection
  const dist1Start = Math.hypot(intersection.x - s1.x, intersection.y - s1.y);
  const dist1End = Math.hypot(intersection.x - e1.x, intersection.y - e1.y);
  if (dist1Start < dist1End) {
    wall1.start.x = intersection.x;
    wall1.start.y = intersection.y;
  } else {
    wall1.end.x = intersection.x;
    wall1.end.y = intersection.y;
  }

  // For wall2: adjust the closest endpoint to the intersection
  const dist2Start = Math.hypot(intersection.x - s2.x, intersection.y - s2.y);
  const dist2End = Math.hypot(intersection.x - e2.x, intersection.y - e2.y);
  if (dist2Start < dist2End) {
    wall2.start.x = intersection.x;
    wall2.start.y = intersection.y;
  } else {
    wall2.end.x = intersection.x;
    wall2.end.y = intersection.y;
  }

  return true;
}
