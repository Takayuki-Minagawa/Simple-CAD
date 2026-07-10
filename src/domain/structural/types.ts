import type { Point2D, Point3D } from '@/domain/geometry/types';

// ── Drawing style types ─────────────────────────────────────

export type LineType = 'solid' | 'dashed' | 'dotted' | 'chain' | 'dashdot';
export type TextAlign = 'left' | 'center' | 'right';

// ── Project Root ─────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
}

export interface ProjectData {
  schemaVersion: string;
  project: ProjectMeta;
  stories: Story[];
  grids: Grid[];
  materials: Material[];
  sections: Section[];
  members: Member[];
  openings: Opening[];
  annotations: Annotation[];
  dimensions: Dimension[];
  sheets: Sheet[];
  views: View[];
  issues?: Issue[];
  groups?: Group[];
  constructionLines?: ConstructionLine[];
  externalRefs?: ExternalRef[];
  loadCases?: LoadCase[];
  supports?: StructuralSupport[];
  nodalLoads?: NodalLoad[];
  memberLoads?: MemberLoad[];
  areaLoads?: AreaLoad[];
  loadCombinations?: LoadCombination[];
  masses?: LumpedMass[];
  diaphragms?: Diaphragm[];
  analysisResults?: AnalysisResultsMetadata;
}

export interface ProjectMeta {
  id: string;
  name: string;
  unit: 'mm';
}

// ── Story ────────────────────────────────────────────────────

export interface Story {
  id: string;
  name: string;
  elevation: number;
  height: number;
  /** Superimposed dead load for floors at this story (kN/m²). */
  deadLoad?: number;
  /** Live load for this story (kN/m²). */
  liveLoad?: number;
}

// ── Grid ─────────────────────────────────────────────────────

export interface Grid {
  id: string;
  axis: 'X' | 'Y';
  name: string;
  position: number;
}

// ── Material ─────────────────────────────────────────────────

export interface MaterialBase {
  id: string;
  name: string;
  type: 'concrete' | 'steel' | 'wood' | 'other';
  // ── Common structural properties (all optional, N/mm² unless noted) ──
  /** Young's modulus E (N/mm²). */
  elasticModulus?: number;
  /** Shear modulus G (N/mm²). */
  shearModulus?: number;
  /** Poisson's ratio (dimensionless). */
  poissonRatio?: number;
  /** Unit weight for self-weight calculation (kN/m³). */
  unitWeight?: number;
}

/** Concrete material. Steel/wood-only properties are intentionally forbidden. */
export type ConcreteMaterial = MaterialBase & {
  type: 'concrete';
  /** Concrete design strength Fc (N/mm²). */
  Fc?: number;
  F?: never;
  Fy?: never;
  referenceStrength?: never;
  moistureContent?: never;
  allowableBendingStress?: never;
  allowableCompressionStress?: never;
  allowableShearStress?: never;
};

/** Steel material. Concrete/wood-only properties are intentionally forbidden. */
export type SteelMaterial = MaterialBase & {
  type: 'steel';
  Fc?: never;
  /** Steel reference/allowable strength F (N/mm²). */
  F?: number;
  /** Steel yield strength Fy (N/mm²). */
  Fy?: number;
  referenceStrength?: never;
  moistureContent?: never;
  allowableBendingStress?: never;
  allowableCompressionStress?: never;
  allowableShearStress?: never;
};

/** Wood material, including moisture and allowable-stress design inputs. */
export type WoodMaterial = MaterialBase & {
  type: 'wood';
  Fc?: never;
  F?: never;
  Fy?: never;
  /** Reference strength (N/mm²). */
  referenceStrength?: number;
  /** Moisture content (%). */
  moistureContent?: number;
  /** Allowable bending stress (N/mm²). */
  allowableBendingStress?: number;
  /** Allowable compression stress parallel to grain (N/mm²). */
  allowableCompressionStress?: number;
  /** Allowable shear stress (N/mm²). */
  allowableShearStress?: number;
};

