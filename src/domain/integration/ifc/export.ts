import type { Point3D } from '@/domain/geometry/types';
import type { Member, ProjectData, Section } from '@/domain/structural/types';
import { add3, distance3, normalize3, perpendicularHorizontal, sub3 } from './geometry';
import {
  columnAxisOffsetToWorld,
  linearAxisOffsetToWorld,
  slabAxisOffsetToWorld,
} from '@/domain/structural/eccentricity';
import type { Vector3 } from './types';
import { IfcWriter, escapeIfcString, toIfcGlobalId } from './writer';

const IFC_SCHEMA = 'IFC4';
const VERTICAL_ORIENTATION: Orientation = {
  axis: { x: 0, y: 0, z: 1 },
  refDirection: { x: 1, y: 0, z: 0 },
};

interface Orientation {
  axis: Vector3;
  refDirection: Vector3;
}

/**
 * Export a project as IFC4 STEP text.
 *
 * @param warnings optional sink — when provided, non-fatal issues such as a
 *   missing section being replaced by a fallback dimension are pushed here so
 *   callers don't silently ship magic numbers (B7 / 2-8). Backward compatible:
 *   existing callers that pass only `data` are unaffected.
 */
export function exportIfc(data: ProjectData, warnings?: string[]): string {
  const writer = new IfcWriter();
  const sink = warnings ?? [];
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const originPoint = writer.cartesianPoint3D({ x: 0, y: 0, z: 0 });
  const xDirection = writer.direction({ x: 1, y: 0, z: 0 });
  const zDirection = writer.direction({ x: 0, y: 0, z: 1 });
  const globalAxis = writer.axis2Placement3D(originPoint, zDirection, xDirection);
  const context = writer.add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${writer.ref(globalAxis)},$)`);
  const lengthUnit = writer.add('IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)');
  const unitAssignment = writer.add(`IFCUNITASSIGNMENT((${writer.ref(lengthUnit)}))`);
  const project = writer.add(
    `IFCPROJECT('${toIfcGlobalId(`project:${data.project.id}`)}',$,${writer.str(data.project.name)},$,$,$,$,(${writer.ref(context)}),${writer.ref(unitAssignment)})`,
  );

  const buildingPlacement = writer.localPlacement(null, globalAxis);
  const building = writer.add(
    `IFCBUILDING('${toIfcGlobalId(`building:${data.project.id}`)}',$,${writer.str(data.project.name)},$,$,${writer.ref(buildingPlacement)},$,$,.ELEMENT.,$,$,$)`,
  );
  writer.relAggregates(`project-building:${data.project.id}`, project, [building]);

  const storyRefs = new Map<string, number>();
  for (const story of data.stories) {
    const storyPoint = writer.cartesianPoint3D({ x: 0, y: 0, z: story.elevation });
    const storyAxis = writer.axis2Placement3D(storyPoint, zDirection, xDirection);
    const storyPlacement = writer.localPlacement(buildingPlacement, storyAxis);
    const storyRef = writer.add(
      `IFCBUILDINGSTOREY('${toIfcGlobalId(`story:${story.id}`)}',$,${writer.str(story.name)},$,$,${writer.ref(storyPlacement)},$,$,.ELEMENT.,${writer.num(story.elevation)})`,
    );
    storyRefs.set(story.id, storyRef);
  }
  writer.relAggregates(`building-stories:${data.project.id}`, building, [...storyRefs.values()]);

  const storyMembers = new Map<string, number[]>();
  for (const story of data.stories) {
    storyMembers.set(story.id, []);
  }

  for (const member of data.members) {
    const storyRef = storyRefs.get(member.story);
    if (!storyRef) continue;

    const elementRef = createIfcMember(writer, context, buildingPlacement, member, data.sections, sink);
    if (!elementRef) continue;
    storyMembers.get(member.story)?.push(elementRef);
  }

  for (const [storyId, elementRefs] of storyMembers.entries()) {
    if (elementRefs.length === 0) continue;
    const storyRef = storyRefs.get(storyId);
    if (!storyRef) continue;
    writer.relContained(`story-elements:${storyId}`, elementRefs, storyRef);
  }

  return [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');",
    `FILE_NAME('${escapeIfcString(`${data.project.name}.ifc`)}','${now}',('Simple-CAD'),('OpenAI'),'Simple-CAD','Simple-CAD','');`,
    `FILE_SCHEMA(('${IFC_SCHEMA}'));`,
    'ENDSEC;',
    'DATA;',
    ...writer.lines,
    'ENDSEC;',
    'END-ISO-10303-21;',
  ].join('\n');
}

function createIfcMember(
  writer: IfcWriter,
  contextRef: number,
  parentPlacementRef: number,
  member: Member,
  sections: Section[],
  warnings: string[],
): number | null {
  const section = sections.find((item) => item.id === member.sectionId);
  if (!section) {
    warnings.push(
      `部材 ${member.id} (${member.type}) の断面 ${member.sectionId} が見つからないため既定寸法で出力しました`,
    );
  }

  switch (member.type) {
    case 'column': {
      const width = section && 'width' in section ? section.width : 600;
      const depth = section && 'depth' in section ? section.depth : 600;
      const profile = writer.rectangleProfile(`PROFILE-${member.id}`, width, depth);
      // Encode member.rotation in the placement refDirection so it round-trips
      // (B5 / 3-8). A vertical column rotates about its z axis.
      return writeExtrudedProduct(writer, contextRef, parentPlacementRef, {
        type: 'IFCCOLUMN',
        member,
        profileRef: profile,
        depth: memberLength(member.start, member.end),
        origin: member.start,
        orientation: rotatedVerticalOrientation(member.rotation),
      });
    }
    case 'beam': {
      const width = section && 'width' in section ? section.width : 300;
      const depth = section && 'depth' in section ? section.depth : 600;
      const profile = writer.rectangleProfile(`PROFILE-${member.id}`, width, depth);
      return writeExtrudedProduct(writer, contextRef, parentPlacementRef, {
        type: 'IFCBEAM',
        member,
        profileRef: profile,
        depth: memberLength(member.start, member.end),
        origin: member.start,
        orientation: alongMemberOrientation(member.start, member.end),
      });
    }
    case 'wall': {
      const thickness = section && 'thickness' in section ? section.thickness : member.thickness;
      const profile = writer.rectangleProfile(`PROFILE-${member.id}`, thickness, member.height, {
        x: 0,
        y: member.height / 2,
      });
      return writeExtrudedProduct(writer, contextRef, parentPlacementRef, {
        type: 'IFCWALL',
        member,
        profileRef: profile,
        depth: memberLength(member.start, member.end),
        origin: member.start,
        orientation: alongMemberOrientation(member.start, member.end),
      });
    }
    case 'slab': {
      const thickness = section && 'thickness' in section ? section.thickness : 180;
      const baseZ = member.level - thickness;
      const profile = writer.polylineProfile(
        `PROFILE-${member.id}`,
        member.polygon.map((point) => ({ x: point.x, y: point.y })),
      );
      return writeExtrudedProduct(writer, contextRef, parentPlacementRef, {
        type: 'IFCSLAB',
        member,
        profileRef: profile,
        depth: thickness,
        origin: { x: 0, y: 0, z: baseZ },
        orientation: VERTICAL_ORIENTATION,
      });
    }
  }
}

/** World-space placement delta for a member's axis eccentricity (2-6). */
function memberEccentricityWorld(member: Member): Point3D {
  if (member.type === 'column') return columnAxisOffsetToWorld(member.axisOffset);
  if (member.type === 'slab') return slabAxisOffsetToWorld(member.axisOffset);
  if (member.type === 'beam' || member.type === 'wall') {
    return linearAxisOffsetToWorld(member.axisOffset, member.start, member.end);
  }
  return { x: 0, y: 0, z: 0 };
}

function writeExtrudedProduct(
  writer: IfcWriter,
  contextRef: number,
  parentPlacementRef: number,
  options: {
    type: string;
    member: Member;
    profileRef: number;
    depth: number;
    origin: Point3D;
    orientation: Orientation;
  },
): number {
  const solid = writer.extrudedSolid(options.profileRef, options.depth);
  const shape = writer.productShape(contextRef, solid);
  // Apply axis eccentricity (2-6) by shifting the placement origin in world
  // space, using the shared convention (column: dx→x, dy→y; beam/wall: dx =
  // in-plan perpendicular, dy = vertical) so 2D, 3D and IFC agree. Members
  // without an offset are untouched so existing output stays byte-identical.
  const origin = add3(options.origin, memberEccentricityWorld(options.member));
  const placement = writer.orientedPlacement(parentPlacementRef, origin, options.orientation);
  return writer.product(
    options.type,
    `${options.member.type}:${options.member.id}`,
    options.member.id,
    placement,
    shape,
  );
}

/** Vertical orientation whose refDirection is rotated by `rotation` rad in XY. */
function rotatedVerticalOrientation(rotation: number | undefined): Orientation {
  if (!rotation) return VERTICAL_ORIENTATION;
  return {
    axis: { x: 0, y: 0, z: 1 },
    refDirection: { x: Math.cos(rotation), y: Math.sin(rotation), z: 0 },
  };
}

function alongMemberOrientation(start: Point3D, end: Point3D): Orientation {
  const direction = normalize3(sub3(end, start));
  return { axis: direction, refDirection: perpendicularHorizontal(direction) };
}

function memberLength(start: Point3D, end: Point3D): number {
  return Math.max(distance3(start, end), 1);
}
