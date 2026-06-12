import type { ProjectData, Story } from '@/domain/structural/types';
import { deepClone } from '@/libs/clone';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function ensureUniqueId(existingIds: Set<string>, preferred: string): string {
  if (!existingIds.has(preferred)) return preferred;
  let index = 2;
  let candidate = `${preferred}-${index}`;
  while (existingIds.has(candidate)) {
    index++;
    candidate = `${preferred}-${index}`;
  }
  return candidate;
}

function replaceStoryScopedText(value: string, source: string, target: string): string {
  if (!value) return value;
  const pattern = new RegExp(escapeRegExp(source), 'g');
  const replaced = value.replace(pattern, target);
  return replaced === value ? `${value}-${target}` : replaced;
}

function replaceStoryLabel(value: string, sourceLabel: string, targetLabel: string): string {
  if (!value) return targetLabel;
  const pattern = new RegExp(escapeRegExp(sourceLabel), 'g');
  const replaced = value.replace(pattern, targetLabel);
  return replaced === value ? `${value} ${targetLabel}` : replaced;
}

export function duplicateStoryInProject(data: ProjectData, sourceId: string, story: Story): string | null {
  const sourceStory = data.stories.find((item) => item.id === sourceId);
  if (!sourceStory) return null;

  const storyIds = new Set(data.stories.map((item) => item.id));
  const nextStoryId = ensureUniqueId(storyIds, story.id);
  const elevationDelta = story.elevation - sourceStory.elevation;
  const nextStory: Story = { ...story, id: nextStoryId };
  data.stories.push(nextStory);

  const memberIds = new Set(data.members.map((item) => item.id));
  const openingIds = new Set(data.openings.map((item) => item.id));
  const annotationIds = new Set(data.annotations.map((item) => item.id));
  const dimensionIds = new Set(data.dimensions.map((item) => item.id));
  const viewIds = new Set(data.views.map((item) => item.id));
  const sheetIds = new Set(data.sheets.map((item) => item.id));

  const memberIdMap = new Map<string, string>();
  for (const member of data.members.filter((item) => item.story === sourceId)) {
    const clone = deepClone(member);
    const preferredId = replaceStoryScopedText(member.id, sourceId, nextStoryId);
    clone.id = ensureUniqueId(memberIds, preferredId);
    memberIds.add(clone.id);
    clone.story = nextStoryId;
    if (clone.type === 'slab') {
      clone.level += elevationDelta;
    } else {
      clone.start.z += elevationDelta;
      clone.end.z += elevationDelta;
    }
    memberIdMap.set(member.id, clone.id);
    data.members.push(clone);
  }

  for (const opening of data.openings.filter((item) => memberIdMap.has(item.memberId))) {
    const clone = deepClone(opening);
    const preferredId = replaceStoryScopedText(opening.id, sourceId, nextStoryId);
    clone.id = ensureUniqueId(openingIds, preferredId);
    openingIds.add(clone.id);
    clone.memberId = memberIdMap.get(opening.memberId) ?? opening.memberId;
    clone.position.z += elevationDelta;
    data.openings.push(clone);
  }

  for (const annotation of data.annotations.filter((item) => item.story === sourceId)) {
    const clone = deepClone(annotation);
    const preferredId = replaceStoryScopedText(annotation.id, sourceId, nextStoryId);
    clone.id = ensureUniqueId(annotationIds, preferredId);
    annotationIds.add(clone.id);
    clone.story = nextStoryId;
    data.annotations.push(clone);
  }

  for (const dimension of data.dimensions.filter((item) => item.story === sourceId)) {
    const clone = deepClone(dimension);
    const preferredId = replaceStoryScopedText(dimension.id, sourceId, nextStoryId);
    clone.id = ensureUniqueId(dimensionIds, preferredId);
    dimensionIds.add(clone.id);
    clone.story = nextStoryId;
    data.dimensions.push(clone);
  }

  const viewIdMap = new Map<string, string>();
  for (const view of data.views.filter((item) => item.story === sourceId)) {
    const clone = deepClone(view);
    const preferredId = replaceStoryScopedText(view.id, sourceId, nextStoryId);
    clone.id = ensureUniqueId(viewIds, preferredId);
    viewIds.add(clone.id);
    clone.story = nextStoryId;
    viewIdMap.set(view.id, clone.id);
    data.views.push(clone);
  }

  for (const sheet of data.sheets.filter((item) => item.viewIds.some((viewId) => viewIdMap.has(viewId)))) {
    const clone = deepClone(sheet);
    const preferredId = replaceStoryScopedText(sheet.id, sourceId, nextStoryId);
    clone.id = ensureUniqueId(sheetIds, preferredId);
    sheetIds.add(clone.id);
    clone.name = replaceStoryLabel(sheet.name, sourceStory.name, nextStory.name);
    clone.viewIds = sheet.viewIds.map((viewId) => viewIdMap.get(viewId) ?? viewId);
    if (clone.titleBlock) {
      clone.titleBlock.drawingTitle = replaceStoryLabel(
        clone.titleBlock.drawingTitle ?? clone.name,
        sourceStory.name,
        nextStory.name,
      );
    }
    data.sheets.push(clone);
  }

  return nextStoryId;
}
