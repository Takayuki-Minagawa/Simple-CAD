import type { Story } from '@/domain/structural/types';
import { resolveIfcElement, resolveLocalPlacement } from './resolve';
import { asNumber, asRef, asRefList, asString } from './step';
import type { IfcStoryInfo, ResolvedSolid, StepEntity } from './types';
import { resolvedSolidZExtents } from './geometry';

export function resolveStoryMembership(entities: Map<number, StepEntity>): Map<number, number> {
  const membership = new Map<number, number>();
  for (const entity of entities.values()) {
    if (entity.type !== 'IFCRELCONTAINEDINSPATIALSTRUCTURE') continue;
    const related = asRefList(entity.args[4]);
    const storyRef = asRef(entity.args[5]);
    if (!storyRef) continue;
    for (const ref of related) {
      membership.set(ref, storyRef);
    }
  }
  return membership;
}

export function collectIfcStories(entities: Map<number, StepEntity>): IfcStoryInfo[] {
  const usedIds = new Set<string>();
  return [...entities.values()]
    .filter((entity) => entity.type === 'IFCBUILDINGSTOREY')
    .map((entity, index) => {
      const name = asString(entity.args[2]) ?? `Story ${index + 1}`;
      const placement = resolveLocalPlacement(entities, asRef(entity.args[5]));
      const elevation = asNumber(entity.args[9]) ?? placement.origin.z;
      return {
        id: reserveStoryId(sanitizeId(name, index + 1), usedIds),
        name,
        elevation,
        sourceEntityId: entity.id,
      };
    })
    .sort((a, b) => a.elevation - b.elevation);
}

function reserveStoryId(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix++;
  const id = `${base}-${suffix}`;
  used.add(id);
  return id;
}

export function buildStoryHeights(
  rawStories: IfcStoryInfo[],
  elements: StepEntity[],
  membership: Map<number, number>,
  entities: Map<number, StepEntity>,
  // Source length unit → mm. Elevations/solid extents are scaled into mm here so
  // the hardcoded mm fallbacks (3000 default storey, 1000 floor) stay correct for
  // non-mm IFC files (3-3). Defaults to 1 (already-mm) for backward compatibility.
  unitScale = 1,
): Story[] {
  const sorted = [...rawStories].sort((a, b) => a.elevation - b.elevation);
  const result: Story[] = [];

  for (let index = 0; index < sorted.length; index++) {
    const story = sorted[index];
    const next = sorted[index + 1];
    const elevationMm = story.elevation * unitScale;
    const nextElevationMm = next ? next.elevation * unitScale : undefined;
    let top = elevationMm + 3000;
    for (const element of elements) {
      const storyRef = membership.get(element.id);
      if (storyRef) {
        if (story.sourceEntityId !== undefined) {
          if (storyRef !== story.sourceEntityId) continue;
        } else {
          const entity = entities.get(storyRef);
          if (entity && (asString(entity.args[2]) ?? '') !== story.name) continue;
        }
      }
      const resolved = resolveIfcElement(element, entities);
      if (!resolved) continue;
      if (!storyRef) {
        const sourceZ = resolved.transform.origin.z;
        if (sourceZ < story.elevation || (next && sourceZ >= next.elevation)) continue;
      }
      top = Math.max(top, resolvedSolidZExtents(resolved).max * unitScale);
    }

    result.push({
      id: story.id,
      name: story.name,
      elevation: elevationMm,
      height: Math.max((nextElevationMm ?? top) - elevationMm, 1000),
    });
  }

  return result;
}

export function resolveElementStoryId(
  elementId: number,
  stories: Story[],
  membership: Map<number, number>,
  resolved: ResolvedSolid,
  entities: Map<number, StepEntity>,
  storyIdByEntityRef?: Map<number, string>,
): string | null {
  const storyRef = membership.get(elementId);
  if (storyRef) {
    const directId = storyIdByEntityRef?.get(storyRef);
    if (directId && stories.some((story) => story.id === directId)) return directId;
    const storyEntity = entities.get(storyRef);
    const storyName = storyEntity ? asString(storyEntity.args[2]) : null;
    const story = stories.find((item) => item.name === storyName);
    if (story) return story.id;
  }

  const z = resolved.transform.origin.z;
  const matching = [...stories]
    .sort((a, b) => a.elevation - b.elevation)
    .findLast((story) => z >= story.elevation);
  return matching?.id ?? stories[0]?.id ?? null;
}

function sanitizeId(name: string, index: number): string {
  const value = name.replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return value || `STORY-${index}`;
}
