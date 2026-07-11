import type { Point2D, Point3D } from '@/domain/geometry/types';

export type Vector3 = Point3D;

export interface ProfilePlacement2D {
  origin: Point2D;
  xAxis: Point2D;
  yAxis: Point2D;
}

export interface StepTypedValue {
  typedType: string;
  value: StepValue;
}

export type StepScalar = string | number | null | { ref: number } | StepTypedValue;
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
  sourceSectionId?: string;
  placement?: ProfilePlacement2D;
}

export interface PolylineProfile {
  kind: 'polyline';
  points: Point2D[];
  sourceSectionId?: string;
  placement?: ProfilePlacement2D;
}

export interface IShapeProfile {
  kind: 'iShape';
  overallWidth: number;
  overallDepth: number;
  webThickness: number;
  flangeThickness: number;
  sourceSectionId?: string;
  placement?: ProfilePlacement2D;
}

export interface HollowCircleProfile {
  kind: 'hollowCircle';
  diameter: number;
  wallThickness: number;
  sourceSectionId?: string;
  placement?: ProfilePlacement2D;
}

export type Profile = RectangleProfile | PolylineProfile | IShapeProfile | HollowCircleProfile;

export interface ResolvedSolid {
  profile: Profile;
  depth: number;
  transform: Transform3D;
}

export interface IfcStoryInfo {
  id: string;
  name: string;
  elevation: number;
  sourceEntityId?: number;
}
