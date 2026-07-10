import type { ProjectData } from '@/domain/structural/types';

/**
 * Determine if an entity's layer is locked.
 */
export function isLayerLockedForEntity(
  entityKind: 'member' | 'annotation' | 'dimension',
  memberType: string | undefined,
  layerLocked: Record<string, boolean>,
): boolean {
  if (entityKind === 'annotation') return !!layerLocked['annotation'];
  if (entityKind === 'dimension') return !!layerLocked['dimension'];
  if (entityKind === 'member' && memberType) {
    return !!layerLocked[`member-${memberType}`];
  }
  return false;
}

/**
 * Get layer name for a member type.
 */
export function memberTypeToLayerName(memberType: string): string {
  return `member-${memberType}`;
}

/** Resolve the editor layer that owns a selectable entity ID. */
export function entityLayerForId(data: ProjectData, id: string): string | undefined {
  const member = data.members.find((candidate) => candidate.id === id);
  if (member) return memberTypeToLayerName(member.type);
  if (data.openings.some((candidate) => candidate.id === id)) return 'opening';
  if (data.annotations.some((candidate) => candidate.id === id)) return 'annotation';
  if (data.dimensions.some((candidate) => candidate.id === id)) return 'dimension';
  if (data.constructionLines?.some((candidate) => candidate.id === id)) return 'construction';
  return undefined;
}

/** Locked or hidden layers cannot be selected or edited through canvas handles. */
export function isEntityLayerInteractive(
  data: ProjectData,
  id: string,
  layerLocked: Record<string, boolean>,
  layerVisibility?: Record<string, boolean>,
): boolean {
  const layer = entityLayerForId(data, id);
  if (!layer) return true;
  return !layerLocked[layer] && layerVisibility?.[layer] !== false;
}
