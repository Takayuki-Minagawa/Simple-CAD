import type { Point3D } from '@/domain/geometry/types';
import type { Member, ProjectData, Section } from '@/domain/structural/types';
import { distance3, normalize3, perpendicularHorizontal, sub3 } from './geometry';
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

export function exportIfc(data: ProjectData): string {
  const writer = new IfcWriter();
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

    const elementRef = createIfcMember(writer, context, buildingPlacement, member, data.sections);
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
): number | null {
  const section = sections.find((item) => item.id === member.sectionId);

  switch (member.type) {
    case 'column': {
      const width = section && 'width' in section ? section.width : 600;
      const depth = section && 'depth' in section ? section.depth : 600;
      const profile = writer.rectangleProfile(`PROFILE-${member.id}`, width, depth);
      return writeExtrudedProduct(writer, contextRef, parentPlacementRef, {
        type: 'IFCCOLUMN',
        member,
        profileRef: profile,
        depth: memberLength(member.start, member.end),
        origin: member.start,
        orientation: VERTICAL_ORIENTATION,
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
  const placement = writer.orientedPlacement(parentPlacementRef, options.origin, options.orientation);
  return writer.product(
    options.type,
    `${options.member.type}:${options.member.id}`,
    options.member.id,
    placement,
    shape,
  );
}

function alongMemberOrientation(start: Point3D, end: Point3D): Orientation {
  const direction = normalize3(sub3(end, start));
  return { axis: direction, refDirection: perpendicularHorizontal(direction) };
}

function memberLength(start: Point3D, end: Point3D): number {
  return Math.max(distance3(start, end), 1);
}