/** User-defined material. It carries common elastic/weight properties only. */
export type OtherMaterial = MaterialBase & {
  type: 'other';
  Fc?: never;
  F?: never;
  Fy?: never;
  referenceStrength?: never;
  moistureContent?: never;
  allowableBendingStress?: never;
  allowableCompressionStress?: never;
  allowableShearStress?: never;
};

/**
 * Discriminated material union. The `never` fields make mixed concrete,
 * steel, and wood property bags a compile-time error as well as a schema error.
 */
export type Material = ConcreteMaterial | SteelMaterial | WoodMaterial | OtherMaterial;

// ── Load case ────────────────────────────────────────────────

export interface LoadCase {
  id: string;
  name: string;
  type: 'dead' | 'live' | 'snow' | 'wind' | 'seismic' | 'other';
  /** Optional load factor for combinations. */
  factor?: number;
}

// ── Structural analysis model additions ──────────────────────────────

/** Translational/rotational degrees of freedom; true means restrained. */
export interface DofRestraint {
  ux: boolean;
  uy: boolean;
  uz: boolean;
  rx: boolean;
  ry: boolean;
  rz: boolean;
}

/** true means the corresponding member-end degree of freedom is released. */
export type DofRelease = Partial<DofRestraint>;

export interface MemberReleases {
  start?: DofRelease;
  end?: DofRelease;
}

export interface RigidZones {
  /** Rigid-zone length from the start end (mm). */
  start?: number;
  /** Rigid-zone length from the end end (mm). */
  end?: number;
}

export interface LocalAxisDefinition {
  /** Roll angle about the member axis (radians). */
  rotation: number;
  /** Optional global reference vector used to disambiguate the local y-axis. */
  referenceVector?: Point3D;
}

export interface StructuralSupport {
  id: string;
  storyId: string;
  position: Point3D;
  restraints: DofRestraint;
}

export interface LoadVector3D {
  x: number;
  y: number;
  z: number;
}

export interface NodalLoad {
  id: string;
  loadCaseId: string;
  storyId: string;
  position: Point3D;
  /** Global force components (kN). */
  force: LoadVector3D;
  /** Global moment components (kN·m). */
  moment?: LoadVector3D;
}

export type LoadDirection =
  | 'globalX'
  | 'globalY'
  | 'globalZ'
  | 'localX'
  | 'localY'
  | 'localZ';

export interface MemberLoad {
  id: string;
  loadCaseId: string;
  memberId: string;
  kind: 'point' | 'uniform' | 'trapezoidal';
  direction: LoadDirection;
  /** kN for point load, kN/m for distributed load. */
  magnitude: number;
  /** End intensity for trapezoidal load (kN/m). */
  endMagnitude?: number;
  /** Normalized position along the member, 0=start and 1=end. */
  position?: number;
}

export interface AreaLoad {
  id: string;
  loadCaseId: string;
  memberId: string;
  direction: LoadDirection;
  /** Area load intensity (kN/m²). */
  magnitude: number;
}

export interface LoadCombinationFactor {
  loadCaseId: string;
  factor: number;
}

export interface LoadCombination {
  id: string;
  name: string;
  type: 'linear' | 'envelope';
  factors: LoadCombinationFactor[];
}

export interface LumpedMass {
  id: string;
  storyId: string;
  position: Point3D;
  /** Translational masses (tonne). */
  mass: LoadVector3D;
  /** Rotational mass moments (tonne·m²). */
  rotationalMass?: LoadVector3D;
}

export interface Diaphragm {
  id: string;
  storyId: string;
  type: 'rigid' | 'semiRigid';
  memberIds?: string[];
  masterPosition?: Point3D;
}

export interface AnalysisNodeDisplacement {
  id?: string;
  position: Point3D;
  dx: number;
  dy: number;
  dz: number;
  rx?: number;
  ry?: number;
  rz?: number;
}

