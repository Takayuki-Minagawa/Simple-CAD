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
  const viewportIds = new Set(
    data.sheets.flatMap((item) => item.viewports?.map((viewport) => viewport.id) ?? []),
  );
  const supportIds = new Set(data.supports?.map((item) => item.id) ?? []);
  const nodalLoadIds = new Set(data.nodalLoads?.map((item) => item.id) ?? []);
  const memberLoadIds = new Set(data.memberLoads?.map((item) => item.id) ?? []);
  const areaLoadIds = new Set(data.areaLoads?.map((item) => item.id) ?? []);
  const massIds = new Set(data.masses?.map((item) => item.id) ?? []);
  const diaphragmIds = new Set(data.diaphragms?.map((item) => item.id) ?? []);

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

  if (data.supports) {
    for (const support of data.supports.filter((item) => item.storyId === sourceId)) {
      const clone = deepClone(support);
      clone.id = ensureUniqueId(
        supportIds,
        replaceStoryScopedText(support.id, sourceId, nextStoryId),
      );
      supportIds.add(clone.id);
      clone.storyId = nextStoryId;
      clone.position.z += elevationDelta;
      data.supports.push(clone);
    }
  }

  if (data.nodalLoads) {
    for (const load of data.nodalLoads.filter((item) => item.storyId === sourceId)) {
      const clone = deepClone(load);
      clone.id = ensureUniqueId(
        nodalLoadIds,
        replaceStoryScopedText(load.id, sourceId, nextStoryId),
      );
      nodalLoadIds.add(clone.id);
      clone.storyId = nextStoryId;
      clone.position.z += elevationDelta;
      data.nodalLoads.push(clone);
    }
  }

  if (data.memberLoads) {
    for (const load of data.memberLoads.filter((item) => memberIdMap.has(item.memberId))) {
      const clone = deepClone(load);
      clone.id = ensureUniqueId(
        memberLoadIds,
        replaceStoryScopedText(load.id, sourceId, nextStoryId),
      );
      memberLoadIds.add(clone.id);
      clone.memberId = memberIdMap.get(load.memberId) ?? load.memberId;
      data.memberLoads.push(clone);
    }
  }

  if (data.areaLoads) {
    for (const load of data.areaLoads.filter((item) => memberIdMap.has(item.memberId))) {
      const clone = deepClone(load);
      clone.id = ensureUniqueId(
        areaLoadIds,
        replaceStoryScopedText(load.id, sourceId, nextStoryId),
      );
      areaLoadIds.add(clone.id);
      clone.memberId = memberIdMap.get(load.memberId) ?? load.memberId;
      data.areaLoads.push(clone);
    }
  }

  if (data.masses) {
    for (const mass of data.masses.filter((item) => item.storyId === sourceId)) {
      const clone = deepClone(mass);
      clone.id = ensureUniqueId(
        massIds,
        replaceStoryScopedText(mass.id, sourceId, nextStoryId),
      );
      massIds.add(clone.id);
      clone.storyId = nextStoryId;
      clone.position.z += elevationDelta;
      data.masses.push(clone);
    }
  }

  if (data.diaphragms) {
    for (const diaphragm of data.diaphragms.filter((item) => item.storyId === sourceId)) {
      const clone = deepClone(diaphragm);
      clone.id = ensureUniqueId(
        diaphragmIds,
        replaceStoryScopedText(diaphragm.id, sourceId, nextStoryId),
      );
      diaphragmIds.add(clone.id);
      clone.storyId = nextStoryId;
      clone.memberIds = clone.memberIds?.map((memberId) => memberIdMap.get(memberId) ?? memberId);
      if (clone.masterPosition) clone.masterPosition.z += elevationDelta;
      data.diaphragms.push(clone);
    }
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
    if (clone.refMemberIds) {
      clone.refMemberIds = clone.refMemberIds.map(
        (memberId) => memberIdMap.get(memberId) ?? memberId,
      );
    }
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

  for (const sheet of data.sheets.filter(
    (item) =>
      item.viewIds.some((viewId) => viewIdMap.has(viewId)) ||
      item.viewports?.some((viewport) => viewIdMap.has(viewport.viewId)),
  )) {
    const clone = deepClone(sheet);
    const preferredId = replaceStoryScopedText(sheet.id, sourceId, nextStoryId);
    clone.id = ensureUniqueId(sheetIds, preferredId);
    sheetIds.add(clone.id);
    clone.name = replaceStoryLabel(sheet.name, sourceStory.name, nextStory.name);
    clone.viewIds = sheet.viewIds.map((viewId) => viewIdMap.get(viewId) ?? viewId);
    if (clone.viewports) {
      clone.viewports = clone.viewports.map((viewport) => {
        const preferredViewportId = replaceStoryScopedText(
          viewport.id,
          sourceId,
          nextStoryId,
        );
        const viewportId = ensureUniqueId(viewportIds, preferredViewportId);
        viewportIds.add(viewportId);
        return {
          ...viewport,
          id: viewportId,
          sheetId: clone.id,
          viewId: viewIdMap.get(viewport.viewId) ?? viewport.viewId,
        };
      });
    }
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
