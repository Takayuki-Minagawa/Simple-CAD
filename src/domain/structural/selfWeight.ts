import { polygonArea } from '@/domain/geometry/measurement';
import { quantize } from '@/domain/geometry/precision';
import type {
  LinearMember,
  Material,
  Member,
  Section,
  SlabMember,
} from './types';
import { isLinearMember } from './types';

/**
 * Self-weight / dead-load auto-computation (2-7).
 *
 * Pure functions: given materials, sections and members they derive member
 * self-weight from the material unit weight and the section geometry.
 *
 * ── Units ──────────────────────────────────────────────────────────────────
 * All stored project geometry is in **mm** (`ProjectMeta.unit = 'mm'`).
 * Material `unitWeight` is in **kN/m³** (see `Material.unitWeight`).
 *
 * To keep everything dimensionally consistent we convert to SI-ish units:
 *   - section cross-sectional area:  mm² → m²  (÷ 1e6)
 *   - member length / slab thickness: mm → m   (÷ 1e3)
 *   - polygon area:                  mm² → m²  (÷ 1e6)
 *
 * Results:
 *   - linear member distributed self-weight:  kN/m  = unitWeight[kN/m³] · area[m²]
 *   - linear member total self-weight:         kN    = w[kN/m] · length[m]
 *   - slab area self-weight:                   kN/m² = unitWeight[kN/m³] · t[m]
 *   - slab total self-weight:                  kN    = q[kN/m²] · area[m²]
 */

const MM2_PER_M2 = 1e6;
const MM_PER_M = 1e3;

/** Default decimal rounding (via precision.quantize) for derived load values. */
const LOAD_PRECISION = 1e-6;

const round = (value: number): number => quantize(value, LOAD_PRECISION);

/**
 * Cross-sectional area of a section in **mm²**.
 *
 * Returns `undefined` for area-type sections (slab/wall) whose self-weight is
 * driven by thickness × tributary area rather than a cross-sectional area.
 *
 * Section kinds:
 *   - rect (rc_column_rect / rc_beam_rect):  A = w · d
 *   - H-shape (s_column_h / s_beam_h):       A = 2·B·tf + (H − 2·tf)·tw
 *       (when tw/tf are present; otherwise a thin-walled approximation using a
 *        nominal 10mm plate so a rough value is still produced)
 *   - pipe (s_pipe):                         A = π/4 · (D² − (D − 2t)²)
 */
export function sectionAreaMm2(section: Section): number | undefined {
  switch (section.kind) {
    case 'rc_column_rect':
    case 'rc_beam_rect':
      return section.width * section.depth;
    case 's_column_h':
    case 's_beam_h': {
      const B = section.width;
      const H = section.depth;
      if (section.tw !== undefined && section.tf !== undefined) {
        const tf = section.tf;
        const tw = section.tw;
        return 2 * B * tf + Math.max(H - 2 * tf, 0) * tw;
      }
      // No plate thicknesses supplied: approximate with a nominal 10mm plate so
      // self-weight is non-zero rather than silently dropping the member.
      const t = 10;
      return 2 * B * t + Math.max(H - 2 * t, 0) * t;
    }
    case 's_pipe': {
      const D = section.diameter;
      const inner = Math.max(D - 2 * section.thickness, 0);
      return (Math.PI / 4) * (D * D - inner * inner);
    }
    case 'rc_slab':
    case 'rc_wall':
      // Area-type sections: handled by thickness × area, not cross-section area.
      return undefined;
  }
}

/**
 * Distributed self-weight of a linear member in **kN/m**.
 *
 * = material.unitWeight[kN/m³] · sectionArea[m²]
 *
 * Returns `undefined` when the unit weight or a usable cross-sectional area is
 * unavailable (so callers can skip rather than emit a misleading zero).
 */
export function linearSelfWeightPerLength(
  section: Section | undefined,
  material: Material | undefined,
): number | undefined {
  if (!material || material.unitWeight === undefined) return undefined;
  if (!section) return undefined;
  const areaMm2 = sectionAreaMm2(section);
  if (areaMm2 === undefined) return undefined;
  const areaM2 = areaMm2 / MM2_PER_M2;
  return round(material.unitWeight * areaM2);
}

