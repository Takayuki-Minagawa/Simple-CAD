import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import { collectAllIds, generateId } from '@/domain/idGenerator';
import type { Point2D } from '@/domain/geometry/types';
import type {
  ProjectData,
  Member,
  Annotation,
  Dimension,
  Story,
  Grid,
  Opening,
  Material,
  Section,
  Sheet,
  Group,
  ConstructionLine,
  ExternalRef,
  Viewport,
  LoadCase,
} from '@/domain/structural/types';
import { applyGridGeometry } from '@/domain/structural/gridResolve';
import { recomputeAssociativeDimensions } from '@/domain/structural/associativeDimension';
import {
  duplicateSelection,
  scaleSelection,
  stretchSelection,
  translateSelection,
  offsetSelection,
  mirrorSelection,
  arraySelection,
  type StretchSelectionOptions,
  type ArraySelectionOptions,
} from '@/domain/structural/editTransform';
import { trimMember as trimMemberFn, extendMember as extendMemberFn, filletWalls as filletWallsFn } from '@/domain/structural/editTrim';
import { createDefaultPlanView, createDefaultSheet, createEmptyProject } from './projectFactories';
import { ensureUniqueId, duplicateStoryInProject } from './storyRename';

export interface ProjectState {
  data: ProjectData | null;
  isDirty: boolean;
  fileHandle: FileSystemFileHandle | null;

  // Project operations
  loadProject: (data: ProjectData) => void;
  newProject: () => void;
  setFileHandle: (handle: FileSystemFileHandle | null) => void;
  markClean: () => void;

  // Member operations
  addMember: (member: Member) => void;
  updateMember: (id: string, updates: Partial<Member>) => void;
  deleteMember: (id: string) => void;
  moveMember: (id: string, dx: number, dy: number) => void;
  duplicateMember: (id: string) => string | null;
  translateEntities: (ids: string[], dx: number, dy: number) => void;
  duplicateEntities: (ids: string[], dx: number, dy: number, count?: number) => string[];
  scaleEntities: (ids: string[], origin: Point2D, scaleX: number, scaleY: number) => void;
  stretchEntities: (ids: string[], options: StretchSelectionOptions) => void;
  offsetEntities: (ids: string[], distance: number) => string[];
  mirrorEntities: (ids: string[], axisStart: Point2D, axisEnd: Point2D, copy: boolean) => string[];
  arrayEntities: (ids: string[], options: ArraySelectionOptions) => string[];

  // Annotation operations
  addAnnotation: (annotation: Annotation) => void;
  addAnnotations: (annotations: Annotation[]) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;

  // Dimension operations
  addDimension: (dimension: Dimension) => void;
  updateDimension: (id: string, updates: Partial<Dimension>) => void;
  deleteDimension: (id: string) => void;

  // Opening operations
  addOpening: (opening: Opening) => void;
  deleteOpening: (id: string) => void;

  // Story operations
  addStory: (story: Story) => void;
  updateStory: (id: string, updates: Partial<Story>) => void;
  duplicateStory: (sourceId: string, story: Story) => string | null;

  // Grid operations
  addGrid: (grid: Grid) => void;
  updateGrid: (id: string, updates: Partial<Grid>) => void;
  deleteGrid: (id: string) => void;

  // Load case operations
  addLoadCase: (loadCase: LoadCase) => void;
  updateLoadCase: (id: string, updates: Partial<LoadCase>) => void;
  deleteLoadCase: (id: string) => void;

