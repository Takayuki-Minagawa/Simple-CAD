export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface BBox2D {
  min: Point2D;
  max: Point2D;
}

export interface BBox3D {
  min: Point3D;
  max: Point3D;
}
