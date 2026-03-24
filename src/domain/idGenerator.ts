import type { ProjectData } from './structural/types';

const TYPE_PREFIX: Record<string, string> = {
  column: 'col',
  beam: 'beam',
  wall: 'wall',
  slab: 'slab',
};

/** Map member/element type to a short prefix for ID generation */
export function prefixFor(type: string): string {
  return TYPE_PREFIX[type] ?? type;
}

/** Collect all element IDs from a ProjectData into a Set */
export function collectAllIds(data: ProjectData): Set<string> {
  const ids = new Set<string>();
  for (const m of data.members) ids.add(m.id);
  for (const a of data.annotations) ids.add(a.id);
  for (const d of data.dimensions) ids.add(d.id);
  for (const o of data.openings) ids.add(o.id);
  if (data.groups) for (const g of data.groups) ids.add(g.id);
  if (data.constructionLines) for (const c of data.constructionLines) ids.add(c.id);
  return ids;
}

/**
 * Generate a short, readable, unique ID like `col-001`, `beam-012`.
 * The generated ID is automatically added to `usedIds` to prevent collisions
 * in successive calls.
 */
export function generateId(prefix: string, usedIds: Set<string>): string {
  let num = 1;
  let id = `${prefix}-${String(num).padStart(3, '0')}`;
  while (usedIds.has(id)) {
    num++;
    id = `${prefix}-${String(num).padStart(3, '0')}`;
  }
  usedIds.add(id);
  return id;
}
