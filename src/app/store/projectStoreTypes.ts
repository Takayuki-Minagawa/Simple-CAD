import type { Point2D } from '@/domain/geometry/types';
import type {
  Annotation,
  ConstructionLine,
  Dimension,
  ExternalRef,
  Grid,
  LoadCase,
  Material,
  Member,
  Opening,
  ProjectData,
  Section,
  Sheet,
  Story,
  Viewport,
} from '@/domain/structural/types';
import type {
  ArraySelectionOptions,
  StretchSelectionOptions,
} from '@/domain/structural/editTransform';

export interface ProjectState {
  data: ProjectData | null;
  isDirty: boolean;
  fileHandle: FileSystemFileHandle | null;
  /** Undoable identity of the current document revision. */
  currentRevision: number;
  /** Non-undoable revision recorded by the most recent successful save/load. */
  savedRevision: number;
  /** Changes only when the whole document is replaced, never for normal edits/undo. */
  documentGeneration: number;

  loadProject: (data: ProjectData) => void;
  newProject: () => void;
  setFileHandle: (handle: FileSystemFileHandle | null) => void;
  markClean: () => void;

  addMember: (member: Member) => void;
  updateMember: (id: string, updates: Partial<Member>) => void;
  updateMembers: (ids: string[], updates: Partial<Member>) => void;
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

  addAnnotation: (annotation: Annotation) => void;
  addAnnotations: (annotations: Annotation[]) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;

  addDimension: (dimension: Dimension) => void;
  updateDimension: (id: string, updates: Partial<Dimension>) => void;
  deleteDimension: (id: string) => void;

  addOpening: (opening: Opening) => void;
  updateOpening: (id: string, updates: Partial<Opening>) => void;
  deleteOpening: (id: string) => void;

  addStory: (story: Story) => void;
  updateStory: (id: string, updates: Partial<Story>) => void;
  updateStories: (updates: Array<{ id: string; updates: Partial<Story> }>) => void;
  duplicateStory: (sourceId: string, story: Story) => string | null;
  deleteStory: (id: string) => boolean;
  reorderStories: (orderedIds: string[], chainElevations?: boolean) => void;

  addGrid: (grid: Grid) => void;
  updateGrid: (id: string, updates: Partial<Grid>) => void;
  deleteGrid: (id: string) => void;

  addLoadCase: (loadCase: LoadCase) => void;
  updateLoadCase: (id: string, updates: Partial<LoadCase>) => void;
  deleteLoadCase: (id: string) => void;

  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string) => void;
  addSection: (section: Section) => void;
  updateSection: (id: string, updates: Partial<Section>) => void;
  deleteSection: (id: string) => void;
  addPlanSheet: (storyId: string) => string | null;
  updateSheet: (id: string, updates: Partial<Sheet>) => void;
  deleteSheet: (id: string) => boolean;
  reorderSheets: (orderedIds: string[]) => void;

  trimMember: (memberId: string, cutPoint: Point2D, side: 'start' | 'end') => boolean;
  extendMember: (memberId: string, targetMemberId: string) => boolean;
  filletWalls: (wallId1: string, wallId2: string, radius?: number) => boolean;

  updateSlabVertex: (memberId: string, vertexIndex: number, point: Point2D) => void;
  addSlabVertex: (memberId: string, afterIndex: number) => void;
  removeSlabVertex: (memberId: string, vertexIndex: number) => void;

  createGroup: (ids: string[], name: string) => string | null;
  ungroupSelection: (groupId: string) => void;

  addConstructionLine: (cl: ConstructionLine) => void;
  deleteConstructionLine: (id: string) => void;

  addExternalRef: (ref: ExternalRef) => void;
  removeExternalRef: (id: string) => void;
  toggleExternalRefVisibility: (id: string) => void;

  addViewport: (viewport: Viewport) => void;
  updateViewport: (id: string, updates: Partial<Viewport>) => void;
  removeViewport: (id: string) => void;

  updateAnalysisData: (updates: AnalysisDataPatch) => void;

  /** Apply a file import as one undoable transaction. */
  importEntities: (batch: ProjectImportBatch) => ProjectImportSummary;
  /** Delete many selected entities as one undoable transaction. */
  deleteEntities: (ids: string[]) => void;
  /** Move every linear endpoint sharing a structural joint. */
  moveConnectedJoint: (
    origin: Point2D,
    point: Point2D,
    storyId: string | null,
    tolerance?: number,
  ) => void;
  deleteById: (id: string) => void;
}

export type AnalysisDataPatch = Partial<
  Pick<
    ProjectData,
    | 'supports'
    | 'nodalLoads'
    | 'memberLoads'
    | 'areaLoads'
    | 'loadCombinations'
    | 'masses'
    | 'diaphragms'
    | 'analysisResults'
  >
>;

export interface ProjectImportBatch {
  members?: Member[];
  openings?: Opening[];
  annotations?: Annotation[];
  dimensions?: Dimension[];
  grids?: Grid[];
  materials?: Material[];
  sections?: Section[];
  constructionLines?: ConstructionLine[];
}

export type ProjectImportCategory =
  | 'materials'
  | 'sections'
  | 'grids'
  | 'members'
  | 'openings'
  | 'annotations'
  | 'dimensions'
  | 'constructionLines';

export interface ProjectImportSummary {
  added: Record<ProjectImportCategory, number>;
  skipped: Record<ProjectImportCategory, number>;
  remappedIds: Record<string, string>;
  warnings: string[];
}
