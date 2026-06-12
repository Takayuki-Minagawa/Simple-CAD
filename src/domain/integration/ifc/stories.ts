import type { Story } from '@/domain/structural/types';
import { resolveIfcElement, resolveLocalPlacement } from './resolve';
import { asNumber, asRef, asRefList, asString } from './step';
import type { IfcStoryInfo, ResolvedSolid, StepEntity } from './types';

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
  return [...entities.values()]
    .filter((entity) => entity.type === 'IFCBUILDINGSTOREY')
    .map((entity, index) => {
      const name = asString(entity.args[2]) ?? `Story ${index + 1}`;
      const placement = resolveLocalPlacement(entities, asRef(entity.args[5]));
      const elevation = asNumber(entity.args[9]) ?? placement.origin.z;
      return {
        id: sanitizeId(name, index + 1),
        name,
        elevation,
      };
    })
    .sort((a, b) => a.elevation - b.elevation);
}

export function buildStoryHeights(
  rawStories: IfcStoryInfo[],
  elements: StepEntity[],
  membership: Map<number, number>,
  entities: Map<number, StepEntity>,
): Story[] {
  const sorted = [...rawStories].sort((a, b) => a.elevation - b.elevation);
  const result: Story[] = [];

  for (let index = 0; index < sorted.length; index++) {
    const story = sorted[index];
    const next = sorted[index + 1];
    let top = story.elevation + 3000;
    for (const element of elements) {
      const storyRef = membership.get(element.id);
      if (storyRef) {
        const entity = entities.get(storyRef);
        if (entity && (asString(entity.args[2]) ?? '') !== story.name) continue;
      }
      const resolved = resolveIfcElement(element, entities);
      if (!resolved) continue;
      top = Math.max(top, resolved.transform.origin.z + resolved.depth);
    }

    result.push({
      id: story.id,
      name: story.name,
      elevation: story.elevation,
      height: Math.max((next?.elevation ?? top) - story.elevation, 1000),
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
): string | null {
  const storyRef = membership.get(elementId);
  if (storyRef) {
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
