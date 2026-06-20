import type { MemberType, Section, ProjectData } from '@/domain/structural/types';
import type { ValidationError, ValidationResult } from './types';

/** Section kinds each member.type may reference (joint/consistency mapping). */
const MEMBER_SECTION_KINDS: Record<MemberType, ReadonlyArray<Section['kind']>> = {
  column: ['rc_column_rect', 's_column_h', 's_pipe'],
  beam: ['rc_beam_rect', 's_beam_h', 's_pipe'],
  slab: ['rc_slab'],
  wall: ['rc_wall'],
};

export function validateReferences(data: ProjectData): ValidationResult {
  const errors: ValidationError[] = [];

  const storyIds = new Set(data.stories.map((s) => s.id));
  const sectionById = new Map(data.sections.map((s) => [s.id, s]));
  const materialIds = new Set(data.materials.map((m) => m.id));
  const memberIds = new Set(data.members.map((m) => m.id));
  const viewIds = new Set(data.views.map((v) => v.id));
  const sheetIds = new Set(data.sheets.map((s) => s.id));

  // Check ID uniqueness within each collection
  checkUniqueness(data.stories.map((s) => s.id), 'stories', errors);
  checkUniqueness(data.grids.map((g) => g.id), 'grids', errors);
  checkUniqueness(data.materials.map((m) => m.id), 'materials', errors);
  checkUniqueness(data.sections.map((s) => s.id), 'sections', errors);
  checkUniqueness(data.members.map((m) => m.id), 'members', errors);
  checkUniqueness(data.openings.map((o) => o.id), 'openings', errors);
  checkUniqueness(data.annotations.map((a) => a.id), 'annotations', errors);
  checkUniqueness(data.dimensions.map((d) => d.id), 'dimensions', errors);
  checkUniqueness(data.views.map((v) => v.id), 'views', errors);
  checkUniqueness(data.sheets.map((s) => s.id), 'sheets', errors);
  if (data.groups) {
    checkUniqueness(data.groups.map((g) => g.id), 'groups', errors);
  }
  if (data.constructionLines) {
    checkUniqueness(data.constructionLines.map((c) => c.id), 'constructionLines', errors);
  }
  if (data.externalRefs) {
    checkUniqueness(data.externalRefs.map((r) => r.id), 'externalRefs', errors);
  }

  // Members → story, section, material
  for (const m of data.members) {
    if (!storyIds.has(m.story)) {
      errors.push({
        level: 'error',
        message: `Member "${m.id}": story "${m.story}" が未定義`,
        path: `/members/${m.id}`,
      });
    }
    const section = sectionById.get(m.sectionId);
    if (!section) {
      errors.push({
        level: 'error',
        message: `Member "${m.id}": sectionId "${m.sectionId}" が未定義`,
        path: `/members/${m.id}`,
      });
    } else {
      // section.kind ↔ member.type consistency
      const allowed = MEMBER_SECTION_KINDS[m.type];
      if (!allowed.includes(section.kind)) {
        errors.push({
          level: 'error',
          message: `Member "${m.id}": ${m.type} は section.kind ${allowed.map((k) => `"${k}"`).join('/')} を要求しますが "${section.kind}" を参照`,
          path: `/members/${m.id}`,
        });
      }
    }
    if (!materialIds.has(m.materialId)) {
      errors.push({
        level: 'error',
        message: `Member "${m.id}": materialId "${m.materialId}" が未定義`,
        path: `/members/${m.id}`,
      });
    }
  }

  // Openings → member
  for (const o of data.openings) {
    if (!memberIds.has(o.memberId)) {
      errors.push({
        level: 'error',
        message: `Opening "${o.id}": memberId "${o.memberId}" が未定義`,
        path: `/openings/${o.id}`,
      });
    }
  }

  // Annotations → story
  for (const a of data.annotations) {
    if (!storyIds.has(a.story)) {
      errors.push({
        level: 'error',
        message: `Annotation "${a.id}": story "${a.story}" が未定義`,
        path: `/annotations/${a.id}`,
      });
    }
  }

  // Dimensions → story
  for (const d of data.dimensions) {
    if (!storyIds.has(d.story)) {
      errors.push({
        level: 'error',
        message: `Dimension "${d.id}": story "${d.story}" が未定義`,
        path: `/dimensions/${d.id}`,
      });
    }
  }

  // Views → story
  for (const v of data.views) {
    if (!storyIds.has(v.story)) {
      errors.push({
        level: 'error',
        message: `View "${v.id}": story "${v.story}" が未定義`,
        path: `/views/${v.id}`,
      });
    }
  }

  // Sheets → views (+ nested viewports → view / sheet)
  for (const s of data.sheets) {
    for (const vid of s.viewIds) {
      if (!viewIds.has(vid)) {
        errors.push({
          level: 'error',
          message: `Sheet "${s.id}": viewId "${vid}" が未定義`,
          path: `/sheets/${s.id}`,
        });
      }
    }
    for (const vp of s.viewports ?? []) {
      if (!viewIds.has(vp.viewId)) {
        errors.push({
          level: 'error',
          message: `Viewport "${vp.id}": viewId "${vp.viewId}" が未定義`,
          path: `/sheets/${s.id}`,
        });
      }
      if (!sheetIds.has(vp.sheetId)) {
        errors.push({
          level: 'error',
          message: `Viewport "${vp.id}": sheetId "${vp.sheetId}" が未定義`,
          path: `/sheets/${s.id}`,
        });
      }
    }
  }

  // Groups → member existence
  for (const g of data.groups ?? []) {
    for (const mid of g.memberIds) {
      if (!memberIds.has(mid)) {
        errors.push({
          level: 'error',
          message: `Group "${g.id}": memberId "${mid}" が未定義`,
          path: `/groups/${g.id}`,
        });
      }
    }
  }

  // Construction lines → story
  for (const c of data.constructionLines ?? []) {
    if (!storyIds.has(c.story)) {
      errors.push({
        level: 'error',
        message: `ConstructionLine "${c.id}": story "${c.story}" が未定義`,
        path: `/constructionLines/${c.id}`,
      });
    }
  }

  return { ok: errors.every((e) => e.level !== 'error'), errors };
}

function checkUniqueness(ids: string[], collection: string, errors: ValidationError[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push({
        level: 'error',
        message: `${collection}: id "${id}" が重複`,
        path: `/${collection}`,
      });
    }
    seen.add(id);
  }
}
