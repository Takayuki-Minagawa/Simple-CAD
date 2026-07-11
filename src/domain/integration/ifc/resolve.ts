import type { Point3D } from '@/domain/geometry/types';
import {
  DEFAULT_TRANSFORM,
  composeTransform,
  cross3,
  defaultRefDirection,
  normalize3,
} from './geometry';
import { asNumber, asNumberList, asRef, asRefList, asString } from './step';
import type { Profile, ResolvedSolid, StepEntity, Transform3D, Vector3 } from './types';

export function resolveIfcElement(entity: StepEntity, entities: Map<number, StepEntity>): ResolvedSolid | null {
  const placementRef = asRef(entity.args[5]);
  const representationRef = asRef(entity.args[6]);
  if (!placementRef || !representationRef) return null;

  const objectTransform = resolveLocalPlacement(entities, placementRef);
  const solid = resolveRepresentation(entities, representationRef);
  if (!solid) return null;

  return {
    profile: solid.profile,
    depth: solid.depth,
    transform: composeTransform(objectTransform, solid.transform),
  };
}

function resolveRepresentation(entities: Map<number, StepEntity>, representationRef: number): ResolvedSolid | null {
  const representation = entities.get(representationRef);
  if (!representation || representation.type !== 'IFCPRODUCTDEFINITIONSHAPE') return null;
  const shapes = asRefList(representation.args[2])
    .map((shapeRef) => entities.get(shapeRef))
    .filter((shape): shape is StepEntity => shape?.type === 'IFCSHAPEREPRESENTATION');
  const bodyShapes = shapes.filter(
    (shape) => (asString(shape.args[1]) ?? '').toUpperCase() === 'BODY',
  );
  for (const shape of bodyShapes.length > 0 ? bodyShapes : shapes) {
    for (const solidRef of asRefList(shape.args[3])) {
      const resolved = resolveExtrudedSolid(entities, solidRef);
      if (resolved) return resolved;
    }
  }
  return null;
}

function resolveExtrudedSolid(
  entities: Map<number, StepEntity>,
  solidRef: number,
): ResolvedSolid | null {
  const solid = entities.get(solidRef);
  if (!solid || solid.type !== 'IFCEXTRUDEDAREASOLID') return null;

  const profileRef = asRef(solid.args[0]);
  const positionRef = asRef(solid.args[1]);
  const depth = asNumber(solid.args[3]) ?? 0;
  if (!profileRef || !positionRef || depth <= 0) return null;

  const profile = resolveProfile(entities, profileRef);
  if (!profile) return null;

  return {
    profile,
    depth,
    transform: resolveAxisPlacementTransform(entities, positionRef),
  };
}

function resolveProfile(entities: Map<number, StepEntity>, profileRef: number): Profile | null {
  const profile = entities.get(profileRef);
  if (!profile) return null;

  if (profile.type === 'IFCRECTANGLEPROFILEDEF') {
    return {
      kind: 'rectangle',
      xDim: asNumber(profile.args[3]) ?? 0,
      yDim: asNumber(profile.args[4]) ?? 0,
      ...profileSourceSection(profile),
      ...profilePlacement(entities, profile),
    };
  }

  if (profile.type === 'IFCARBITRARYCLOSEDPROFILEDEF') {
    const curveRef = asRef(profile.args[2]);
    if (!curveRef) return null;
    const curve = entities.get(curveRef);
    if (!curve || curve.type !== 'IFCPOLYLINE') return null;
    const points = asRefList(curve.args[0])
      .map((pointRef) => entities.get(pointRef))
      .filter(isCartesianPointEntity)
      .map((point) => {
        const coords = asNumberList(point.args[0]);
        return { x: coords[0] ?? 0, y: coords[1] ?? 0 };
      });
    if (
      points.length > 1 &&
      points[0].x === points[points.length - 1].x &&
      points[0].y === points[points.length - 1].y
    ) {
      points.pop();
    }
    return {
      kind: 'polyline',
      points,
      ...profileSourceSection(profile),
      ...profilePlacement(entities, profile),
    };
  }

  if (profile.type === 'IFCISHAPEPROFILEDEF') {
    const overallWidth = asNumber(profile.args[3]) ?? 0;
    const overallDepth = asNumber(profile.args[4]) ?? 0;
    const webThickness = asNumber(profile.args[5]) ?? 0;
    const flangeThickness = asNumber(profile.args[6]) ?? 0;
    if (
      overallWidth <= 0 ||
      overallDepth <= 0 ||
      webThickness <= 0 ||
      flangeThickness <= 0
    ) {
      return null;
    }
    return {
      kind: 'iShape',
      overallWidth,
      overallDepth,
      webThickness,
      flangeThickness,
      ...profileSourceSection(profile),
      ...profilePlacement(entities, profile),
    };
  }

  if (profile.type === 'IFCHOLLOWCIRCLEPROFILEDEF') {
    const radius = asNumber(profile.args[3]) ?? 0;
    const wallThickness = asNumber(profile.args[4]) ?? 0;
    if (radius <= 0 || wallThickness <= 0 || wallThickness >= radius) return null;
    return {
      kind: 'hollowCircle',
      diameter: radius * 2,
      wallThickness,
      ...profileSourceSection(profile),
      ...profilePlacement(entities, profile),
    };
  }

  return null;
}

