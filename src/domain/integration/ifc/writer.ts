import { v5 as uuidv5 } from 'uuid';
import type { Point2D, Point3D } from '@/domain/geometry/types';
import type { Vector3 } from './types';

const IFC_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export class IfcWriter {
  lines: string[] = [];
  private nextEntityId = 1;

  add(entity: string): number {
    const id = this.nextEntityId++;
    this.lines.push(`#${id}=${entity};`);
    return id;
  }

  ref(id: number): string {
    return `#${id}`;
  }

  str(value: string): string {
    return `'${escapeIfcString(value)}'`;
  }

  num(value: number): string {
    return Number.isInteger(value) ? `${value}.` : String(value);
  }

  direction(vector: Vector3): number {
    return this.add(
      `IFCDIRECTION((${this.num(vector.x)},${this.num(vector.y)},${this.num(vector.z)}))`,
    );
  }

  cartesianPoint3D(point: Point3D): number {
    return this.add(`IFCCARTESIANPOINT((${this.num(point.x)},${this.num(point.y)},${this.num(point.z)}))`);
  }

  cartesianPoint2D(point: Point2D): number {
    return this.add(`IFCCARTESIANPOINT((${this.num(point.x)},${this.num(point.y)}))`);
  }

  axis2Placement3D(pointRef: number, axisRef: number, refDirectionRef: number): number {
    return this.add(`IFCAXIS2PLACEMENT3D(${this.ref(pointRef)},${this.ref(axisRef)},${this.ref(refDirectionRef)})`);
  }

  axis2Placement2D(pointRef: number): number {
    return this.add(`IFCAXIS2PLACEMENT2D(${this.ref(pointRef)},$)`);
  }

  localPlacement(parentRef: number | null, axisRef: number): number {
    return this.add(`IFCLOCALPLACEMENT(${parentRef ? this.ref(parentRef) : '$'},${this.ref(axisRef)})`);
  }

  orientedPlacement(
    parentRef: number | null,
    origin: Point3D,
    orientation: { axis: Vector3; refDirection: Vector3 },
  ): number {
    const point = this.cartesianPoint3D(origin);
    const axis = this.direction(orientation.axis);
    const refDirection = this.direction(orientation.refDirection);
    const placement = this.axis2Placement3D(point, axis, refDirection);
    return this.localPlacement(parentRef, placement);
  }

  rectangleProfile(name: string, xDim: number, yDim: number, offset: Point2D = { x: 0, y: 0 }): number {
    const offsetPoint = this.cartesianPoint2D(offset);
    const offsetPlacement = this.axis2Placement2D(offsetPoint);
    return this.add(
      `IFCRECTANGLEPROFILEDEF(.AREA.,${this.str(name)},${this.ref(offsetPlacement)},${this.num(xDim)},${this.num(yDim)})`,
    );
  }

  polylineProfile(name: string, points: Point2D[]): number {
    const refs = points.map((point) => this.ref(this.cartesianPoint2D(point)));
    const polyline = this.add(`IFCPOLYLINE((${refs.join(',')}))`);
    return this.add(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,${this.str(name)},${this.ref(polyline)})`);
  }

  extrudedSolid(profileRef: number, depth: number): number {
    const originPoint = this.cartesianPoint3D({ x: 0, y: 0, z: 0 });
    const zDirection = this.direction({ x: 0, y: 0, z: 1 });
    const xDirection = this.direction({ x: 1, y: 0, z: 0 });
    const axis = this.axis2Placement3D(originPoint, zDirection, xDirection);
    return this.add(
      `IFCEXTRUDEDAREASOLID(${this.ref(profileRef)},${this.ref(axis)},${this.ref(zDirection)},${this.num(depth)})`,
    );
  }

  productShape(contextRef: number, solidRef: number): number {
    const shape = this.add(
      `IFCSHAPEREPRESENTATION(${this.ref(contextRef)},'Body','SweptSolid',(${this.ref(solidRef)}))`,
    );
    return this.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${this.ref(shape)}))`);
  }

  product(type: string, seed: string, name: string, placementRef: number, shapeRef: number): number {
    return this.add(
      `${type}('${toIfcGlobalId(seed)}',$,${this.str(name)},$,$,${this.ref(placementRef)},${this.ref(shapeRef)},$,$)`,
    );
  }

  relAggregates(seed: string, parentRef: number, childRefs: number[]): number {
    return this.add(
      `IFCRELAGGREGATES('${toIfcGlobalId(seed)}',$,$,$,${this.ref(parentRef)},(${childRefs.map((ref) => this.ref(ref)).join(',')}))`,
    );
  }

  relContained(seed: string, elementRefs: number[], storyRef: number): number {
    return this.add(
      `IFCRELCONTAINEDINSPATIALSTRUCTURE('${toIfcGlobalId(seed)}',$,$,$,(${elementRefs.map((ref) => this.ref(ref)).join(',')}),${this.ref(storyRef)})`,
    );
  }
}

export function toIfcGlobalId(seed: string): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  const hex = uuidv5(seed, IFC_UUID_NAMESPACE).replace(/-/g, '');
  let state = BigInt(`0x${hex}`);

  let value = '';
  for (let index = 0; index < 22; index++) {
    value += chars[Number(state % 64n)];
    state /= 64n;
  }
  return value;
}

export function escapeIfcString(value: string): string {
  return value.replace(/'/g, "''");
}
