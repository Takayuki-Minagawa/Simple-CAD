import type { Point3D } from '@/domain/geometry/types';
import type { Member, Opening, ProjectData, Section } from '@/domain/structural/types';
import { GEOM_EPSILON } from '@/domain/geometry/precision';
import { add3, distance3, scale3 } from './geometry';
import {
  columnAxisOffsetToWorld,
  effectiveLinearAxisOffset,
  linearAxisOffsetToWorld,
  slabAxisOffsetToWorld,
} from '@/domain/structural/eccentricity';
import {
  getBeamRectSize,
  getColumnRectSize,
  getSlabThickness,
  getWallThickness,
} from '@/domain/structural/memberShape';
import { nowIsoString } from '@/domain/time';
import type { Vector3 } from './types';
import { IfcWriter, escapeIfcString, toIfcGlobalId } from './writer';
import { resolveMemberLocalAxes } from '@/domain/structural/localAxis';
import { encodeIfcMemberMetadata, encodeIfcOpeningMetadata } from './simpleCadMetadata';

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
  const now = nowIsoString().replace(/\.\d{3}Z$/, 'Z');

  const originPoint = writer.cartesianPoint3D({ x: 0, y: 0, z: 0 });
  const xDirection = writer.direction({ x: 1, y: 0, z: 0 });
  const zDirection = writer.direction({ x: 0, y: 0, z: 1 });
  const globalAxis = writer.axis2Placement3D(originPoint, zDirection, xDirection);
  const context = writer.add(
    `IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${writer.ref(globalAxis)},$)`,
  );
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
  const memberRefs = new Map<string, number>();
  for (const story of data.stories) {
    storyMembers.set(story.id, []);
  }

  for (const member of data.members) {
    const storyRef = storyRefs.get(member.story);
    if (!storyRef) continue;

    const elementRef = createIfcMember(
      writer,
      context,
      buildingPlacement,
      member,
      data.sections,
      sink,
    );
    if (!elementRef) continue;
    memberRefs.set(member.id, elementRef);
    storyMembers.get(member.story)?.push(elementRef);
  }

  // Preserve material identity/properties with standard IFC material
  // associations. The JSON description is intentionally supplemental: other
  // IFC consumers still see a normal name/category, while Simple-CAD can
  // restore its optional engineering properties on round-trip.
  for (const material of data.materials) {
    const elementRefs = data.members
      .filter((member) => member.materialId === material.id)
      .map((member) => memberRefs.get(member.id))
      .filter((ref): ref is number => ref !== undefined);
    if (elementRefs.length === 0) continue;
    const materialRef = writer.material(material);
    writer.relAssociatesMaterial(`material:${material.id}`, elementRefs, materialRef);
  }

  for (const member of data.members) {
    if (!data.materials.some((material) => material.id === member.materialId)) {
      sink.push(`部材 ${member.id} が参照する材料 ${member.materialId} が見つかりません`);
    }
  }

  // IFC openings are separate products related to their host via
  // IfcRelVoidsElement. This keeps openings visible to external BIM tools and
  // lets the importer restore their host/member relationship.
  for (const opening of data.openings) {
    const hostRef = memberRefs.get(opening.memberId);
    const host = data.members.find((member) => member.id === opening.memberId);
    if (!hostRef || !host) {
      sink.push(`開口 ${opening.id} の参照部材 ${opening.memberId} が見つからないためスキップしました`);
      continue;
    }
    const openingRef = createIfcOpening(
      writer,
      context,
      buildingPlacement,
      opening,
      host,
      data.sections,
      sink,
    );
    if (!openingRef) continue;
    writer.relVoids(`opening-host:${opening.id}`, hostRef, openingRef);
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

export interface IfcExportResult {
  content: string;
  warnings: string[];
}

/** Result-object variant for UI/preflight callers that must surface warnings. */
export function exportIfcWithWarnings(data: ProjectData): IfcExportResult {
  const warnings: string[] = [];
  return { content: exportIfc(data, warnings), warnings };
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
      if (memberLength(member.start, member.end) <= GEOM_EPSILON) {
        warnings.push(`柱 ${member.id} は長さ0のためIFC出力をスキップしました`);
        return null;
      }
      const profile = createLinearProfile(writer, member, section, warnings);
      if (!profile) return null;
      // Encode member.rotation in the placement refDirection so it round-trips
      // (B5 / 3-8). A vertical column rotates about its z axis.
      return writeExtrudedProduct(writer, contextRef, parentPlacementRef, {
        type: 'IFCCOLUMN',
        member,
        profileRef: profile,
        depth: memberLength(member.start, member.end),
        origin: member.start,
        orientation: memberOrientation(member),
        offset: memberEccentricityWorld(member, section),
      });
    }
    case 'beam': {
      if (memberLength(member.start, member.end) <= GEOM_EPSILON) {
        warnings.push(`梁 ${member.id} は長さ0のためIFC出力をスキップしました`);
        return null;
      }
      const profile = createLinearProfile(writer, member, section, warnings);
      if (!profile) return null;
      return writeExtrudedProduct(writer, contextRef, parentPlacementRef, {
        type: 'IFCBEAM',
        member,
        profileRef: profile,
        depth: memberLength(member.start, member.end),
        origin: member.start,
        orientation: memberOrientation(member),
        offset: memberEccentricityWorld(member, section),
      });
    }
    case 'wall': {
      if (memberLength(member.start, member.end) <= GEOM_EPSILON) {
        warnings.push(`壁 ${member.id} は長さ0のためIFC出力をスキップしました`);
        return null;
      }
      const thickness = getWallThickness(member, section);
      const profile = writer.rectangleProfile(section ? `SECTION:${section.id}` : `PROFILE-${member.id}`, thickness, member.height, {
        x: 0,
        y: member.height / 2,
      });
      return writeExtrudedProduct(writer, contextRef, parentPlacementRef, {
        type: 'IFCWALL',
        member,
        profileRef: profile,
        depth: memberLength(member.start, member.end),
        origin: member.start,
        orientation: memberOrientation(member),
        offset: memberEccentricityWorld(member, section),
      });
    }
    case 'slab': {
      if (member.polygon.length < 3) {
        warnings.push(`スラブ ${member.id} は有効な頂点が3未満のためIFC出力をスキップしました`);
        return null;
      }
      const thickness = getSlabThickness(section);
      const baseZ = member.level - thickness;
      const profile = writer.polylineProfile(
        section ? `SECTION:${section.id}` : `PROFILE-${member.id}`,
        member.polygon.map((point) => ({ x: point.x, y: point.y })),
      );
      return writeExtrudedProduct(writer, contextRef, parentPlacementRef, {
        type: 'IFCSLAB',
        member,
        profileRef: profile,
        depth: thickness,
        origin: { x: 0, y: 0, z: baseZ },
        orientation: VERTICAL_ORIENTATION,
        offset: memberEccentricityWorld(member, section),
      });
    }
  }
}

