import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import { collectAllIds, generateId } from '@/domain/idGenerator';
import { JOINT_MERGE_TOLERANCE, quantize } from '@/domain/geometry/precision';
import type { Group, Member, ProjectData, Story } from '@/domain/structural/types';
import { deepClone } from '@/libs/clone';
import { applyGridGeometry } from '@/domain/structural/gridResolve';
import { mergeMaterial } from '@/domain/structural/materials';
import { recomputeAssociativeDimensions } from '@/domain/structural/associativeDimension';
import {
  duplicateSelection,
  scaleSelection,
  stretchSelection,
  translateSelection,
  offsetSelection,
  mirrorSelection,
  arraySelection,
} from '@/domain/structural/editTransform';
import {
  trimMember as trimMemberFn,
  extendMember as extendMemberFn,
  filletWalls as filletWallsFn,
} from '@/domain/structural/editTrim';
import { createDefaultPlanView, createDefaultSheet, createEmptyProject } from './projectFactories';
import { ensureUniqueId, duplicateStoryInProject } from './storyRename';
import type { ProjectState } from './projectStoreTypes';
import { assignById, removeById } from './projectCollectionMutations';
import { useEditorStore } from './editorStore';
import { validateGeometry, validateReferences } from '@/domain/validation';
import {
  deleteEntitiesInProject,
  detachGridReferences,
  cloneUpdatePatch,
  constrainOpeningToHost,
  constrainProjectOpenings,
  isValidMemberGeometry,
  isValidMaterial,
  isValidSection,
  mergeMemberUpdate,
  moveConnectedJointInProject,
  normalizeDimension,
  normalizeMember,
  normalizeOpening,
  normalizeProjectMemberGeometry,
  projectValuesEqual,
  reconcileAnalysisPointsForMembers,
  renameGridReferences,
  shiftMemberToStory,
  shiftStoryElevation,
} from './projectStoreCommands';
import { applyProjectImport, createEmptyImportSummary } from './projectImport';

let revisionCounter = 0;
let documentGenerationCounter = 0;

function nextRevision(): number {
  revisionCounter += 1;
  return revisionCounter;
}

function markModified(state: {
  currentRevision: number;
  savedRevision: number;
  isDirty: boolean;
  data?: { analysisResults?: unknown } | null;
}, invalidateAnalysis = false) {
  if (invalidateAnalysis && state.data) state.data.analysisResults = undefined;
  state.currentRevision = nextRevision();
  state.isDirty = state.currentRevision !== state.savedRevision;
}

const PRESENTATION_ONLY_MEMBER_KEYS = new Set(['color', 'lineType', 'lineWeight']);

function memberUpdateInvalidatesAnalysis(updates: Partial<Member>): boolean {
  return Object.keys(updates).some((key) => !PRESENTATION_ONLY_MEMBER_KEYS.has(key));
}

function selectionInvalidatesAnalysis(
  data: { members: Array<{ id: string }>; openings: Array<{ id: string }> },
  ids: Iterable<string>,
): boolean {
  const selected = new Set(ids);
  return (
    data.members.some((member) => selected.has(member.id)) ||
    data.openings.some((opening) => selected.has(opening.id))
  );
}

function changedMemberIds(
  before: { members: readonly Member[] },
  after: { members: readonly Member[] },
): string[] {
  const previousById = new Map(before.members.map((member) => [member.id, member]));
  return after.members
    .filter((member) => !projectValuesEqual(previousById.get(member.id), member))
    .map((member) => member.id);
}

function validationErrors(data: ProjectData) {
  return [...validateGeometry(data).errors, ...validateReferences(data).errors]
    .filter((issue) => issue.level === 'error');
}

/** Allow an edit to repair or coexist with legacy errors, but never introduce a new one. */
function introducedValidationErrors(before: ProjectData, after: ProjectData) {
  const existing = new Map<string, number>();
  for (const issue of validationErrors(before)) {
    const key = `${issue.path}\u0000${issue.message}`;
    existing.set(key, (existing.get(key) ?? 0) + 1);
  }
  return validationErrors(after).filter((issue) => {
    const key = `${issue.path}\u0000${issue.message}`;
    const remaining = existing.get(key) ?? 0;
    if (remaining === 0) return true;
    existing.set(key, remaining - 1);
    return false;
  });
}

function finalizeMemberCandidate(
  before: ProjectData,
  candidate: ProjectData,
  affectedMemberIds: Iterable<string>,
): ProjectData | null {
  const affected = [...new Set(affectedMemberIds)];
  if (!normalizeProjectMemberGeometry(candidate, affected)) return null;
  reconcileAnalysisPointsForMembers(before, candidate, affected);
  const next = recomputeAssociativeDimensions(constrainProjectOpenings(candidate));
  return introducedValidationErrors(before, next).length === 0 ? next : null;
}

function resetEditorForDocument(activeStory: string | null) {
  useEditorStore.setState({
    activeStory,
    selectedIds: [],
    activeTool: 'select',
    drawAnchor: null,
    activeSnapPoint: null,
    cursorWorld: null,
    pan: { x: 0, y: 0 },
    zoom: 0.05,
  });
}

