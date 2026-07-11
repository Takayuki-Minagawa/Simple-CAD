import type { MemberType, Section, ProjectData } from '@/domain/structural/types';
import type { Point3D } from '@/domain/geometry/types';
import { JOINT_MERGE_TOLERANCE, SpatialPointIndex3D } from '@/domain/geometry/precision';
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
  const memberById = new Map(data.members.map((m) => [m.id, m] as const));
  const viewIds = new Set(data.views.map((v) => v.id));
  const sheetIds = new Set(data.sheets.map((s) => s.id));
  const loadCaseIds = new Set((data.loadCases ?? []).map((loadCase) => loadCase.id));
  const combinationIds = new Set((data.loadCombinations ?? []).map((combination) => combination.id));
  const gridById = new Map(data.grids.map((grid) => [grid.id, grid] as const));
  const gridsByName = new Map<string, typeof data.grids>();
  for (const grid of data.grids) {
    gridsByName.set(grid.name, [...(gridsByName.get(grid.name) ?? []), grid]);
  }
  const analysisNodesByStory = collectAnalysisNodesByStory(data);
  const isConnectedPoint = (storyId: string, point: Point3D) =>
    analysisNodesByStory.get(storyId)?.find(point) === true;

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
  checkUniqueness((data.loadCases ?? []).map((item) => item.id), 'loadCases', errors);
  checkUniqueness((data.supports ?? []).map((item) => item.id), 'supports', errors);
  checkUniqueness((data.nodalLoads ?? []).map((item) => item.id), 'nodalLoads', errors);
  checkUniqueness((data.memberLoads ?? []).map((item) => item.id), 'memberLoads', errors);
  checkUniqueness((data.areaLoads ?? []).map((item) => item.id), 'areaLoads', errors);
  checkUniqueness((data.loadCombinations ?? []).map((item) => item.id), 'loadCombinations', errors);
  checkUniqueness((data.masses ?? []).map((item) => item.id), 'masses', errors);
  checkUniqueness((data.diaphragms ?? []).map((item) => item.id), 'diaphragms', errors);

  // Hit-testing and generic deletion expose these collections through one ID
  // namespace, so cross-collection collisions are ambiguous.
  checkUniqueness(
    [
      ...data.members.map((item) => item.id),
      ...data.openings.map((item) => item.id),
      ...data.annotations.map((item) => item.id),
      ...data.dimensions.map((item) => item.id),
      ...(data.constructionLines?.map((item) => item.id) ?? []),
    ],
    'selectableEntities',
    errors,
  );

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

    for (const [endpoint, pair] of [
      ['startGrid', m.gridRef?.startGrid],
      ['endGrid', m.gridRef?.endGrid],
    ] as const) {
      if (!pair) continue;
      const resolved = pair.map((token) => resolveGridToken(token, gridById, gridsByName));
      for (let index = 0; index < pair.length; index++) {
        if (resolved[index].status === 'missing') {
          errors.push({
            level: 'error',
            message: `Member "${m.id}": ${endpoint} のGrid "${pair[index]}" が未定義`,
            path: `/members/${m.id}/gridRef/${endpoint}`,
          });
        } else if (resolved[index].status === 'ambiguous') {
          errors.push({
            level: 'error',
            message: `Member "${m.id}": ${endpoint} のGrid名 "${pair[index]}" が重複しており曖昧`,
            path: `/members/${m.id}/gridRef/${endpoint}`,
          });
        }
      }
      const axes = resolved.flatMap((result) => (result.grid ? [result.grid.axis] : []));
      if (axes.length === 2 && new Set(axes).size !== 2) {
        errors.push({
          level: 'error',
          message: `Member "${m.id}": ${endpoint} はX軸とY軸を1本ずつ参照する必要があります`,
          path: `/members/${m.id}/gridRef/${endpoint}`,
        });
      }
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
    const host = memberById.get(o.memberId);
    if (host && host.type !== 'wall' && host.type !== 'slab') {
      errors.push({
        level: 'error',
        message: `Opening "${o.id}": ${host.type} は開口ホストにできません`,
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
    for (const memberId of d.refMemberIds ?? []) {
      if (!memberIds.has(memberId)) {
        errors.push({
          level: 'error',
          message: `Dimension "${d.id}": refMemberId "${memberId}" が未定義`,
          path: `/dimensions/${d.id}/refMemberIds`,
        });
      }
    }
    if (d.associative && (!d.refMemberIds || d.refMemberIds.length === 0)) {
      errors.push({
        level: 'error',
        message: `Dimension "${d.id}": associative=true には refMemberIds が必要`,
        path: `/dimensions/${d.id}/refMemberIds`,
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

  if ((data.supports?.length ?? 0) === 0) {
    errors.push({
      level: 'warning',
      message: 'Supports: 支持条件が定義されていません',
      path: '/supports',
    });
  }
  for (const support of data.supports ?? []) {
    checkStoryRef('Support', support.id, support.storyId, storyIds, '/supports', errors);
    if (storyIds.has(support.storyId) && !isConnectedPoint(support.storyId, support.position)) {
      errors.push({
        level: 'error',
        message: `Support "${support.id}": 部材節点または剛床masterに接続されていません`,
        path: `/supports/${support.id}/position`,
      });
    }
  }

  for (const load of data.nodalLoads ?? []) {
    checkStoryRef('NodalLoad', load.id, load.storyId, storyIds, '/nodalLoads', errors);
    checkLoadCaseRef('NodalLoad', load.id, load.loadCaseId, loadCaseIds, '/nodalLoads', errors);
    if (storyIds.has(load.storyId) && !isConnectedPoint(load.storyId, load.position)) {
      errors.push({
        level: 'error',
        message: `NodalLoad "${load.id}": 部材節点または剛床masterに接続されていません`,
        path: `/nodalLoads/${load.id}/position`,
      });
    }
  }

  for (const load of data.memberLoads ?? []) {
    checkLoadCaseRef('MemberLoad', load.id, load.loadCaseId, loadCaseIds, '/memberLoads', errors);
    if (!memberIds.has(load.memberId)) {
      errors.push({
        level: 'error',
        message: `MemberLoad "${load.id}": memberId "${load.memberId}" が未定義`,
        path: `/memberLoads/${load.id}`,
      });
    }
  }

  for (const load of data.areaLoads ?? []) {
    checkLoadCaseRef('AreaLoad', load.id, load.loadCaseId, loadCaseIds, '/areaLoads', errors);
    const member = memberById.get(load.memberId);
    if (!member) {
      errors.push({
        level: 'error',
        message: `AreaLoad "${load.id}": memberId "${load.memberId}" が未定義`,
        path: `/areaLoads/${load.id}`,
      });
    } else if (member.type !== 'slab') {
      errors.push({
        level: 'error',
        message: `AreaLoad "${load.id}": ${member.type} は面荷重の対象にできません`,
        path: `/areaLoads/${load.id}`,
      });
    }
  }

  for (const combination of data.loadCombinations ?? []) {
    const factorCaseIds = combination.factors.map((factor) => factor.loadCaseId);
    if (new Set(factorCaseIds).size !== factorCaseIds.length) {
      errors.push({
        level: 'error',
        message: `LoadCombination "${combination.id}": 同じ loadCaseId が重複`,
        path: `/loadCombinations/${combination.id}/factors`,
      });
    }
    for (const factor of combination.factors) {
      checkLoadCaseRef(
        'LoadCombination',
        combination.id,
        factor.loadCaseId,
        loadCaseIds,
        '/loadCombinations',
        errors,
      );
    }
  }

  for (const mass of data.masses ?? []) {
    checkStoryRef('LumpedMass', mass.id, mass.storyId, storyIds, '/masses', errors);
    if (storyIds.has(mass.storyId) && !isConnectedPoint(mass.storyId, mass.position)) {
      errors.push({
        level: 'error',
        message: `LumpedMass "${mass.id}": 部材節点または剛床masterに接続されていません`,
        path: `/masses/${mass.id}/position`,
      });
    }
  }

  for (const diaphragm of data.diaphragms ?? []) {
    checkStoryRef('Diaphragm', diaphragm.id, diaphragm.storyId, storyIds, '/diaphragms', errors);
    for (const memberId of diaphragm.memberIds ?? []) {
      const member = memberById.get(memberId);
      if (!member) {
        errors.push({
          level: 'error',
          message: `Diaphragm "${diaphragm.id}": memberId "${memberId}" が未定義`,
          path: `/diaphragms/${diaphragm.id}`,
        });
      } else if (member.story !== diaphragm.storyId) {
        errors.push({
          level: 'error',
          message: `Diaphragm "${diaphragm.id}": member "${memberId}" が別の階を参照`,
          path: `/diaphragms/${diaphragm.id}`,
        });
      }
    }
  }

  const results = data.analysisResults;
  if (results?.caseId && !loadCaseIds.has(results.caseId)) {
    errors.push({
      level: 'error',
      message: `AnalysisResults: caseId "${results.caseId}" が未定義`,
      path: '/analysisResults/caseId',
    });
  }
  if (results?.combinationId && !combinationIds.has(results.combinationId)) {
    errors.push({
      level: 'error',
      message: `AnalysisResults: combinationId "${results.combinationId}" が未定義`,
      path: '/analysisResults/combinationId',
    });
  }
  for (const result of results?.memberResults ?? []) {
    if (!memberIds.has(result.memberId)) {
      errors.push({
        level: 'error',
        message: `AnalysisMemberResult: memberId "${result.memberId}" が未定義`,
        path: '/analysisResults/memberResults',
      });
    }
  }

  return { ok: errors.every((e) => e.level !== 'error'), errors };
}

function collectAnalysisNodesByStory(
  data: ProjectData,
): Map<string, SpatialPointIndex3D<boolean>> {
  const nodes = new Map<string, SpatialPointIndex3D<boolean>>();
  const add = (storyId: string, point: Point3D) => {
    const storyNodes = nodes.get(storyId) ?? new SpatialPointIndex3D<boolean>(JOINT_MERGE_TOLERANCE);
    storyNodes.insert(point, true);
    nodes.set(storyId, storyNodes);
  };
  for (const member of data.members) {
    if (member.type === 'slab') {
      for (const point of member.polygon) add(member.story, { ...point, z: member.level });
    } else {
      add(member.story, member.start);
      add(member.story, member.end);
    }
  }
  for (const diaphragm of data.diaphragms ?? []) {
    if (diaphragm.masterPosition) add(diaphragm.storyId, diaphragm.masterPosition);
  }
  return nodes;
}

function resolveGridToken(
  token: string,
  byId: Map<string, ProjectData['grids'][number]>,
  byName: Map<string, ProjectData['grids']>,
): { status: 'ok' | 'missing' | 'ambiguous'; grid?: ProjectData['grids'][number] } {
  const exact = byId.get(token);
  if (exact) return { status: 'ok', grid: exact };
  const named = byName.get(token) ?? [];
  if (named.length === 1) return { status: 'ok', grid: named[0] };
  if (named.length > 1) return { status: 'ambiguous' };
  return { status: 'missing' };
}

function checkStoryRef(
  kind: string,
  id: string,
  storyId: string,
  storyIds: Set<string>,
  collectionPath: string,
  errors: ValidationError[],
) {
  if (!storyIds.has(storyId)) {
    errors.push({
      level: 'error',
      message: `${kind} "${id}": storyId "${storyId}" が未定義`,
      path: `${collectionPath}/${id}`,
    });
  }
}

function checkLoadCaseRef(
  kind: string,
  id: string,
  loadCaseId: string,
  loadCaseIds: Set<string>,
  collectionPath: string,
  errors: ValidationError[],
) {
  if (!loadCaseIds.has(loadCaseId)) {
    errors.push({
      level: 'error',
      message: `${kind} "${id}": loadCaseId "${loadCaseId}" が未定義`,
      path: `${collectionPath}/${id}`,
    });
  }
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
