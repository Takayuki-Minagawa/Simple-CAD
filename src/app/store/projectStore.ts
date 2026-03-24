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

  // Grid operations
  addGrid: (grid: Grid) => void;

  // Generic delete by id (from any collection)
  deleteById: (id: string) => void;
}

function createEmptyProject(): ProjectData {
  return {
    schemaVersion: '1.0.0',
    project: { id: uuidv4(), name: 'New Project', unit: 'mm' },
    stories: [{ id: '1F', name: '1F', elevation: 0, height: 3000 }],
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
    sheets: [],
    views: [],
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

      // ── Grids ──

      addGrid: (grid) =>
        set((state) => {
          if (!state.data) return;
          state.data.grids.push(grid);
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
