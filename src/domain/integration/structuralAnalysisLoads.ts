import type { Material, ProjectData } from '@/domain/structural/types';
import { computeMemberSelfWeight } from '@/domain/structural/selfWeight';

/**
 * Self-weight / superimposed loads derived for a member (2-7). All values are
 * additive and optional so the analysis model stays backward-compatible.
 */
export interface StructuralAnalysisMemberLoad {
  memberId: string;
  memberType: 'column' | 'beam' | 'wall' | 'slab';
  /** 'distributed' = kN/m along a linear member; 'area' = kN/m2 over a slab/wall. */
  kind: 'distributed' | 'area';
  /** Load case this contribution belongs to (self-weight is a dead case). */
  loadType: 'dead' | 'live';
  /** Source of the load (self-weight vs. superimposed dead/live). */
  source: 'selfWeight' | 'superimposedDead' | 'live';
  /** Distributed intensity: kN/m for linear members, kN/m2 for areas. */
  intensity: number;
  /** Total load over the member in kN (when computable). */
  total?: number;
}

export interface StructuralAnalysisLoads {
  /** Per-member self-weight (auto-computed from material unit weight x section). */
  selfWeight: StructuralAnalysisMemberLoad[];
  /** Slab/floor superimposed dead + live area loads (from slab section or story). */
  areaLoads: StructuralAnalysisMemberLoad[];
}

/**
 * Derive the optional `loads` section:
 * - per-member self-weight from material unit weight x section,
 * - slab superimposed dead + live area loads (slab section overrides story),
 * - wall self-weight as a panel area load.
 */
export function computeStructuralAnalysisLoads(
  data: ProjectData,
  materialMap: Map<string, Material>,
): StructuralAnalysisLoads | undefined {
  const sectionMap = new Map(data.sections.map((section) => [section.id, section] as const));
  const storyMap = new Map(data.stories.map((story) => [story.id, story] as const));
  const selfWeight: StructuralAnalysisMemberLoad[] = [];
  const areaLoads: StructuralAnalysisMemberLoad[] = [];

  for (const member of data.members) {
    const section = sectionMap.get(member.sectionId);
    const material = materialMap.get(member.materialId);

    const selfWeightLoad = computeMemberSelfWeight(member, section, material);
    if (selfWeightLoad) {
      selfWeight.push({
        memberId: selfWeightLoad.memberId,
        memberType: selfWeightLoad.memberType,
        kind: selfWeightLoad.kind,
        loadType: 'dead',
        source: 'selfWeight',
        intensity: selfWeightLoad.intensity,
        total: selfWeightLoad.total,
      });
    }

    if (member.type !== 'slab') continue;

    const story = storyMap.get(member.story);
    const slabDead = section && 'deadLoad' in section ? section.deadLoad : undefined;
    const slabLive = section && 'liveLoad' in section ? section.liveLoad : undefined;
    const dead = slabDead ?? story?.deadLoad;
    const live = slabLive ?? story?.liveLoad;

    if (dead !== undefined) {
      areaLoads.push({
        memberId: member.id,
        memberType: 'slab',
        kind: 'area',
        loadType: 'dead',
        source: 'superimposedDead',
        intensity: dead,
      });
    }
    if (live !== undefined) {
      areaLoads.push({
        memberId: member.id,
        memberType: 'slab',
        kind: 'area',
        loadType: 'live',
        source: 'live',
        intensity: live,
      });
    }
  }

  if (selfWeight.length === 0 && areaLoads.length === 0) return undefined;
  return { selfWeight, areaLoads };
}