/** Length of a linear member in **mm** (3D Euclidean start→end). */
export function linearMemberLengthMm(member: LinearMember): number {
  const dx = member.end.x - member.start.x;
  const dy = member.end.y - member.start.y;
  const dz = member.end.z - member.start.z;
  return Math.hypot(dx, dy, dz);
}

/**
 * Area (uniform) self-weight of a slab in **kN/m²**.
 *
 * = material.unitWeight[kN/m³] · thickness[m]
 *
 * Returns `undefined` when unit weight is missing.
 */
export function slabSelfWeightPerArea(
  thicknessMm: number,
  material: Material | undefined,
): number | undefined {
  if (!material || material.unitWeight === undefined) return undefined;
  return round(material.unitWeight * (thicknessMm / MM_PER_M));
}

/** Tributary plan area of a slab in **mm²** (shoelace, always positive). */
export function slabAreaMm2(member: SlabMember): number {
  return polygonArea(member.polygon);
}

export interface MemberSelfWeight {
  memberId: string;
  memberType: Member['type'];
  /** 'distributed' for linear members (kN/m), 'area' for slabs (kN/m²). */
  kind: 'distributed' | 'area';
  /** Distributed value: kN/m for linear members, kN/m² for slabs. */
  intensity: number;
  /** Total self-weight of the member in kN. */
  total: number;
}

/**
 * Compute the self-weight of a single member.
 *
 * Returns `undefined` when the inputs needed for a meaningful value are missing
 * (no unit weight, no resolvable section/area). Walls are treated as area-type
 * (thickness × elevation panel) like slabs.
 */
export function computeMemberSelfWeight(
  member: Member,
  section: Section | undefined,
  material: Material | undefined,
): MemberSelfWeight | undefined {
  if (member.type === 'slab') {
    const thickness = section && 'thickness' in section ? section.thickness : undefined;
    if (thickness === undefined) return undefined;
    const intensity = slabSelfWeightPerArea(thickness, material);
    if (intensity === undefined) return undefined;
    const areaM2 = slabAreaMm2(member) / MM2_PER_M2;
    return {
      memberId: member.id,
      memberType: 'slab',
      kind: 'area',
      intensity,
      total: round(intensity * areaM2),
    };
  }

  if (member.type === 'wall') {
    // Wall self-weight: unitWeight · thickness[m] gives a kN/m² panel load;
    // total = q · (length · height) panel area.
    const thickness =
      section && 'thickness' in section ? section.thickness : member.thickness;
    const intensity = slabSelfWeightPerArea(thickness, material);
    if (intensity === undefined) return undefined;
    const lengthM = linearMemberLengthMm(member) / MM_PER_M;
    const heightM = member.height / MM_PER_M;
    return {
      memberId: member.id,
      memberType: 'wall',
      kind: 'area',
      intensity,
      total: round(intensity * lengthM * heightM),
    };
  }

  // column / beam: distributed load along the member.
  if (!isLinearMember(member)) return undefined;
  const w = linearSelfWeightPerLength(section, material);
  if (w === undefined) return undefined;
  const lengthM = linearMemberLengthMm(member) / MM_PER_M;
  return {
    memberId: member.id,
    memberType: member.type,
    kind: 'distributed',
    intensity: w,
    total: round(w * lengthM),
  };
}

/**
 * Compute self-weight for every member in the project that has enough data.
 *
 * Members missing a unit weight or a resolvable section are skipped (not
 * emitted) so the result never contains misleading zero loads.
 */
export function computeSelfWeights(
  members: readonly Member[],
  sections: readonly Section[],
  materials: readonly Material[],
): MemberSelfWeight[] {
  const sectionMap = new Map(sections.map((s) => [s.id, s] as const));
  const materialMap = new Map(materials.map((m) => [m.id, m] as const));
  const result: MemberSelfWeight[] = [];
  for (const member of members) {
    const sw = computeMemberSelfWeight(
      member,
      sectionMap.get(member.sectionId),
      materialMap.get(member.materialId),
    );
    if (sw) result.push(sw);
  }
  return result;
}