export interface AnalysisMemberResult {
  id?: string;
  memberId: string;
  axial?: number;
  shearY?: number;
  shearZ?: number;
  momentY?: number;
  momentZ?: number;
  utilization?: number;
}

export interface AnalysisResultsMetadata {
  source: string;
  solver?: string;
  analysisType: 'static' | 'modal' | 'buckling' | 'timeHistory' | 'other';
  generatedAt: string;
  caseId?: string;
  combinationId?: string;
  deformationScale?: number;
  nodeDisplacements?: AnalysisNodeDisplacement[];
  memberResults?: AnalysisMemberResult[];
  warnings?: string[];
}

// ── Section (discriminated union on kind) ────────────────────

/** Reinforcement specification for RC sections. */
export interface RebarSpec {
  /** Main (longitudinal) bar diameter (mm). */
  mainDiameter?: number;
  /** Number of main bars. */
  mainCount?: number;
  /** Hoop/stirrup bar diameter (mm). */
  hoopDiameter?: number;
  /** Hoop/stirrup spacing (mm). */
  hoopSpacing?: number;
}

export interface RectColumnSection {
  id: string;
  kind: 'rc_column_rect';
  width: number;
  depth: number;
  /** Concrete cover to reinforcement (mm). */
  cover?: number;
  rebar?: RebarSpec;
}

export interface RectBeamSection {
  id: string;
  kind: 'rc_beam_rect';
  width: number;
  depth: number;
  cover?: number;
  rebar?: RebarSpec;
}

export interface SlabSection {
  id: string;
  kind: 'rc_slab';
  thickness: number;
  cover?: number;
  /** Superimposed dead load on this slab (kN/m²). */
  deadLoad?: number;
  /** Live load on this slab (kN/m²). */
  liveLoad?: number;
}

export interface WallSection {
  id: string;
  kind: 'rc_wall';
  thickness: number;
  cover?: number;
}

/** Steel H-shape column. `width`=flange width B, `depth`=overall height H. */
export interface SteelColumnHSection {
  id: string;
  kind: 's_column_h';
  width: number;
  depth: number;
  /** Web thickness tw (mm). */
  tw?: number;
  /** Flange thickness tf (mm). */
  tf?: number;
}

/** Steel H-shape beam. `width`=flange width B, `depth`=overall height H. */
export interface SteelBeamHSection {
  id: string;
  kind: 's_beam_h';
  width: number;
  depth: number;
  tw?: number;
  tf?: number;
}

/** Steel circular hollow section (pipe). */
export interface SteelPipeSection {
  id: string;
  kind: 's_pipe';
  diameter: number;
  /** Wall thickness (mm). */
  thickness: number;
}

export type Section =
  | RectColumnSection
  | RectBeamSection
  | SlabSection
  | WallSection
  | SteelColumnHSection
  | SteelBeamHSection
  | SteelPipeSection;

// ── Member (discriminated union on type) ─────────────────────

/** Reference to grid axes a member is pinned to (axis names, e.g. ["X1","Y2"]). */
export interface GridRef {
  startGrid?: [string, string];
  endGrid?: [string, string];
}

interface MemberBase {
  id: string;
  story: string;
  sectionId: string;
  materialId: string;
  /** Cross-section roll about the member axis (radians). */
  rotation?: number;
  tags?: string[];
  color?: string;
  lineWeight?: number;
  lineType?: LineType;
  /** Grid-axis pinning: when present, geometry can be re-resolved from grids. */
  gridRef?: GridRef;
  /** Axis-line eccentricity in member-local coordinates (mm). */
  axisOffset?: { dx: number; dy: number };
  /** Face alignment relative to the reference axis (wall/beam). */
  faceAlign?: 'center' | 'left' | 'right';
  /** Optional member-end releases for structural analysis. */
  releases?: MemberReleases;
  /** Optional rigid-zone lengths at member ends (mm). */
  rigidZones?: RigidZones;
  /** Explicit local-axis roll/reference definition. */
  localAxis?: LocalAxisDefinition;
}

