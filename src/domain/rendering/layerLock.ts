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
