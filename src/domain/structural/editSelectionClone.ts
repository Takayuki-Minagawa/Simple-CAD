import type { Point2D } from '@/domain/geometry/types';
import { collectAllIds, generateId, prefixFor } from '@/domain/idGenerator';
import { deepClone } from '@/libs/clone';
import type { Opening, ProjectData } from './types';
import {
  transformAnnotation,
  transformDimension,
  transformMember,
  transformOpening,
} from './editTransformApply';

export function cloneSelectionWithTransform(
  data: ProjectData,
  ids: string[],
  pointTransform: (point: Point2D) => Point2D,
  usedIds = collectAllIds(data),
): string[] {
  const selectedIds = new Set(ids);
  const selectedMembers = data.members.filter((member) => selectedIds.has(member.id));
  const selectedAnnotations = data.annotations.filter((annotation) =>
    selectedIds.has(annotation.id),
  );
  const selectedDimensions = data.dimensions.filter((dimension) => selectedIds.has(dimension.id));
  const openingsByMember = collectSelectedOpenings(data.openings, selectedIds);
  const createdIds: string[] = [];
  const memberIdMap = new Map<string, string>();

  for (const member of selectedMembers) {
    const clone = deepClone(member);
    clone.id = generateId(prefixFor(member.type), usedIds);
    transformMember(clone, pointTransform);
    memberIdMap.set(member.id, clone.id);
    data.members.push(clone);
    createdIds.push(clone.id);
  }

  for (const annotation of selectedAnnotations) {
    const clone = deepClone(annotation);
    clone.id = generateId(annotation.type === 'spline' ? 'spl' : 'ann', usedIds);
    transformAnnotation(clone, pointTransform);
    data.annotations.push(clone);
    createdIds.push(clone.id);
  }

  for (const dimension of selectedDimensions) {
    const clone = deepClone(dimension);
    clone.id = generateId('dim', usedIds);
    if (clone.refMemberIds?.length) {
      clone.refMemberIds = clone.refMemberIds.map(
        (memberId) => memberIdMap.get(memberId) ?? memberId,
      );
    }
    transformDimension(clone, pointTransform);
    data.dimensions.push(clone);
    createdIds.push(clone.id);
  }

  for (const [memberId, openings] of openingsByMember) {
    const clonedMemberId = memberIdMap.get(memberId);
    if (!clonedMemberId) continue;
    for (const opening of openings) {
      const clone = deepClone(opening);
      clone.id = generateId('opn', usedIds);
      clone.memberId = clonedMemberId;
      transformOpening(clone, pointTransform);
      data.openings.push(clone);
    }
  }

  return createdIds;
}

function collectSelectedOpenings(
  openings: Opening[],
  selectedIds: Set<string>,
): Map<string, Opening[]> {
  const openingsByMember = new Map<string, Opening[]>();
  for (const opening of openings) {
    if (!selectedIds.has(opening.memberId)) continue;
    const list = openingsByMember.get(opening.memberId) ?? [];
    list.push(opening);
    openingsByMember.set(opening.memberId, list);
  }
  return openingsByMember;
}