export interface ColumnMember extends MemberBase {
  type: 'column';
  start: Point3D;
  end: Point3D;
}

export interface BeamMember extends MemberBase {
  type: 'beam';
  start: Point3D;
  end: Point3D;
}

export interface WallMember extends MemberBase {
  type: 'wall';
  start: Point3D;
  end: Point3D;
  height: number;
  thickness: number;
}

export interface SlabMember extends MemberBase {
  type: 'slab';
  polygon: Point2D[];
  level: number;
  fillColor?: string;
  fillOpacity?: number;
}

export type Member = ColumnMember | BeamMember | WallMember | SlabMember;

export type MemberType = Member['type'];

// ── Opening ──────────────────────────────────────────────────

export interface Opening {
  id: string;
  memberId: string;
  type: 'door' | 'window' | 'void';
  position: Point3D;
  width: number;
  height: number;
}

// ── Annotation ───────────────────────────────────────────────

export interface Annotation {
  id: string;
  type: 'text' | 'label' | 'leader' | 'spline';
  story: string;
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  rotation?: number;
  color?: string;
  textAlign?: TextAlign;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  fontFamily?: string;
  points?: Point2D[];
}

// ── Dimension ────────────────────────────────────────────────

export interface Dimension {
  id: string;
  story: string;
  start: Point2D;
  end: Point2D;
  offset: number;
  text?: string;
  color?: string;
  lineWeight?: number;
  lineType?: LineType;
  /** When true, endpoints follow the referenced members on edit. */
  associative?: boolean;
  /** Members this dimension measures (for associative recomputation). */
  refMemberIds?: string[];
}

// ── View ─────────────────────────────────────────────────────

export interface PlanView {
  id: string;
  type: 'plan';
  story: string;
  center: Point2D;
  width: number;
  height: number;
  rotation: number;
}

export interface Model3DView {
  id: string;
  type: 'model3d';
  story: string;
}

export type View = PlanView | Model3DView;

// ── Sheet ────────────────────────────────────────────────────

export type PaperSize = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
export type TitleBlockTemplate = 'standard' | 'compact' | 'minimal';

export interface SheetTitleBlock {
  projectName?: string;
  drawingTitle?: string;
  drawnBy?: string;
  checkedBy?: string;
  issueDate?: string;
  revision?: string;
  note?: string;
}

export interface Sheet {
  id: string;
  name: string;
  paperSize: PaperSize;
  scale: string;
  viewIds: string[];
  titleBlockTemplate?: TitleBlockTemplate;
  titleBlock?: SheetTitleBlock;
  viewports?: Viewport[];
}

// ── Construction Line ────────────────────────────────────

export interface ConstructionLine {
  id: string;
  story: string;
  type: 'xline' | 'ray';
  origin: Point2D;
  direction: Point2D;
}

// ── External Reference ──────────────────────────────────

export interface ExternalRef {
  id: string;
  name: string;
  data: ProjectData;
  offsetX: number;
  offsetY: number;
  visible: boolean;
}

// ── Viewport ────────────────────────────────────────────

export interface Viewport {
  id: string;
  sheetId: string;
  viewId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: string;
}

// ── Issue ────────────────────────────────────────────────────

export interface Issue {
  level: 'error' | 'warning' | 'info';
  message: string;
  memberId?: string;
}

// ── Helper types ─────────────────────────────────────────────

/** Member with start/end points (column, beam, wall) */
export type LinearMember = ColumnMember | BeamMember | WallMember;

/** Check if a member is linear (has start/end) */
export function isLinearMember(m: Member): m is LinearMember {
  return m.type === 'column' || m.type === 'beam' || m.type === 'wall';
}