function createLinearProfile(
  writer: IfcWriter,
  member: Extract<Member, { type: 'column' | 'beam' }>,
  section: Section | undefined,
  warnings: string[],
): number | null {
  const expectedHKind = member.type === 'column' ? 's_column_h' : 's_beam_h';
  const expectedRcKind = member.type === 'column' ? 'rc_column_rect' : 'rc_beam_rect';

  if (section?.kind === expectedHKind) {
    if (
      section.tw === undefined ||
      section.tf === undefined ||
      section.tw <= 0 ||
      section.tf <= 0 ||
      section.tw >= section.width ||
      section.tf * 2 >= section.depth
    ) {
      warnings.push(
        `${member.type === 'column' ? '柱' : '梁'} ${member.id} のH形鋼断面 ${section.id} に有効な tw/tf が無いためIFC出力をスキップしました`,
      );
      return null;
    }
    return writer.iShapeProfile(
      `SECTION:${section.id}`,
      section.width,
      section.depth,
      section.tw,
      section.tf,
    );
  }

  if (section?.kind === 's_pipe') {
    if (section.thickness * 2 >= section.diameter) {
      warnings.push(`部材 ${member.id} の鋼管断面 ${section.id} が無効なためIFC出力をスキップしました`);
      return null;
    }
    return writer.hollowCircleProfile(
      `SECTION:${section.id}`,
      section.diameter,
      section.thickness,
    );
  }

  if (section && section.kind !== expectedRcKind) {
    warnings.push(
      `部材 ${member.id} の断面種別 ${section.kind} は ${member.type} と互換性がないため矩形外形で出力しました`,
    );
  }
  const { width, depth } =
    member.type === 'column' ? getColumnRectSize(section) : getBeamRectSize(section);
  return writer.rectangleProfile(section ? `SECTION:${section.id}` : `PROFILE-${member.id}`, width, depth);
}