  // Master operations
  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string) => void;
  addSection: (section: Section) => void;
  updateSection: (id: string, updates: Partial<Section>) => void;
  deleteSection: (id: string) => void;
  addPlanSheet: (storyId: string) => string | null;
  updateSheet: (id: string, updates: Partial<Sheet>) => void;

  // Trim/Extend operations
  trimMember: (memberId: string, cutPoint: Point2D, side: 'start' | 'end') => boolean;
  extendMember: (memberId: string, targetMemberId: string) => boolean;
  filletWalls: (wallId1: string, wallId2: string, radius?: number) => boolean;

  // Slab vertex editing
  updateSlabVertex: (memberId: string, vertexIndex: number, point: Point2D) => void;
  addSlabVertex: (memberId: string, afterIndex: number) => void;
  removeSlabVertex: (memberId: string, vertexIndex: number) => void;

  // Grouping
  createGroup: (ids: string[], name: string) => string | null;
  ungroupSelection: (groupId: string) => void;

  // Construction Lines
  addConstructionLine: (cl: ConstructionLine) => void;
  deleteConstructionLine: (id: string) => void;

  // External References
  addExternalRef: (ref: ExternalRef) => void;
  removeExternalRef: (id: string) => void;
  toggleExternalRefVisibility: (id: string) => void;

  // Viewports
  addViewport: (viewport: Viewport) => void;
  updateViewport: (id: string, updates: Partial<Viewport>) => void;
  removeViewport: (id: string) => void;

  // Generic delete by id (from any collection)
  deleteById: (id: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  temporal(
    immer((set) => ({
      data: null,
      isDirty: false,
      fileHandle: null,

      loadProject: (data) =>
        set((state) => {
          state.data = data;
          state.isDirty = false;
          state.fileHandle = null;
        }),

      newProject: () =>
        set((state) => {
          state.data = createEmptyProject();
          state.isDirty = false;
          state.fileHandle = null;
        }),

      setFileHandle: (handle) =>
        set((state) => {
          state.fileHandle = handle;
        }),

      markClean: () =>
        set((state) => {
          state.isDirty = false;
        }),

      // ── Members ──

      addMember: (member) =>
        set((state) => {
          if (!state.data) return;
          state.data.members.push(member);
          state.isDirty = true;
        }),

      updateMember: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          const idx = state.data.members.findIndex((m) => m.id === id);
          if (idx < 0) return;
          Object.assign(state.data.members[idx], updates);
          // Associative dimensions follow the edited member.
          state.data = recomputeAssociativeDimensions(state.data);
          state.isDirty = true;
        }),

      deleteMember: (id) =>
        set((state) => {
          if (!state.data) return;
          state.data.members = state.data.members.filter((m) => m.id !== id);
          // Also remove associated openings
          state.data.openings = state.data.openings.filter((o) => o.memberId !== id);
          state.isDirty = true;
        }),

      moveMember: (id, dx, dy) =>
        set((state) => {
          if (!state.data) return;
          translateSelection(state.data, [id], dx, dy);
          state.data = recomputeAssociativeDimensions(state.data);
          state.isDirty = true;
        }),

      duplicateMember: (id) => {
        let newId: string | null = null;
        set((state) => {
          if (!state.data) return;
          const createdIds = duplicateSelection(state.data, [id], { dx: 0, dy: 0, count: 1 });
          newId = createdIds[0] ?? null;
          state.isDirty = true;
        });
        return newId;
      },

      translateEntities: (ids, dx, dy) =>
        set((state) => {
          if (!state.data || ids.length === 0) return;
          translateSelection(state.data, ids, dx, dy);
          state.data = recomputeAssociativeDimensions(state.data);
          state.isDirty = true;
        }),

      duplicateEntities: (ids, dx, dy, count = 1) => {
        let createdIds: string[] = [];
        set((state) => {
          if (!state.data || ids.length === 0) return;
          createdIds = duplicateSelection(state.data, ids, { dx, dy, count });
          state.isDirty = true;
        });
        return createdIds;
      },

      scaleEntities: (ids, origin, scaleX, scaleY) =>
        set((state) => {
          if (!state.data || ids.length === 0) return;
          scaleSelection(state.data, ids, origin, scaleX, scaleY);
          state.isDirty = true;
        }),

      stretchEntities: (ids, options) =>
        set((state) => {
          if (!state.data || ids.length === 0) return;
          stretchSelection(state.data, ids, options);
          state.data = recomputeAssociativeDimensions(state.data);
          state.isDirty = true;
        }),

      offsetEntities: (ids, distance) => {
        let createdIds: string[] = [];
        set((state) => {
          if (!state.data || ids.length === 0) return;
          createdIds = offsetSelection(state.data, ids, distance);
          state.isDirty = true;
        });
        return createdIds;
      },

      mirrorEntities: (ids, axisStart, axisEnd, copy) => {
        let createdIds: string[] = [];
        set((state) => {
          if (!state.data || ids.length === 0) return;
          createdIds = mirrorSelection(state.data, ids, axisStart, axisEnd, copy);
          state.isDirty = true;
        });
        return createdIds;
      },

      arrayEntities: (ids, options) => {
        let createdIds: string[] = [];
        set((state) => {
          if (!state.data || ids.length === 0) return;
          createdIds = arraySelection(state.data, ids, options);
          state.isDirty = true;
        });
        return createdIds;
      },

      // ── Annotations ──

      addAnnotation: (annotation) =>
        set((state) => {
          if (!state.data) return;
          state.data.annotations.push(annotation);
          state.isDirty = true;
        }),

      addAnnotations: (annotations) =>
        set((state) => {
          if (!state.data || annotations.length === 0) return;
          state.data.annotations.push(...annotations);
          state.isDirty = true;
        }),

      updateAnnotation: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          const idx = state.data.annotations.findIndex((a) => a.id === id);
          if (idx < 0) return;
          Object.assign(state.data.annotations[idx], updates);
          state.isDirty = true;
        }),

      deleteAnnotation: (id) =>
        set((state) => {
          if (!state.data) return;
          state.data.annotations = state.data.annotations.filter((a) => a.id !== id);
          state.isDirty = true;
        }),

      // ── Dimensions ──

      addDimension: (dimension) =>
        set((state) => {
          if (!state.data) return;
          state.data.dimensions.push(dimension);
          state.isDirty = true;
        }),

      updateDimension: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          const idx = state.data.dimensions.findIndex((d) => d.id === id);
          if (idx < 0) return;
          Object.assign(state.data.dimensions[idx], updates);
          state.isDirty = true;
        }),

      deleteDimension: (id) =>
        set((state) => {
          if (!state.data) return;
          state.data.dimensions = state.data.dimensions.filter((d) => d.id !== id);
          state.isDirty = true;
        }),

      // ── Openings ──

      addOpening: (opening) =>
        set((state) => {
          if (!state.data) return;
          state.data.openings.push(opening);
          state.isDirty = true;
        }),

      deleteOpening: (id) =>
        set((state) => {
          if (!state.data) return;
          state.data.openings = state.data.openings.filter((o) => o.id !== id);
          state.isDirty = true;
        }),

      // ── Stories ──

      addStory: (story) =>
        set((state) => {
          if (!state.data) return;
          state.data.stories.push(story);
          state.isDirty = true;
        }),

      updateStory: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          const story = state.data.stories.find((item) => item.id === id);
          if (!story) return;
          Object.assign(story, updates);
          state.isDirty = true;
        }),

      duplicateStory: (sourceId, story) => {
        let newId: string | null = null;
        set((state) => {
          if (!state.data) return;
          newId = duplicateStoryInProject(state.data, sourceId, story);
          if (newId === null) return;
          state.isDirty = true;
        });
        return newId;
      },

      // ── Grids ──

      addGrid: (grid) =>
        set((state) => {
          if (!state.data) return;
          state.data.grids.push(grid);
          // Re-resolve gridRef-pinned members against the new grid set.
          state.data = applyGridGeometry(state.data);
          state.isDirty = true;
        }),

      updateGrid: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          const grid = state.data.grids.find((item) => item.id === id);
          if (!grid) return;
          Object.assign(grid, updates);
          // Editing a grid's position/axis/name moves pinned members.
          state.data = applyGridGeometry(state.data);
          state.isDirty = true;
        }),

      deleteGrid: (id) =>
        set((state) => {
          if (!state.data) return;
          state.data.grids = state.data.grids.filter((item) => item.id !== id);
          state.data = applyGridGeometry(state.data);
          state.isDirty = true;
        }),

      // ── Load cases ──

      addLoadCase: (loadCase) =>
        set((state) => {
          if (!state.data) return;
          if (!state.data.loadCases) state.data.loadCases = [];
          state.data.loadCases.push(loadCase);
          state.isDirty = true;
        }),

      updateLoadCase: (id, updates) =>
        set((state) => {
          if (!state.data || !state.data.loadCases) return;
          const loadCase = state.data.loadCases.find((item) => item.id === id);
          if (!loadCase) return;
          Object.assign(loadCase, updates);
          state.isDirty = true;
        }),

      deleteLoadCase: (id) =>
        set((state) => {
          if (!state.data || !state.data.loadCases) return;
          state.data.loadCases = state.data.loadCases.filter((item) => item.id !== id);
          state.isDirty = true;
        }),

      // ── Masters ──

      addMaterial: (material) =>
        set((state) => {
          if (!state.data) return;
          state.data.materials.push(material);
          state.isDirty = true;
        }),

      updateMaterial: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          const material = state.data.materials.find((item) => item.id === id);
          if (!material) return;
          Object.assign(material, updates);
          state.isDirty = true;
        }),

      deleteMaterial: (id) =>
        set((state) => {
          if (!state.data) return;
          if (state.data.members.some((m) => m.materialId === id)) return;
          state.data.materials = state.data.materials.filter((item) => item.id !== id);
          state.isDirty = true;
        }),

      addSection: (section) =>
        set((state) => {
          if (!state.data) return;
          state.data.sections.push(section);
          state.isDirty = true;
        }),

      updateSection: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          const section = state.data.sections.find((item) => item.id === id);
          if (!section) return;
          Object.assign(section, updates);
          state.isDirty = true;
        }),

      deleteSection: (id) =>
        set((state) => {
          if (!state.data) return;
          if (state.data.members.some((m) => m.sectionId === id)) return;
          state.data.sections = state.data.sections.filter((item) => item.id !== id);
          state.isDirty = true;
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
          nextSheet.name = ensureUniqueId(new Set(state.data.sheets.map((item) => item.name)), nextSheet.name);
          state.data.sheets.push(nextSheet);
          state.isDirty = true;
          newId = nextSheet.id;
        });
        return newId;
      },

      updateSheet: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          const sheet = state.data.sheets.find((item) => item.id === id);
          if (!sheet) return;
          Object.assign(sheet, updates);
          state.isDirty = true;
        }),

      // ── Trim/Extend ──

      trimMember: (memberId, cutPoint, side) => {
        let result = false;
        set((state) => {
          if (!state.data) return;
          result = trimMemberFn(state.data, memberId, cutPoint, side);
          if (result) state.isDirty = true;
        });
        return result;
      },

      extendMember: (memberId, targetMemberId) => {
        let result = false;
        set((state) => {
          if (!state.data) return;
          result = extendMemberFn(state.data, memberId, targetMemberId);
          if (result) state.isDirty = true;
        });
        return result;
      },

      filletWalls: (wallId1, wallId2, radius = 0) => {
        let result = false;
        set((state) => {
          if (!state.data) return;
          result = filletWallsFn(state.data, wallId1, wallId2, radius);
          if (result) state.isDirty = true;
        });
        return result;
      },

      // ── Slab Vertex Editing ──

      updateSlabVertex: (memberId, vertexIndex, point) =>
        set((state) => {
          if (!state.data) return;
          const member = state.data.members.find((m) => m.id === memberId);
          if (!member || member.type !== 'slab') return;
          if (vertexIndex < 0 || vertexIndex >= member.polygon.length) return;
          member.polygon[vertexIndex] = { x: point.x, y: point.y };
          state.isDirty = true;
        }),

      addSlabVertex: (memberId, afterIndex) =>
        set((state) => {
          if (!state.data) return;
          const member = state.data.members.find((m) => m.id === memberId);
          if (!member || member.type !== 'slab') return;
          const n = member.polygon.length;
          if (afterIndex < 0 || afterIndex >= n) return;
          const nextIndex = (afterIndex + 1) % n;
          const midpoint = {
            x: (member.polygon[afterIndex].x + member.polygon[nextIndex].x) / 2,
            y: (member.polygon[afterIndex].y + member.polygon[nextIndex].y) / 2,
          };
          member.polygon.splice(afterIndex + 1, 0, midpoint);
          state.isDirty = true;
        }),

      removeSlabVertex: (memberId, vertexIndex) =>
        set((state) => {
          if (!state.data) return;
          const member = state.data.members.find((m) => m.id === memberId);
          if (!member || member.type !== 'slab') return;
          if (member.polygon.length <= 3) return; // minimum 3 vertices
          if (vertexIndex < 0 || vertexIndex >= member.polygon.length) return;
          member.polygon.splice(vertexIndex, 1);
          state.isDirty = true;
        }),

      // ── Grouping ──

      createGroup: (ids, name) => {
        let groupId: string | null = null;
        set((state) => {
          if (!state.data || ids.length === 0) return;
          if (!state.data.groups) state.data.groups = [];
          groupId = generateId('grp', collectAllIds(state.data));
          const group: Group = { id: groupId, name, memberIds: [...ids] };
          state.data.groups.push(group);
          state.isDirty = true;
        });
        return groupId;
      },

      ungroupSelection: (groupId) =>
        set((state) => {
          if (!state.data || !state.data.groups) return;
          state.data.groups = state.data.groups.filter((g) => g.id !== groupId);
          state.isDirty = true;
        }),

      // ── Construction Lines ──

      addConstructionLine: (cl) =>
        set((state) => {
          if (!state.data) return;
          if (!state.data.constructionLines) state.data.constructionLines = [];
          state.data.constructionLines.push(cl);
          state.isDirty = true;
        }),

      deleteConstructionLine: (id) =>
        set((state) => {
          if (!state.data || !state.data.constructionLines) return;
          state.data.constructionLines = state.data.constructionLines.filter((cl) => cl.id !== id);
          state.isDirty = true;
        }),

      // ── External References ──

      addExternalRef: (ref) =>
        set((state) => {
          if (!state.data) return;
          if (!state.data.externalRefs) state.data.externalRefs = [];
          state.data.externalRefs.push(ref);
          state.isDirty = true;
        }),

      removeExternalRef: (id) =>
        set((state) => {
          if (!state.data || !state.data.externalRefs) return;
          state.data.externalRefs = state.data.externalRefs.filter((r) => r.id !== id);
          state.isDirty = true;
        }),

      toggleExternalRefVisibility: (id) =>
        set((state) => {
          if (!state.data || !state.data.externalRefs) return;
          const ref = state.data.externalRefs.find((r) => r.id === id);
          if (ref) ref.visible = !ref.visible;
          state.isDirty = true;
        }),

      // ── Viewports ──

      addViewport: (viewport) =>
        set((state) => {
          if (!state.data) return;
          const sheet = state.data.sheets.find((s) => s.id === viewport.sheetId);
          if (!sheet) return;
          if (!sheet.viewports) sheet.viewports = [];
          sheet.viewports.push(viewport);
          state.isDirty = true;
        }),

      updateViewport: (id, updates) =>
        set((state) => {
          if (!state.data) return;
          for (const sheet of state.data.sheets) {
            if (!sheet.viewports) continue;
            const vp = sheet.viewports.find((v) => v.id === id);
            if (vp) {
              Object.assign(vp, updates);
              state.isDirty = true;
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
              state.isDirty = true;
              return;
            }
          }
        }),

      // ── Generic delete ──

      deleteById: (id) =>
        set((state) => {
          if (!state.data) return;
          state.data.members = state.data.members.filter((m) => m.id !== id);
          state.data.openings = state.data.openings.filter((o) => o.id !== id && o.memberId !== id);
          state.data.annotations = state.data.annotations.filter((a) => a.id !== id);
          state.data.dimensions = state.data.dimensions.filter((d) => d.id !== id);
          if (state.data.constructionLines) {
            state.data.constructionLines = state.data.constructionLines.filter((cl) => cl.id !== id);
          }
          state.isDirty = true;
        }),
    })),
    {
      equality: (pastState, currentState) => pastState.data === currentState.data,
      limit: 100,
    },
  ),
);
