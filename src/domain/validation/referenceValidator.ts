import type { ProjectData } from '@/domain/structural/types';
import type { ValidationError, ValidationResult } from './types';

export function validateReferences(data: ProjectData): ValidationResult {
  const errors: ValidationError[] = [];

  const storyIds = new Set(data.stories.map((s) => s.id));
  const sectionIds = new Set(data.sections.map((s) => s.id));
  const materialIds = new Set(data.materials.map((m) => m.id));
  const memberIds = new Set(data.members.map((m) => m.id));
  const viewIds = new Set(data.views.map((v) => v.id));

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

  // Members → story, section, material
  for (const m of data.members) {
    if (!storyIds.has(m.story)) {
      errors.push({
        level: 'error',
        message: `Member "${m.id}": story "${m.story}" が未定義`,
        path: `/members/${m.id}`,
      });
    }
    if (!sectionIds.has(m.sectionId)) {
      errors.push({
        level: 'error',
        message: `Member "${m.id}": sectionId "${m.sectionId}" が未定義`,
        path: `/members/${m.id}`,
      });
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

  // Sheets → views
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
  }

  return { ok: errors.length === 0, errors };
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