function createIfcOpening(
  writer: IfcWriter,
  contextRef: number,
  parentPlacementRef: number,
  opening: Opening,
  host: Member,
  sections: Section[],
  warnings: string[],
): number | null {
  if (
    !Number.isFinite(opening.width) ||
    !Number.isFinite(opening.height) ||
    opening.width <= 0 ||
    opening.height <= 0
  ) {
    warnings.push(`開口 ${opening.id} の寸法が無効なためIFC出力をスキップしました`);
    return null;
  }

  const penetration = 1;
  let profile: number;
  let depth: number;
  let origin: Point3D;
  let orientation: Orientation;
  if (host.type === 'wall') {
    const hostSection = sections.find((section) => section.id === host.sectionId);
    const thickness = Math.max(getWallThickness(host, hostSection), 1);
    const axes = resolveMemberLocalAxes(
      host.start,
      host.end,
      host.rotation ?? 0,
      host.localAxis,
    );
    const thicknessAxis = scale3(axes.x, -1);
    orientation = {
      axis: thicknessAxis,
      refDirection: axes.z,
    };
    profile = writer.rectangleProfile(
      `OPENING-PROFILE-${opening.id}`,
      opening.width,
      opening.height,
      { x: 0, y: opening.height / 2 },
    );
    depth = thickness + penetration * 2;
    const center = add3(opening.position, memberEccentricityWorld(host, hostSection));
    origin = add3(center, scale3(thicknessAxis, -(thickness / 2 + penetration)));
  } else if (host.type === 'slab') {
    const hostSection = sections.find((section) => section.id === host.sectionId);
    const thickness = Math.max(getSlabThickness(hostSection), 1);
    profile = writer.rectangleProfile(
      `OPENING-PROFILE-${opening.id}`,
      opening.width,
      opening.height,
    );
    depth = thickness + penetration * 2;
    orientation = VERTICAL_ORIENTATION;
    const eccentricity = memberEccentricityWorld(host, hostSection);
    origin = {
      x: opening.position.x + eccentricity.x,
      y: opening.position.y + eccentricity.y,
      z: host.level - thickness - penetration,
    };
  } else {
    warnings.push(`開口 ${opening.id} のホスト ${host.type} はIFC開口に対応しないためスキップしました`);
    return null;
  }

  const solid = writer.extrudedSolid(profile, depth);
  const shape = writer.productShape(contextRef, solid);
  const placement = writer.orientedPlacement(parentPlacementRef, origin, orientation);
  return writer.product(
    'IFCOPENINGELEMENT',
    `opening:${opening.id}`,
    `${opening.type}:${opening.id}`,
    placement,
    shape,
    encodeIfcOpeningMetadata(opening),
  );
}

/** World-space placement delta for a member's axis eccentricity (2-6). */
function memberEccentricityWorld(member: Member, section: Section | undefined): Point3D {
  if (member.type === 'column') return columnAxisOffsetToWorld(member.axisOffset);
  if (member.type === 'slab') return slabAxisOffsetToWorld(member.axisOffset);
  if (member.type === 'beam') {
    const width = getBeamRectSize(section).width;
    return linearAxisOffsetToWorld(
      effectiveLinearAxisOffset(member, width),
      member.start,
      member.end,
    );
  }
  if (member.type === 'wall') {
    const width = getWallThickness(member, section);
    return linearAxisOffsetToWorld(
      effectiveLinearAxisOffset(member, width),
      member.start,
      member.end,
    );
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
    offset: Point3D;
  },
): number {
  const solid = writer.extrudedSolid(options.profileRef, options.depth);
  const shape = writer.productShape(contextRef, solid);
  // Apply axis eccentricity (2-6) by shifting the placement origin in world
  // space, using the shared convention (column: dx→x, dy→y; beam/wall: dx =
  // in-plan perpendicular, dy = vertical) so 2D, 3D and IFC agree. Members
  // without an offset are untouched so existing output stays byte-identical.
  const origin = add3(options.origin, options.offset);
  const placement = writer.orientedPlacement(parentPlacementRef, origin, options.orientation);
  return writer.product(
    options.type,
    `${options.member.type}:${options.member.id}`,
    options.member.id,
    placement,
    shape,
    encodeIfcMemberMetadata(options.member),
  );
}

function memberOrientation(member: Exclude<Member, { type: 'slab' }>): Orientation {
  const axes = resolveMemberLocalAxes(
    member.start,
    member.end,
    member.rotation ?? 0,
    member.localAxis,
  );
  return { axis: axes.z, refDirection: axes.x };
}

function memberLength(start: Point3D, end: Point3D): number {
  return distance3(start, end);
}
