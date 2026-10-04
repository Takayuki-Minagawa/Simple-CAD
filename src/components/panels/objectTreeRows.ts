import type { ProjectData } from '@/domain/structural/types';
import type { LayerName } from '@/app/store/editorStore';

export const OBJECT_TYPES = [
  'column', 'beam', 'wall', 'slab', 'annotation', 'dimension', 'opening', 'construction',
] as const;
export type ObjectType = typeof OBJECT_TYPES[number];

interface ObjectTreeRow {
  id: string;
  type: ObjectType;
  story: string;
  layer: LayerName;
  label: string;
  searchText: string;
}

/** Resolve references once so searching and rendering never scan the project per row. */
export function buildObjectTreeRows(data: ProjectData): ObjectTreeRow[] {
  const rows: ObjectTreeRow[] = [];
  const membersById = new Map(data.members.map((member) => [member.id, member]));
  const materialsById = new Map(data.materials.map((material) => [material.id, material]));
  const sectionsById = new Map(data.sections.map((section) => [section.id, section]));
  function add(id: string, type: ObjectType, story: string, layer: LayerName, label: string, extra = '') {
    rows.push({ id, type, story, layer, label, searchText: `${label} ${extra}`.toLocaleLowerCase() });
  }

  for (const member of data.members) {
    add(member.id, member.type, member.story, `member-${member.type}`, member.id, [
      member.sectionId,
      sectionsById.get(member.sectionId)?.kind,
      member.materialId,
      materialsById.get(member.materialId)?.name,
      ...(member.tags ?? []),
    ].join(' '));
  }
  for (const annotation of data.annotations) {
    add(annotation.id, 'annotation', annotation.story, 'annotation', `${annotation.id}: ${annotation.text}`);
  }
  for (const dimension of data.dimensions) {
    add(dimension.id, 'dimension', dimension.story, 'dimension',
      dimension.text ? `${dimension.id}: ${dimension.text}` : dimension.id);
  }
  for (const opening of data.openings) {
    const host = membersById.get(opening.memberId);
    if (host) add(opening.id, 'opening', host.story, 'opening', `${opening.id}: ${opening.type}`, host.id);
  }
  for (const line of data.constructionLines ?? []) {
    add(line.id, 'construction', line.story, 'construction', line.id, line.type);
  }
  return rows;
}
