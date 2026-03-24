import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import { v4 as uuidv4 } from 'uuid';
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
  PlanView,
} from '@/domain/structural/types';

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

  // Annotation operations
  addAnnotation: (annotation: Annotation) => void;
  addAnnotations: (annotations: Annotation[]) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;

  // Dimension operations
  addDimension: (dimension: Dimension) => void;
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

  // Master operations
  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string) => void;
  addSection: (section: Section) => void;
  updateSection: (id: string, updates: Partial<Section>) => void;
  deleteSection: (id: string) => void;
  addPlanSheet: (storyId: string) => string | null;
  updateSheet: (id: string, updates: Partial<Sheet>) => void;

  // Generic delete by id (from any collection)
  deleteById: (id: string) => void;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureUniqueId(existingIds: Set<string>, preferred: string): string {
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

function createDefaultPlanView(storyId: string): PlanView {
  return {
    id: `VIEW-${storyId}-PLAN`,
    type: 'plan',
    story: storyId,
    center: { x: 4000, y: 3000 },
    width: 14000,
    height: 11000,
    rotation: 0,
  };
}

function createDefaultSheet(projectName: string, storyId: string, viewId: string, index = 1): Sheet {
  return {
    id: `S-${String(index).padStart(3, '0')}`,
    name: `${storyId}平面図`,
    paperSize: 'A1',
    scale: '1:100',
    viewIds: [viewId],
    titleBlockTemplate: 'standard',
    titleBlock: {
      projectName,
      drawingTitle: `${storyId}平面図`,
      issueDate: new Date().toISOString().slice(0, 10),
    },
  };
}

function createEmptyProject(): ProjectData {
  const defaultStoryId = '1F';
  const defaultView = createDefaultPlanView(defaultStoryId);
  return {
    schemaVersion: '1.0.0',
    project: { id: uuidv4(), name: 'New Project', unit: 'mm' },
    stories: [{ id: defaultStoryId, name: defaultStoryId, elevation: 0, height: 3000 }],
    grids: [],
    materials: [{ id: 'MAT-RC-24', name: 'RC Fc24', type: 'concrete' }],
    sections: [
      { id: 'SEC-C600', kind: 'rc_column_rect', width: 600, depth: 600 },
      { id: 'SEC-B300x600', kind: 'rc_beam_rect', width: 300, depth: 600 },
      { id: 'SEC-SLAB180', kind: 'rc_slab', thickness: 180 },
      { id: 'SEC-WALL200', kind: 'rc_wall', thickness: 200 },
    ],
    members: [],
    openings: [],
    annotations: [],
    dimensions: [],
    sheets: [createDefaultSheet('New Project', defaultStoryId, defaultView.id)],
    views: [defaultView],
    issues: [],
  };
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
          const member = state.data.members.find((m) => m.id === id);
          if (!member) return;
          if (member.type === 'slab') {
            for (const p of member.polygon) {
              p.x += dx;
              p.y += dy;
            }
          } else {
            member.start.x += dx;
            member.start.y += dy;
            member.end.x += dx;
            member.end.y += dy;
          }
          state.isDirty = true;
        }),

      duplicateMember: (id) => {
        let newId: string | null = null;
        set((state) => {
          if (!state.data) return;
          const member = state.data.members.find((m) => m.id === id);
          if (!member) return;
          newId = uuidv4();
          const clone = JSON.parse(JSON.stringify(member)) as Member;
          (clone as Member).id = newId;
          state.data.members.push(clone);
          state.isDirty = true;
        });
        return newId;
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
          const sourceStory = state.data.stories.find((item) => item.id === sourceId);
          if (!sourceStory) return;

          const storyIds = new Set(state.data.stories.map((item) => item.id));
          const nextStoryId = ensureUniqueId(storyIds, story.id);
          const elevationDelta = story.elevation - sourceStory.elevation;
          const nextStory: Story = { ...story, id: nextStoryId };
          state.data.stories.push(nextStory);

          const memberIds = new Set(state.data.members.map((item) => item.id));
          const openingIds = new Set(state.data.openings.map((item) => item.id));
          const annotationIds = new Set(state.data.annotations.map((item) => item.id));
          const dimensionIds = new Set(state.data.dimensions.map((item) => item.id));
          const viewIds = new Set(state.data.views.map((item) => item.id));
          const sheetIds = new Set(state.data.sheets.map((item) => item.id));

          const memberIdMap = new Map<string, string>();
          for (const member of state.data.members.filter((item) => item.story === sourceId)) {
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
            state.data.members.push(clone);
          }

          for (const opening of state.data.openings.filter((item) => memberIdMap.has(item.memberId))) {
            const clone = deepClone(opening);
            const preferredId = replaceStoryScopedText(opening.id, sourceId, nextStoryId);
            clone.id = ensureUniqueId(openingIds, preferredId);
            openingIds.add(clone.id);
            clone.memberId = memberIdMap.get(opening.memberId) ?? opening.memberId;
            clone.position.z += elevationDelta;
            state.data.openings.push(clone);
          }

          for (const annotation of state.data.annotations.filter((item) => item.story === sourceId)) {
            const clone = deepClone(annotation);
            const preferredId = replaceStoryScopedText(annotation.id, sourceId, nextStoryId);
            clone.id = ensureUniqueId(annotationIds, preferredId);
            annotationIds.add(clone.id);
            clone.story = nextStoryId;
            state.data.annotations.push(clone);
          }

          for (const dimension of state.data.dimensions.filter((item) => item.story === sourceId)) {
            const clone = deepClone(dimension);
            const preferredId = replaceStoryScopedText(dimension.id, sourceId, nextStoryId);
            clone.id = ensureUniqueId(dimensionIds, preferredId);
            dimensionIds.add(clone.id);
            clone.story = nextStoryId;
            state.data.dimensions.push(clone);
          }

          const viewIdMap = new Map<string, string>();
          for (const view of state.data.views.filter((item) => item.story === sourceId)) {
            const clone = deepClone(view);
            const preferredId = replaceStoryScopedText(view.id, sourceId, nextStoryId);
            clone.id = ensureUniqueId(viewIds, preferredId);
            viewIds.add(clone.id);
            clone.story = nextStoryId;
            viewIdMap.set(view.id, clone.id);
            state.data.views.push(clone);
          }

          for (const sheet of state.data.sheets.filter((item) => item.viewIds.some((viewId) => viewIdMap.has(viewId)))) {
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
            state.data.sheets.push(clone);
          }

          newId = nextStoryId;
          state.isDirty = true;
        });
        return newId;
      },

      // ── Grids ──

      addGrid: (grid) =>
        set((state) => {
          if (!state.data) return;
          state.data.grids.push(grid);
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

      // ── Generic delete ──

      deleteById: (id) =>
        set((state) => {
          if (!state.data) return;
          state.data.members = state.data.members.filter((m) => m.id !== id);
          state.data.openings = state.data.openings.filter((o) => o.id !== id && o.memberId !== id);
          state.data.annotations = state.data.annotations.filter((a) => a.id !== id);
          state.data.dimensions = state.data.dimensions.filter((d) => d.id !== id);
          state.isDirty = true;
        }),
    })),
    {
      equality: (pastState, currentState) => pastState.data === currentState.data,
      limit: 100,
    },
  ),
);
