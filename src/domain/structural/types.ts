import type { Point2D, Point3D } from '@/domain/geometry/types';

// ── Project Root ─────────────────────────────────────────────

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
}

// ── Grid ─────────────────────────────────────────────────────

export interface Grid {
  id: string;
  axis: 'X' | 'Y';
  name: string;
  position: number;
}

// ── Material ─────────────────────────────────────────────────

export interface Material {
  id: string;
  name: string;
  type: 'concrete' | 'steel' | 'wood' | 'other';
}

// ── Section (discriminated union on kind) ────────────────────

export interface RectColumnSection {
  id: string;
  kind: 'rc_column_rect';
  width: number;
  depth: number;
}

export interface RectBeamSection {
  id: string;
  kind: 'rc_beam_rect';
  width: number;
  depth: number;
}

export interface SlabSection {
  id: string;
  kind: 'rc_slab';
  thickness: number;
}

export interface WallSection {
  id: string;
  kind: 'rc_wall';
  thickness: number;
}

export type Section = RectColumnSection | RectBeamSection | SlabSection | WallSection;

// ── Member (discriminated union on type) ─────────────────────

interface MemberBase {
  id: string;
  story: string;
  sectionId: string;
  materialId: string;
  rotation?: number;
  tags?: string[];
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
  type: 'text' | 'label' | 'leader';
  story: string;
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  rotation?: number;
}

// ── Dimension ────────────────────────────────────────────────

export interface Dimension {
  id: string;
  story: string;
  start: Point2D;
  end: Point2D;
  offset: number;
  text?: string;
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

export interface Sheet {
  id: string;
  name: string;
  paperSize: PaperSize;
  scale: string;
  viewIds: string[];
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
