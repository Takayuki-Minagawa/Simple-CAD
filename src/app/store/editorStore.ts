import { create } from 'zustand';
import type { ColumnPlacementDirection } from '@/domain/structural/placement';

export type EditorTool =
  | 'select'
  | 'pan'
  | 'column'
  | 'beam'
  | 'wall'
  | 'slab'
  | 'dimension'
  | 'annotation'
  | 'trim'
  | 'extend'
  | 'xline'
  | 'spline';

export type SnapMode = 'grid' | 'endpoint' | 'midpoint' | 'intersection' | 'perpendicular' | 'nearest';

export const LAYER_NAMES = [
  'grid',
  'member-column',
  'member-beam',
  'member-wall',
  'member-slab',
  'opening',
  'dimension',
  'annotation',
  'construction',
] as const;

export type LayerName = (typeof LAYER_NAMES)[number];

export type ThemeMode = 'light' | 'dark';

export function isCreationTool(tool: EditorTool): boolean {
  return tool !== 'select' && tool !== 'pan' && tool !== 'trim' && tool !== 'extend';
}

interface EditorState {
  // Theme
  theme: ThemeMode;

  // View mode
  viewMode: '2d' | '3d';
  activeStory: string | null;

  // Selection
  selectedIds: string[];

  // Tool
  activeTool: EditorTool;

  // Snap
  snapEnabled: boolean;
  activeSnapModes: SnapMode[];
  gridSpacing: number;
  drawInputAssist: boolean;
  snapToMembersWhileDrawing: boolean;
  columnPlacementDirection: ColumnPlacementDirection;

  // 2D viewport
  pan: { x: number; y: number };
  zoom: number;

  // Cursor world position
  cursorWorld: { x: number; y: number } | null;

  // Layer visibility
  layerVisibility: Record<string, boolean>;

  // Layer lock
  layerLocked: Record<string, boolean>;

  // 3D options
  wireframe: boolean;
  orthographic: boolean;

  // Actions
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setViewMode: (mode: '2d' | '3d') => void;
  setActiveStory: (storyId: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  setActiveTool: (tool: EditorTool) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setDrawInputAssist: (enabled: boolean) => void;
  setSnapToMembersWhileDrawing: (enabled: boolean) => void;
  setColumnPlacementDirection: (direction: ColumnPlacementDirection) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  setCursorWorld: (pos: { x: number; y: number } | null) => void;
  toggleLayerVisibility: (layer: string) => void;
  setLayerLocked: (layer: string, locked: boolean) => void;
  setWireframe: (on: boolean) => void;
  setOrthographic: (on: boolean) => void;
  zoomToFit: (bounds: { minX: number; minY: number; maxX: number; maxY: number }, viewportWidth: number, viewportHeight: number) => void;
}

const defaultLayerVisibility: Record<string, boolean> = {};
for (const name of LAYER_NAMES) {
  defaultLayerVisibility[name] = true;
}

export const useEditorStore = create<EditorState>()((set) => ({
  theme: (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') as ThemeMode,
  viewMode: '2d',
  activeStory: null,
  selectedIds: [],
  activeTool: 'select',
  snapEnabled: true,
  activeSnapModes: ['grid', 'endpoint', 'midpoint', 'intersection'],
  gridSpacing: 1000,
  drawInputAssist: true,
  snapToMembersWhileDrawing: false,
  columnPlacementDirection: 'down',
  pan: { x: 0, y: 0 },
  zoom: 0.05,
  cursorWorld: null,
  layerVisibility: { ...defaultLayerVisibility },
  layerLocked: {},
  wireframe: false,
  orthographic: true,

  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveStory: (storyId) => set({ activeStory: storyId }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  toggleSelection: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((i) => i !== id)
        : [...state.selectedIds, id],
    })),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  setDrawInputAssist: (enabled) => set({ drawInputAssist: enabled }),
  setSnapToMembersWhileDrawing: (enabled) => set({ snapToMembersWhileDrawing: enabled }),
  setColumnPlacementDirection: (direction) => set({ columnPlacementDirection: direction }),
  setPan: (pan) => set({ pan }),
  setZoom: (zoom) => set({ zoom: Math.max(0.001, Math.min(10, zoom)) }),
  setCursorWorld: (pos) => set({ cursorWorld: pos }),
  toggleLayerVisibility: (layer) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layer]: !state.layerVisibility[layer],
      },
    })),
  setLayerLocked: (layer, locked) =>
    set((state) => ({
      layerLocked: {
        ...state.layerLocked,
        [layer]: locked,
      },
    })),
  setWireframe: (on) => set({ wireframe: on }),
  setOrthographic: (on) => set({ orthographic: on }),
  zoomToFit: (bounds, viewportWidth, viewportHeight) => {
    const padding = 0.1;
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    if (contentWidth <= 0 && contentHeight <= 0) return;
    const zoomX = contentWidth > 0 ? viewportWidth / (contentWidth * (1 + padding)) : 10;
    const zoomY = contentHeight > 0 ? viewportHeight / (contentHeight * (1 + padding)) : 10;
    const zoom = Math.max(0.001, Math.min(10, Math.min(zoomX, zoomY)));
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    set({
      zoom,
      pan: {
        x: viewportWidth / 2 - centerX * zoom,
        y: viewportHeight / 2 + centerY * zoom, // Y is flipped in SVG
      },
    });
  },
}));