function profileSourceSection(profile: StepEntity): { sourceSectionId?: string } {
  const name = asString(profile.args[1]);
  return name?.startsWith('SECTION:') ? { sourceSectionId: name.slice('SECTION:'.length) } : {};
}

function profilePlacement(
  entities: Map<number, StepEntity>,
  profile: StepEntity,
): { placement?: import('./types').ProfilePlacement2D } {
  const placementRef = asRef(profile.args[2]);
  if (!placementRef) return {};
  const placement = entities.get(placementRef);
  if (!placement || placement.type !== 'IFCAXIS2PLACEMENT2D') return {};
  const locationRef = asRef(placement.args[0]);
  const locationEntity = locationRef ? entities.get(locationRef) : undefined;
  const coordinates =
    locationEntity?.type === 'IFCCARTESIANPOINT'
      ? asNumberList(locationEntity.args[0])
      : [];
  const directionRef = asRef(placement.args[1]);
  const directionEntity = directionRef ? entities.get(directionRef) : undefined;
  const directionValues =
    directionEntity?.type === 'IFCDIRECTION'
      ? asNumberList(directionEntity.args[0])
      : [];
  const length = Math.hypot(directionValues[0] ?? 1, directionValues[1] ?? 0) || 1;
  const xAxis = {
    x: (directionValues[0] ?? 1) / length,
    y: (directionValues[1] ?? 0) / length,
  };
  return {
    placement: {
      origin: { x: coordinates[0] ?? 0, y: coordinates[1] ?? 0 },
      xAxis,
      yAxis: { x: -xAxis.y, y: xAxis.x },
    },
  };
}

export function resolveLocalPlacement(
  entities: Map<number, StepEntity>,
  placementRef: number | null,
  visited: Set<number> = new Set(),
): Transform3D {
  if (!placementRef || visited.has(placementRef)) return DEFAULT_TRANSFORM;
  visited.add(placementRef);
  const placement = entities.get(placementRef);
  if (!placement || placement.type !== 'IFCLOCALPLACEMENT') return DEFAULT_TRANSFORM;

  const parent = resolveLocalPlacement(entities, asRef(placement.args[0]), visited);
  const local = resolveAxisPlacementTransform(entities, asRef(placement.args[1]));
  return composeTransform(parent, local);
}

function resolveAxisPlacementTransform(entities: Map<number, StepEntity>, placementRef: number | null): Transform3D {
  if (!placementRef) return DEFAULT_TRANSFORM;
  const placement = entities.get(placementRef);
  if (!placement || placement.type !== 'IFCAXIS2PLACEMENT3D') return DEFAULT_TRANSFORM;

  const location = resolvePoint(entities, asRef(placement.args[0]));
  const zAxis = normalize3(resolveDirection(entities, asRef(placement.args[1])) ?? { x: 0, y: 0, z: 1 });
  const refDirection = normalize3(
    resolveDirection(entities, asRef(placement.args[2])) ?? defaultRefDirection(zAxis),
  );
  const yAxis = normalize3(cross3(zAxis, refDirection));
  const xAxis = normalize3(cross3(yAxis, zAxis));

  return {
    origin: location,
    xAxis,
    yAxis,
    zAxis,
  };
}

function resolvePoint(entities: Map<number, StepEntity>, pointRef: number | null): Point3D {
  if (!pointRef) return { x: 0, y: 0, z: 0 };
  const point = entities.get(pointRef);
  if (!point || point.type !== 'IFCCARTESIANPOINT') return { x: 0, y: 0, z: 0 };
  const coords = asNumberList(point.args[0]);
  return {
    x: coords[0] ?? 0,
    y: coords[1] ?? 0,
    z: coords[2] ?? 0,
  };
}

function resolveDirection(entities: Map<number, StepEntity>, directionRef: number | null): Vector3 | null {
  if (!directionRef) return null;
  const direction = entities.get(directionRef);
  if (!direction || direction.type !== 'IFCDIRECTION') return null;
  const values = asNumberList(direction.args[0]);
  return {
    x: values[0] ?? 0,
    y: values[1] ?? 0,
    z: values[2] ?? 0,
  };
}

export function resolveProjectName(entities: Map<number, StepEntity>): string | null {
  const project = [...entities.values()].find((entity) => entity.type === 'IFCPROJECT');
  return project ? asString(project.args[2]) : null;
}

export function resolveElementName(entity: StepEntity): string {
  return asString(entity.args[2]) ?? asString(entity.args[0]) ?? `IFC-${entity.id}`;
}

function isCartesianPointEntity(value: StepEntity | undefined): value is StepEntity {
  return value !== undefined && value.type === 'IFCCARTESIANPOINT';
}
