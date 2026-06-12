import type { Point2D, Point3D } from '@/domain/geometry/types';

export type Vector3 = Point3D;

export type StepScalar = string | number | null | { ref: number };
export type StepValue = StepScalar | StepValue[];

export interface StepEntity {
  id: number;
  type: string;
  args: StepValue[];
}

export interface Transform3D {
  origin: Point3D;
  xAxis: Vector3;
  yAxis: Vector3;
  zAxis: Vector3;
}

export interface RectangleProfile {
  kind: 'rectangle';
  xDim: number;
  yDim: number;
}

export interface PolylineProfile {
  kind: 'polyline';
  points: Point2D[];
}

export type Profile = RectangleProfile | PolylineProfile;

export interface ResolvedSolid {
  profile: Profile;
  depth: number;
  transform: Transform3D;
}

export interface IfcStoryInfo {
  id: string;
  name: string;
  elevation: number;
}