export const useProjectStore = create<ProjectState>()(
  temporal(
    immer((set): ProjectState => ({
      data: null,
      isDirty: false,
      fileHandle: null,
      currentRevision: 0,
      savedRevision: 0,
      documentGeneration: 0,

      loadProject: (data) => {
        const revision = nextRevision();
        set((state) => {
          state.data = deepClone(data);
          state.isDirty = false;
          state.fileHandle = null;
          state.currentRevision = revision;
          state.savedRevision = revision;
          state.documentGeneration = ++documentGenerationCounter;
        });
        useProjectStore.temporal.getState().clear();
        resetEditorForDocument(data.stories[0]?.id ?? null);
      },

      newProject: () => {
        const revision = nextRevision();
        set((state) => {
          state.data = createEmptyProject();
          state.isDirty = false;
          state.fileHandle = null;
          state.currentRevision = revision;
          state.savedRevision = revision;
          state.documentGeneration = ++documentGenerationCounter;
        });
        useProjectStore.temporal.getState().clear();
        resetEditorForDocument(useProjectStore.getState().data?.stories[0]?.id ?? null);
      },

      setFileHandle: (handle) =>
        set((state) => {
          state.fileHandle = handle;
        }),

      markClean: () =>
        set((state) => {
          state.savedRevision = state.currentRevision;
          state.isDirty = false;
        }),

      // ── Members ──

      addMember: (member) =>
        set((state) => {
          if (!state.data) return;
          const next = normalizeMember(member);
          if (!isValidMemberGeometry(next)) return;
          if (collectAllIds(state.data).has(next.id)) return;
          state.data.members.push(next);
          markModified(state, true);
        }),

      updateMember: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          if (updates.id !== undefined && updates.id !== id) return;
          const before = state.data as ProjectData;
          const candidate = deepClone(before);
          const idx = candidate.members.findIndex((m) => m.id === id);
          if (idx < 0) return;
          const current = candidate.members[idx];
          const sourceStory = candidate.stories.find((story) => story.id === current.story);
          const targetStory = candidate.stories.find(
            (story) => story.id === (updates.story ?? current.story),
          );
          if (!sourceStory || !targetStory) return;
          let next = mergeMemberUpdate(current, updates);
          if (!next) return;
          const elevationDelta = targetStory.elevation - sourceStory.elevation;
          if (updates.story && updates.story !== current.story) {
            next = shiftMemberToStory(next, elevationDelta);
          }
          if (projectValuesEqual(current, next)) return;
          if (updates.story && updates.story !== current.story) {
            for (const opening of candidate.openings) {
              if (opening.memberId === id) {
                opening.position.z = quantize(opening.position.z + elevationDelta);
              }
            }
          }
          candidate.members[idx] = next;
          const finalized = finalizeMemberCandidate(before, candidate, [id]);
          if (!finalized) return;
          state.data = finalized;
          markModified(state, memberUpdateInvalidatesAnalysis(updates));
        }),

      updateMembers: (ids, updates) =>
        set((state) => {
          if (!state.data || ids.length === 0 || updates.id !== undefined) return;
          const before = state.data as ProjectData;
          const candidate = deepClone(before);
          const selected = new Set(ids);
          const targetStory = updates.story
            ? candidate.stories.find((story) => story.id === updates.story)
            : undefined;
          if (updates.story && !targetStory) return;
          const elevationDeltaByMember = new Map<string, number>();
          const changedIds: string[] = [];
          candidate.members = candidate.members.map((member) => {
            if (!selected.has(member.id)) return member;
            let next = mergeMemberUpdate(member, updates);
            if (!next) return member;
            if (targetStory && targetStory.id !== member.story) {
              const sourceStory = candidate.stories.find((story) => story.id === member.story);
              if (!sourceStory) return member;
              const delta = targetStory.elevation - sourceStory.elevation;
              next = shiftMemberToStory(next, delta);
              elevationDeltaByMember.set(member.id, delta);
            }
            if (projectValuesEqual(member, next)) return member;
            changedIds.push(member.id);
            return next;
          });
          if (changedIds.length === 0) return;
          for (const opening of candidate.openings) {
            const delta = elevationDeltaByMember.get(opening.memberId);
            if (delta != null) opening.position.z = quantize(opening.position.z + delta);
          }
          const finalized = finalizeMemberCandidate(before, candidate, changedIds);
          if (!finalized) return;
          state.data = finalized;
          markModified(state, memberUpdateInvalidatesAnalysis(updates));
        }),

      deleteMember: (id) =>
        set((state) => {
          if (!state.data) return;
          if (!deleteEntitiesInProject(state.data, [id])) return;
          markModified(state, true);
        }),

      moveMember: (id, dx, dy) =>
        set((state) => {
          if (!state.data) return;
          if (!state.data.members.some((member) => member.id === id)) return;
          const candidate = deepClone(state.data);
          translateSelection(candidate, [id], dx, dy);
          const finalized = finalizeMemberCandidate(state.data as ProjectData, candidate, [id]);
          if (!finalized) return;
          state.data = finalized;
          markModified(state, true);
        }),

      duplicateMember: (id) => {
        let newId: string | null = null;
        set((state) => {
          if (!state.data) return;
          const candidate = deepClone(state.data);
          const createdIds = duplicateSelection(candidate, [id], { dx: 0, dy: 0, count: 1 });
          newId = createdIds[0] ?? null;
          if (!newId) return;
          const finalized = finalizeMemberCandidate(
            state.data as ProjectData,
            candidate,
            createdIds,
          );
          if (!finalized) {
            newId = null;
            return;
          }
          state.data = finalized;
          markModified(state, true);
        });
        return newId;
      },

      translateEntities: (ids, dx, dy) =>
        set((state) => {
          if (!state.data || ids.length === 0) return;
          const invalidatesAnalysis = selectionInvalidatesAnalysis(state.data, ids);
          const candidate = deepClone(state.data);
          translateSelection(candidate, ids, dx, dy);
          const finalized = finalizeMemberCandidate(state.data as ProjectData, candidate, ids);
          if (!finalized) return;
          state.data = finalized;
          markModified(state, invalidatesAnalysis);
        }),

      duplicateEntities: (ids, dx, dy, count = 1) => {
        let createdIds: string[] = [];
        set((state) => {
          if (!state.data || ids.length === 0) return;
          const invalidatesAnalysis = selectionInvalidatesAnalysis(state.data, ids);
          const candidate = deepClone(state.data);
          createdIds = duplicateSelection(candidate, ids, { dx, dy, count });
          if (createdIds.length === 0) return;
          const finalized = finalizeMemberCandidate(
            state.data as ProjectData,
            candidate,
            createdIds,
          );
          if (!finalized) {
            createdIds = [];
            return;
          }
          state.data = finalized;
          markModified(state, invalidatesAnalysis);
        });
        return createdIds;
      },

      scaleEntities: (ids, origin, scaleX, scaleY) =>
        set((state) => {
          if (
            !state.data ||
            ids.length === 0 ||
            !Number.isFinite(scaleX) ||
            !Number.isFinite(scaleY) ||
            scaleX === 0 ||
            scaleY === 0
          ) return;
          const invalidatesAnalysis = selectionInvalidatesAnalysis(state.data, ids);
          const candidate = deepClone(state.data);
          scaleSelection(candidate, ids, origin, scaleX, scaleY);
          const finalized = finalizeMemberCandidate(state.data as ProjectData, candidate, ids);
          if (!finalized) return;
          state.data = finalized;
          markModified(state, invalidatesAnalysis);
        }),

      stretchEntities: (ids, options) =>
        set((state) => {
          if (!state.data || ids.length === 0) return;
          const invalidatesAnalysis = selectionInvalidatesAnalysis(state.data, ids);
          const candidate = deepClone(state.data);
          stretchSelection(candidate, ids, options);
          const finalized = finalizeMemberCandidate(state.data as ProjectData, candidate, ids);
          if (!finalized) return;
          state.data = finalized;
          markModified(state, invalidatesAnalysis);
        }),

      offsetEntities: (ids, distance) => {
        let createdIds: string[] = [];
        set((state) => {
          if (!state.data || ids.length === 0) return;
          const invalidatesAnalysis = selectionInvalidatesAnalysis(state.data, ids);
          const candidate = deepClone(state.data);
          createdIds = offsetSelection(candidate, ids, distance);
          if (createdIds.length === 0) return;
          const finalized = finalizeMemberCandidate(
            state.data as ProjectData,
            candidate,
            createdIds,
          );
          if (!finalized) {
            createdIds = [];
            return;
          }
          state.data = finalized;
          markModified(state, invalidatesAnalysis);
        });
        return createdIds;
      },

      mirrorEntities: (ids, axisStart, axisEnd, copy) => {
        let createdIds: string[] = [];
        set((state) => {
          if (!state.data || ids.length === 0) return;
          const invalidatesAnalysis = selectionInvalidatesAnalysis(state.data, ids);
          const candidate = deepClone(state.data);
          createdIds = mirrorSelection(candidate, ids, axisStart, axisEnd, copy);
          if (copy && createdIds.length === 0) return;
          const affectedIds = copy ? createdIds : ids;
          const finalized = finalizeMemberCandidate(
            state.data as ProjectData,
            candidate,
            affectedIds,
          );
          if (!finalized) {
            createdIds = [];
            return;
          }
          state.data = finalized;
          markModified(state, invalidatesAnalysis);
        });
        return createdIds;
      },

      arrayEntities: (ids, options) => {
        let createdIds: string[] = [];
        set((state) => {
          if (!state.data || ids.length === 0) return;
          const invalidatesAnalysis = selectionInvalidatesAnalysis(state.data, ids);
          const candidate = deepClone(state.data);
          createdIds = arraySelection(candidate, ids, options);
          if (createdIds.length === 0) return;
          const finalized = finalizeMemberCandidate(
            state.data as ProjectData,
            candidate,
            createdIds,
          );
          if (!finalized) {
            createdIds = [];
            return;
          }
          state.data = finalized;
          markModified(state, invalidatesAnalysis);
        });
        return createdIds;
      },

      // ── Annotations ──

      addAnnotation: (annotation) =>
        set((state) => {
          if (!state.data) return;
          if (collectAllIds(state.data).has(annotation.id)) return;
          state.data.annotations.push(annotation);
          markModified(state);
        }),

      addAnnotations: (annotations) =>
        set((state) => {
          if (!state.data || annotations.length === 0) return;
          const usedIds = collectAllIds(state.data);
          const unique = annotations.filter((annotation) => {
            if (usedIds.has(annotation.id)) return false;
            usedIds.add(annotation.id);
            return true;
          });
          if (unique.length === 0) return;
          state.data.annotations.push(...unique);
          markModified(state);
        }),

      updateAnnotation: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          if (updates.id !== undefined && updates.id !== id) return;
          if (!assignById(state.data.annotations, id, updates)) return;
          markModified(state);
        }),

      deleteAnnotation: (id) =>
        set((state) => {
          if (!state.data) return;
          if (!state.data.annotations.some((item) => item.id === id)) return;
          state.data.annotations = removeById(state.data.annotations, id);
          markModified(state);
        }),

      // ── Dimensions ──

      addDimension: (dimension) =>
        set((state) => {
          if (!state.data) return;
          const next = normalizeDimension(dimension);
          if (!next || collectAllIds(state.data).has(next.id)) return;
          state.data.dimensions.push(next);
          markModified(state);
        }),

      updateDimension: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          if (updates.id !== undefined && updates.id !== id) return;
          const index = state.data.dimensions.findIndex((item) => item.id === id);
          if (index < 0) return;
          const next = normalizeDimension({ ...state.data.dimensions[index], ...updates });
          if (!next) return;
          state.data.dimensions[index] = next;
          markModified(state);
        }),

      deleteDimension: (id) =>
        set((state) => {
          if (!state.data) return;
          if (!state.data.dimensions.some((item) => item.id === id)) return;
          state.data.dimensions = removeById(state.data.dimensions, id);
          markModified(state);
        }),

      // ── Openings ──

      addOpening: (opening) =>
        set((state) => {
          if (!state.data) return;
          const next = normalizeOpening(opening);
          const host = next
            ? state.data.members.find((member) => member.id === next.memberId)
            : undefined;
          if (
            !next ||
            !host ||
            collectAllIds(state.data).has(next.id)
          ) return;
          state.data.openings.push(constrainOpeningToHost(next, host));
          markModified(state, true);
        }),

      updateOpening: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          if (updates.id !== undefined && updates.id !== id) return;
          const index = state.data.openings.findIndex((item) => item.id === id);
          if (index < 0) return;
          const next = normalizeOpening({ ...state.data.openings[index], ...updates });
          const host = next
            ? state.data.members.find((member) => member.id === next.memberId)
            : undefined;
          if (!next || !host) return;
          state.data.openings[index] = constrainOpeningToHost(next, host);
          markModified(state, true);
        }),

      deleteOpening: (id) =>
        set((state) => {
          if (!state.data) return;
          if (!state.data.openings.some((item) => item.id === id)) return;
          state.data.openings = removeById(state.data.openings, id);
          markModified(state, true);
        }),

      // ── Stories ──

      addStory: (story) =>
        set((state) => {
          if (!state.data) return;
          if (
            state.data.stories.some((item) => item.id === story.id) ||
            !Number.isFinite(story.elevation) ||
            !Number.isFinite(story.height) ||
            story.height <= 0
          ) return;
          state.data.stories.push(story);
          markModified(state, true);
        }),

      updateStory: (id, updates) =>
        useProjectStore.getState().updateStories([{ id, updates }]),

      updateStories: (updates) =>
        set((state) => {
          if (!state.data || updates.length === 0) return;
          const planned = new Map<string, { story: Story; updates: Partial<Story>; delta: number }>();
          for (const item of updates) {
            const story = state.data.stories.find((candidate) => candidate.id === item.id);
            if (!story || (item.updates.id !== undefined && item.updates.id !== item.id)) return;
            const nextElevation = item.updates.elevation ?? story.elevation;
            const nextHeight = item.updates.height ?? story.height;
            if (
              !Number.isFinite(nextElevation) ||
              !Number.isFinite(nextHeight) ||
              nextHeight <= 0
            ) return;
            planned.set(item.id, {
              story,
              updates: item.updates,
              delta: nextElevation - story.elevation,
            });
          }
          for (const [id, item] of planned) {
            Object.assign(item.story, item.updates, { id });
          }
          for (const [id, item] of planned) {
            shiftStoryElevation(state.data, id, item.delta);
          }
          markModified(state, true);
        }),

      duplicateStory: (sourceId, story) => {
        let newId: string | null = null;
        set((state) => {
          if (!state.data) return;
          newId = duplicateStoryInProject(state.data, sourceId, story);
          if (newId === null) return;
          markModified(state, true);
        });
        return newId;
      },

      deleteStory: (id) => {
        let deleted = false;
        let nextActiveStory: string | null = null;
        const removedEntityIds = new Set<string>();
        set((state) => {
          if (!state.data || state.data.stories.length <= 1) return;
          const storyIndex = state.data.stories.findIndex((story) => story.id === id);
          if (storyIndex < 0) return;

          for (const member of state.data.members) {
            if (member.story === id) removedEntityIds.add(member.id);
          }
          for (const annotation of state.data.annotations) {
            if (annotation.story === id) removedEntityIds.add(annotation.id);
          }
          for (const dimension of state.data.dimensions) {
            if (dimension.story === id) removedEntityIds.add(dimension.id);
          }
          for (const line of state.data.constructionLines ?? []) {
            if (line.story === id) removedEntityIds.add(line.id);
          }
          deleteEntitiesInProject(state.data, removedEntityIds);
          state.data.supports = state.data.supports?.filter((item) => item.storyId !== id);
          state.data.nodalLoads = state.data.nodalLoads?.filter((item) => item.storyId !== id);
          state.data.masses = state.data.masses?.filter((item) => item.storyId !== id);
          state.data.diaphragms = state.data.diaphragms?.filter((item) => item.storyId !== id);

          const removedViewIds = new Set(
            state.data.views.filter((view) => view.story === id).map((view) => view.id),
          );
          state.data.views = state.data.views.filter((view) => !removedViewIds.has(view.id));
          state.data.sheets = state.data.sheets
            .map((sheet) => {
              const affected =
                sheet.viewIds.some((viewId) => removedViewIds.has(viewId)) ||
                sheet.viewports?.some((viewport) => removedViewIds.has(viewport.viewId)) === true;
              return {
                sheet: {
                  ...sheet,
                  viewIds: sheet.viewIds.filter((viewId) => !removedViewIds.has(viewId)),
                  viewports: sheet.viewports?.filter(
                    (viewport) => !removedViewIds.has(viewport.viewId),
                  ),
                },
                affected,
              };
            })
            .filter(
              ({ sheet, affected }) =>
                !affected || sheet.viewIds.length > 0 || (sheet.viewports?.length ?? 0) > 0,
            )
            .map(({ sheet }) => sheet);
          state.data.stories.splice(storyIndex, 1);
          nextActiveStory =
            state.data.stories[Math.min(storyIndex, state.data.stories.length - 1)]?.id ?? null;
          deleted = true;
          markModified(state, true);
        });
        if (deleted) {
          const editor = useEditorStore.getState();
          editor.setSelectedIds(editor.selectedIds.filter((selectedId) => !removedEntityIds.has(selectedId)));
          if (editor.activeStory === id) editor.setActiveStory(nextActiveStory);
        }
        return deleted;
      },

      reorderStories: (orderedIds, chainElevations = false) =>
        set((state) => {
          if (!state.data || orderedIds.length !== state.data.stories.length) return;
          const uniqueIds = new Set(orderedIds);
          if (
            uniqueIds.size !== state.data.stories.length ||
            state.data.stories.some((story) => !uniqueIds.has(story.id))
          ) return;
          const byId = new Map(state.data.stories.map((story) => [story.id, story]));
          const reordered = orderedIds.map((id) => byId.get(id)!);
          const orderChanged = reordered.some(
            (story, index) => story.id !== state.data!.stories[index].id,
          );
          const elevationShifts: Array<{ storyId: string; delta: number }> = [];
          if (chainElevations && reordered.length > 1) {
            let elevation = reordered[0].elevation;
            for (let index = 1; index < reordered.length; index += 1) {
              const previous = reordered[index - 1];
              elevation += previous.height;
              const story = reordered[index];
              const delta = elevation - story.elevation;
              if (delta !== 0) {
                story.elevation = elevation;
                elevationShifts.push({ storyId: story.id, delta });
              }
            }
          }
          if (!orderChanged && elevationShifts.length === 0) return;
          state.data.stories = reordered;
          for (const shift of elevationShifts) {
            shiftStoryElevation(state.data, shift.storyId, shift.delta);
          }
          markModified(state, true);
        }),

      // ── Grids ──

      addGrid: (grid) =>
        set((state) => {
          if (!state.data) return;
          if (
            state.data.grids.some(
              (item) =>
                item.id === grid.id ||
                item.name === grid.name ||
                item.id === grid.name ||
                item.name === grid.id,
            ) ||
            !Number.isFinite(grid.position)
          ) return;
          const candidate = deepClone(state.data);
          candidate.grids.push(deepClone(grid));
          // Re-resolve gridRef-pinned members, then follow associative dims.
          const resolved = applyGridGeometry(candidate);
          const affectedMemberIds = changedMemberIds(state.data, resolved);
          const nextData = finalizeMemberCandidate(
            state.data as ProjectData,
            resolved,
            affectedMemberIds,
          );
          if (!nextData) return;
          state.data = nextData;
          markModified(state, true);
        }),

      updateGrid: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          if (updates.id !== undefined && updates.id !== id) return;
          const candidate = deepClone(state.data);
          const grid = candidate.grids.find((item) => item.id === id);
          if (!grid) return;
          if (
            updates.name &&
            candidate.grids.some(
              (item) =>
                item.id !== id && (item.name === updates.name || item.id === updates.name),
            )
          ) return;
          if (updates.position != null && !Number.isFinite(updates.position)) return;
          const gridsBeforeRename = deepClone(candidate.grids);
          Object.assign(grid, updates, { id });
          renameGridReferences(candidate, gridsBeforeRename, id, grid.name);
          // Editing a grid's position/axis/name moves pinned members, so
          // associative dimensions tied to them must follow too.
          const resolved = applyGridGeometry(candidate);
          const affectedMemberIds = changedMemberIds(state.data, resolved);
          const nextData = finalizeMemberCandidate(
            state.data as ProjectData,
            resolved,
            affectedMemberIds,
          );
          if (!nextData) return;
          if (projectValuesEqual(state.data, nextData)) return;
          state.data = nextData;
          markModified(state, true);
        }),

      deleteGrid: (id) =>
        set((state) => {
          if (!state.data) return;
          const candidate = deepClone(state.data);
          const grid = candidate.grids.find((item) => item.id === id);
          if (!grid) return;
          const gridsBeforeDelete = deepClone(candidate.grids);
          detachGridReferences(candidate, gridsBeforeDelete, grid.id);
          candidate.grids = removeById(candidate.grids, id);
          const resolved = applyGridGeometry(candidate);
          const affectedMemberIds = changedMemberIds(state.data, resolved);
          const nextData = finalizeMemberCandidate(
            state.data as ProjectData,
            resolved,
            affectedMemberIds,
          );
          if (!nextData) return;
          state.data = nextData;
          markModified(state, true);
        }),

      // ── Load cases ──

      addLoadCase: (loadCase) =>
        set((state) => {
          if (!state.data) return;
          if (!loadCase.id.trim() || !loadCase.name.trim() ||
            (loadCase.factor !== undefined && !Number.isFinite(loadCase.factor))) return;
          if (!state.data.loadCases) state.data.loadCases = [];
          if (state.data.loadCases.some((item) => item.id === loadCase.id)) return;
          state.data.loadCases.push(loadCase);
          markModified(state, true);
        }),

      updateLoadCase: (id, updates) =>
        set((state) => {
          if (!state.data || !state.data.loadCases) return;
          if (updates.id !== undefined && updates.id !== id) return;
          const current = state.data.loadCases.find((item) => item.id === id);
          if (!current) return;
          const candidate = { ...current, ...cloneUpdatePatch(updates), id };
          if (!candidate.name.trim() ||
            (candidate.factor !== undefined && !Number.isFinite(candidate.factor))) return;
          if (projectValuesEqual(current, candidate)) return;
          Object.assign(current, candidate);
          markModified(state, true);
        }),

      deleteLoadCase: (id) =>
        set((state) => {
          if (!state.data || !state.data.loadCases) return;
          if (!state.data.loadCases.some((item) => item.id === id)) return;
          state.data.loadCases = removeById(state.data.loadCases, id);
          state.data.nodalLoads = state.data.nodalLoads?.filter((load) => load.loadCaseId !== id);
          state.data.memberLoads = state.data.memberLoads?.filter((load) => load.loadCaseId !== id);
          state.data.areaLoads = state.data.areaLoads?.filter((load) => load.loadCaseId !== id);
          state.data.loadCombinations = state.data.loadCombinations
            ?.map((combination) => ({
              ...combination,
              factors: combination.factors.filter((factor) => factor.loadCaseId !== id),
            }))
            .filter((combination) => combination.factors.length > 0);
          if (state.data.analysisResults?.caseId === id) state.data.analysisResults = undefined;
          markModified(state, true);
        }),

      // ── Masters ──

      addMaterial: (material) =>
        set((state) => {
          if (!state.data) return;
          if (state.data.materials.some((item) => item.id === material.id) || !isValidMaterial(material)) return;
          state.data.materials.push(deepClone(material));
          markModified(state, true);
        }),

      updateMaterial: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          if (updates.id !== undefined && updates.id !== id) return;
          const index = state.data.materials.findIndex((item) => item.id === id);
          if (index < 0) return;
          const current = state.data.materials[index];
          const candidate = mergeMaterial(current, { ...cloneUpdatePatch(updates), id });
          if (!isValidMaterial(candidate)) return;
          if (projectValuesEqual(current, candidate)) return;
          state.data.materials[index] = candidate;
          markModified(state, true);
        }),

      deleteMaterial: (id) =>
        set((state) => {
          if (!state.data) return;
          if (state.data.members.some((m) => m.materialId === id)) return;
          if (!state.data.materials.some((item) => item.id === id)) return;
          state.data.materials = removeById(state.data.materials, id);
          markModified(state, true);
        }),

      addSection: (section) =>
        set((state) => {
          if (!state.data) return;
          if (state.data.sections.some((item) => item.id === section.id) || !isValidSection(section)) return;
          state.data.sections.push(deepClone(section));
          markModified(state, true);
        }),

      updateSection: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          if (updates.id !== undefined && updates.id !== id) return;
          const current = state.data.sections.find((item) => item.id === id);
          if (!current) return;
          const candidate = { ...current, ...cloneUpdatePatch(updates), id } as typeof current;
          if (!isValidSection(candidate)) return;
          if (projectValuesEqual(current, candidate)) return;
          Object.assign(current, candidate);
          markModified(state, true);
        }),

      deleteSection: (id) =>
        set((state) => {
          if (!state.data) return;
          if (state.data.members.some((m) => m.sectionId === id)) return;
          if (!state.data.sections.some((item) => item.id === id)) return;
          state.data.sections = removeById(state.data.sections, id);
          markModified(state, true);
        }),

      addPlanSheet: (storyId) => {
        let newId: string | null = null;
        set((state) => {
          if (!state.data) return;
          const story = state.data.stories.find((item) => item.id === storyId);
          if (!story) return;

          const viewIds = new Set(state.data.views.map((item) => item.id));
          const nextView = createDefaultPlanView(storyId);
          nextView.id = ensureUniqueId(viewIds, nextView.id);
          state.data.views.push(nextView);

          const sheetIds = new Set(state.data.sheets.map((item) => item.id));
          const nextSheet = createDefaultSheet(
            state.data.project.name,
            story.name,
            nextView.id,
            state.data.sheets.length + 1,
          );
          nextSheet.id = ensureUniqueId(sheetIds, nextSheet.id);
          nextSheet.name = ensureUniqueId(
            new Set(state.data.sheets.map((item) => item.name)),
            nextSheet.name,
          );
          state.data.sheets.push(nextSheet);
          markModified(state);
          newId = nextSheet.id;
        });
        return newId;
      },

      updateSheet: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          if (updates.id !== undefined && updates.id !== id) return;
          if (!assignById(state.data.sheets, id, updates)) return;
          markModified(state);
        }),

      deleteSheet: (id) => {
        let deleted = false;
        set((state) => {
          if (!state.data) return;
          const index = state.data.sheets.findIndex((sheet) => sheet.id === id);
          if (index < 0) return;
          const removedSheet = state.data.sheets[index];
          const potentiallyOrphanedViewIds = new Set([
            ...removedSheet.viewIds,
            ...(removedSheet.viewports?.map((viewport) => viewport.viewId) ?? []),
          ]);
          state.data.sheets.splice(index, 1);
          const referencedViewIds = new Set(
            state.data.sheets.flatMap((sheet) => [
              ...sheet.viewIds,
              ...(sheet.viewports?.map((viewport) => viewport.viewId) ?? []),
            ]),
          );
          state.data.views = state.data.views.filter(
            (view) =>
              !potentiallyOrphanedViewIds.has(view.id) || referencedViewIds.has(view.id),
          );
          deleted = true;
          markModified(state);
        });
        return deleted;
      },

      reorderSheets: (orderedIds) =>
        set((state) => {
          if (!state.data || orderedIds.length !== state.data.sheets.length) return;
          const uniqueIds = new Set(orderedIds);
          if (
            uniqueIds.size !== state.data.sheets.length ||
            state.data.sheets.some((sheet) => !uniqueIds.has(sheet.id))
          ) return;
          const byId = new Map(state.data.sheets.map((sheet) => [sheet.id, sheet]));
          const reordered = orderedIds.map((id) => byId.get(id)!);
          if (reordered.every((sheet, index) => sheet.id === state.data!.sheets[index].id)) return;
          state.data.sheets = reordered;
          markModified(state);
        }),

      // ── Trim/Extend ──

      trimMember: (memberId, cutPoint, side) => {
        let result = false;
        set((state) => {
          if (!state.data) return;
          const candidate = deepClone(state.data);
          result = trimMemberFn(candidate, memberId, cutPoint, side);
          if (result) {
            const finalized = finalizeMemberCandidate(
              state.data as ProjectData,
              candidate,
              [memberId],
            );
            if (!finalized) {
              result = false;
              return;
            }
            state.data = finalized;
            markModified(state, true);
          }
        });
        return result;
      },

      extendMember: (memberId, targetMemberId) => {
        let result = false;
        set((state) => {
          if (!state.data) return;
          const candidate = deepClone(state.data);
          result = extendMemberFn(candidate, memberId, targetMemberId);
          if (result) {
            const finalized = finalizeMemberCandidate(
              state.data as ProjectData,
              candidate,
              [memberId],
            );
            if (!finalized) {
              result = false;
              return;
            }
            state.data = finalized;
            markModified(state, true);
          }
        });
        return result;
      },

      filletWalls: (wallId1, wallId2, radius = 0) => {
        let result = false;
        set((state) => {
          if (!state.data) return;
          const candidate = deepClone(state.data);
          result = filletWallsFn(candidate, wallId1, wallId2, radius);
          if (result) {
            const finalized = finalizeMemberCandidate(
              state.data as ProjectData,
              candidate,
              [wallId1, wallId2],
            );
            if (!finalized) {
              result = false;
              return;
            }
            state.data = finalized;
            markModified(state, true);
          }
        });
        return result;
      },

      // ── Slab Vertex Editing ──

      updateSlabVertex: (memberId, vertexIndex, point) =>
        set((state) => {
          if (!state.data) return;
          const before = state.data as ProjectData;
          const project = deepClone(before);
          const member = project.members.find((m) => m.id === memberId);
          if (!member || member.type !== 'slab') return;
          if (vertexIndex < 0 || vertexIndex >= member.polygon.length) return;
          const updated = normalizeMember({
            ...member,
            polygon: member.polygon.map((current, index) =>
              index === vertexIndex ? point : current,
            ),
          });
          if (updated.type !== 'slab' || !isValidMemberGeometry(updated)) return;
          project.members[project.members.indexOf(member)] = updated;
          const finalized = finalizeMemberCandidate(before, project, [memberId]);
          if (!finalized) return;
          state.data = finalized;
          markModified(state, true);
        }),

      addSlabVertex: (memberId, afterIndex) =>
        set((state) => {
          if (!state.data) return;
          const before = state.data as ProjectData;
          const project = deepClone(before);
          const member = project.members.find((m) => m.id === memberId);
          if (!member || member.type !== 'slab') return;
          const n = member.polygon.length;
          if (afterIndex < 0 || afterIndex >= n) return;
          const nextIndex = (afterIndex + 1) % n;
          const midpoint = {
            x: (member.polygon[afterIndex].x + member.polygon[nextIndex].x) / 2,
            y: (member.polygon[afterIndex].y + member.polygon[nextIndex].y) / 2,
          };
          const polygon = [...member.polygon];
          polygon.splice(afterIndex + 1, 0, midpoint);
          const updated = normalizeMember({ ...member, polygon });
          if (updated.type !== 'slab' || !isValidMemberGeometry(updated)) return;
          project.members[project.members.indexOf(member)] = updated;
          const finalized = finalizeMemberCandidate(before, project, [memberId]);
          if (!finalized) return;
          state.data = finalized;
          markModified(state, true);
        }),

      removeSlabVertex: (memberId, vertexIndex) =>
        set((state) => {
          if (!state.data) return;
          const before = state.data as ProjectData;
          const project = deepClone(before);
          const member = project.members.find((m) => m.id === memberId);
          if (!member || member.type !== 'slab') return;
          if (member.polygon.length <= 3) return; // minimum 3 vertices
          if (vertexIndex < 0 || vertexIndex >= member.polygon.length) return;
          const polygon = member.polygon.filter((_, index) => index !== vertexIndex);
          const updated = normalizeMember({ ...member, polygon });
          if (updated.type !== 'slab' || !isValidMemberGeometry(updated)) return;
          project.members[project.members.indexOf(member)] = updated;
          const finalized = finalizeMemberCandidate(before, project, [memberId]);
          if (!finalized) return;
          state.data = finalized;
          markModified(state, true);
        }),

      // ── Grouping ──

      createGroup: (ids, name) => {
        let groupId: string | null = null;
        set((state) => {
          if (!state.data || ids.length === 0) return;
          const memberIdSet = new Set(state.data.members.map((member) => member.id));
          const memberIds = [...new Set(ids)].filter((id) => memberIdSet.has(id));
          if (memberIds.length === 0) return;
          if (!state.data.groups) state.data.groups = [];
          groupId = generateId('grp', collectAllIds(state.data));
          const group: Group = { id: groupId, name, memberIds };
          state.data.groups.push(group);
          markModified(state);
        });
        return groupId;
      },

      ungroupSelection: (groupId) =>
        set((state) => {
          if (!state.data || !state.data.groups) return;
          const previousLength = state.data.groups.length;
          state.data.groups = state.data.groups.filter((g) => g.id !== groupId);
          if (previousLength === state.data.groups.length) return;
          markModified(state);
        }),

      // ── Construction Lines ──

      addConstructionLine: (cl) =>
        set((state) => {
          if (!state.data) return;
          if (!state.data.constructionLines) state.data.constructionLines = [];
          if (collectAllIds(state.data).has(cl.id)) return;
          state.data.constructionLines.push(cl);
          markModified(state);
        }),

      deleteConstructionLine: (id) =>
        set((state) => {
          if (!state.data || !state.data.constructionLines) return;
          if (!state.data.constructionLines.some((item) => item.id === id)) return;
          state.data.constructionLines = removeById(state.data.constructionLines, id);
          markModified(state);
        }),

      // ── External References ──

      addExternalRef: (ref) =>
        set((state) => {
          if (!state.data) return;
          if (!state.data.externalRefs) state.data.externalRefs = [];
          state.data.externalRefs.push(ref);
          markModified(state);
        }),

      removeExternalRef: (id) =>
        set((state) => {
          if (!state.data || !state.data.externalRefs) return;
          if (!state.data.externalRefs.some((item) => item.id === id)) return;
          state.data.externalRefs = removeById(state.data.externalRefs, id);
          markModified(state);
        }),

      toggleExternalRefVisibility: (id) =>
        set((state) => {
          if (!state.data || !state.data.externalRefs) return;
          const ref = state.data.externalRefs.find((r) => r.id === id);
          if (!ref) return;
          ref.visible = !ref.visible;
          markModified(state);
        }),

      // ── Viewports ──

      addViewport: (viewport) =>
        set((state) => {
          if (!state.data) return;
          const sheet = state.data.sheets.find((s) => s.id === viewport.sheetId);
          if (!sheet) return;
          if (!sheet.viewports) sheet.viewports = [];
          sheet.viewports.push(viewport);
          markModified(state);
        }),

      updateViewport: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          if (updates.id !== undefined && updates.id !== id) return;
          for (const sheet of state.data.sheets) {
            if (!sheet.viewports) continue;
            const vp = sheet.viewports.find((v) => v.id === id);
            if (vp) {
              Object.assign(vp, updates);
              markModified(state);
              return;
            }
          }
        }),

      removeViewport: (id) =>
        set((state) => {
          if (!state.data) return;
          for (const sheet of state.data.sheets) {
            if (!sheet.viewports) continue;
            const idx = sheet.viewports.findIndex((v) => v.id === id);
            if (idx >= 0) {
              sheet.viewports.splice(idx, 1);
              markModified(state);
              return;
            }
          }
        }),

      // ── Transactional commands ──

      updateAnalysisData: (updates) =>
        set((state) => {
          if (!state.data) return;
          const candidate = deepClone(state.data);
          const keys = [
            'supports',
            'nodalLoads',
            'memberLoads',
            'areaLoads',
            'loadCombinations',
            'masses',
            'diaphragms',
            'analysisResults',
          ] as const;
          let changed = false;
          let modelChanged = false;
          for (const key of keys) {
            if (!Object.prototype.hasOwnProperty.call(updates, key)) continue;
            // All fields are replaced together in this one undoable command.
            const nextValue = (
              updates[key] === undefined ? undefined : deepClone(updates[key])
            ) as never;
            if (projectValuesEqual(candidate[key], nextValue)) continue;
            candidate[key] = nextValue;
            changed = true;
            if (key !== 'analysisResults') modelChanged = true;
          }
          if (!changed) return;
          if (
            modelChanged &&
            !Object.prototype.hasOwnProperty.call(updates, 'analysisResults')
          ) {
            candidate.analysisResults = undefined;
          }
          if (introducedValidationErrors(state.data, candidate).length > 0) return;
          state.data = candidate;
          markModified(state);
        }),

      importEntities: (batch) => {
        let summary = createEmptyImportSummary();
        set((state) => {
          if (!state.data) return;
          const candidate = deepClone(state.data);
          summary = applyProjectImport(candidate, batch);
          const totalAdded = Object.values(summary.added).reduce((sum, count) => sum + count, 0);
          if (totalAdded === 0) return;
          const resolved = applyGridGeometry(candidate);
          const affectedMemberIds = changedMemberIds(state.data, resolved);
          const nextData = finalizeMemberCandidate(
            state.data as ProjectData,
            resolved,
            affectedMemberIds,
          );
          if (!nextData) {
            const rejected = recomputeAssociativeDimensions(constrainProjectOpenings(resolved));
            const newErrors = introducedValidationErrors(state.data, rejected);
            for (const category of Object.keys(summary.added) as Array<keyof typeof summary.added>) {
              summary.skipped[category] += summary.added[category];
              summary.added[category] = 0;
            }
            summary.warnings.push(
              ...(newErrors.length > 0
                ? newErrors.map((issue) => `Import rejected: ${issue.message}`)
                : ['Import rejected: final project validation failed']),
            );
            return;
          }
          state.data = nextData;
          const modelChanged =
            summary.added.materials > 0 ||
            summary.added.sections > 0 ||
            summary.added.grids > 0 ||
            summary.added.members > 0 ||
            summary.added.openings > 0;
          markModified(state, modelChanged);
        });
        return summary;
      },

      deleteEntities: (ids) =>
        set((state) => {
          if (!state.data) return;
          const deletedIds = new Set(ids);
          const invalidatesAnalysis =
            state.data.members.some((member) => deletedIds.has(member.id)) ||
            state.data.openings.some((opening) => deletedIds.has(opening.id));
          if (!deleteEntitiesInProject(state.data, deletedIds)) return;
          state.data = recomputeAssociativeDimensions(state.data);
          markModified(state, invalidatesAnalysis);
        }),

      moveConnectedJoint: (origin, point, storyId, tolerance = JOINT_MERGE_TOLERANCE) =>
        set((state) => {
          if (!state.data || tolerance < 0 || !Number.isFinite(tolerance)) return;
          const candidate = deepClone(state.data);
          if (!moveConnectedJointInProject(candidate, origin, point, storyId, tolerance)) return;
          const affectedMemberIds = changedMemberIds(state.data, candidate);
          const finalized = finalizeMemberCandidate(
            state.data as ProjectData,
            candidate,
            affectedMemberIds,
          );
          if (!finalized) return;
          state.data = finalized;
          markModified(state, true);
        }),

      // ── Generic delete ──

      deleteById: (id) => useProjectStore.getState().deleteEntities([id]),
    })),
    {
      partialize: (state) => ({
        data: state.data,
        currentRevision: state.currentRevision,
      }),
      equality: (pastState, currentState) =>
        pastState.currentRevision === currentState.currentRevision,
      limit: 100,
    },
  ),
);

// zundo restores only document data + the revision token. Keep the user-facing
// dirty flag derived from that undoable token and the non-undoable save point.
useProjectStore.subscribe((state) => {
  const isDirty = state.currentRevision !== state.savedRevision;
  if (state.isDirty !== isDirty) useProjectStore.setState({ isDirty });
});
