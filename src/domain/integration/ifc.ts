import { v5 as uuidv5 } from 'uuid';
import type { Point2D, Point3D } from '@/domain/geometry/types';
import type {
  Member,
  PlanView,
  ProjectData,
  Section,
  Sheet,
  Story,
  View,
} from '@/domain/structural/types';
import { validateProject } from '@/domain/validation';
import type { ValidationError } from '@/domain/validation';

const IFC_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

type Vector3 = Point3D;

type StepScalar = string | number | null | { ref: number };
type StepValue = StepScalar | StepValue[];

interface StepEntity {
  id: number;
  type: string;
  args: StepValue[];
}

interface Transform3D {
  origin: Point3D;
  xAxis: Vector3;
  yAxis: Vector3;
  zAxis: Vector3;
}

interface RectangleProfile {
  kind: 'rectangle';
  xDim: number;
  yDim: number;
}

interface PolylineProfile {
  kind: 'polyline';
  points: Point2D[];
}

type Profile = RectangleProfile | PolylineProfile;

interface ResolvedSolid {
  profile: Profile;
  depth: number;
  transform: Transform3D;
}

const IFC_SCHEMA = 'IFC4';
const DEFAULT_TRANSFORM: Transform3D = {
  origin: { x: 0, y: 0, z: 0 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
  zAxis: { x: 0, y: 0, z: 1 },
};

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

export function importIfc(
  rawContent: string,
): { ok: true; data: ProjectData } | { ok: false; errors: ValidationError[] } {
  let entities: Map<number, StepEntity>;
  try {
    entities = parseIfcEntities(rawContent);
  } catch (error) {
    return {
      ok: false,
      errors: [{ level: 'error', message: `IFC parse error: ${String(error)}` }],
    };
  }

  const supportedElements = [...entities.values()].filter((entity) =>
    ['IFCCOLUMN', 'IFCBEAM', 'IFCWALL', 'IFCSLAB'].includes(entity.type),
  );
  if (supportedElements.length === 0) {
    return {
      ok: false,
      errors: [{ level: 'error', message: 'No supported IFC elements were found.' }],
    };
  }

  const storyMembership = resolveStoryMembership(entities);
  const rawStories = collectIfcStories(entities);
  const inferredStories = rawStories.length > 0 ? rawStories : [{ id: '1F', name: '1F', elevation: 0 }];
  const stories = buildStoryHeights(inferredStories, supportedElements, storyMembership, entities);

  const materialId = 'MAT-IFC';
  const sections = new Map<string, Section>();
  const members: Member[] = [];

  for (const entity of supportedElements) {
    const resolved = resolveIfcElement(entity, entities);
    if (!resolved) continue;

    const storyId = resolveElementStoryId(entity.id, stories, storyMembership, resolved, entities);
    if (!storyId) continue;

    switch (entity.type) {
      case 'IFCCOLUMN': {
        if (resolved.profile.kind !== 'rectangle') break;
        const sectionId = ensureSection(sections, {
          id: '',
          kind: 'rc_column_rect',
          width: resolved.profile.xDim,
          depth: resolved.profile.yDim,
        });
        const start = resolved.transform.origin;
        const end = add3(start, scale3(resolved.transform.zAxis, resolved.depth));
        members.push({
          id: resolveElementName(entity),
          type: 'column',
          story: storyId,
          sectionId,
          materialId,
          start,
          end,
        });
        break;
      }
      case 'IFCBEAM': {
        if (resolved.profile.kind !== 'rectangle') break;
        const sectionId = ensureSection(sections, {
          id: '',
          kind: 'rc_beam_rect',
          width: resolved.profile.xDim,
          depth: resolved.profile.yDim,
        });
        const start = resolved.transform.origin;
        const end = add3(start, scale3(resolved.transform.zAxis, resolved.depth));
        members.push({
          id: resolveElementName(entity),
          type: 'beam',
          story: storyId,
          sectionId,
          materialId,
          start,
          end,
        });
        break;
      }
      case 'IFCWALL': {
        if (resolved.profile.kind !== 'rectangle') break;
        const sectionId = ensureSection(sections, {
          id: '',
          kind: 'rc_wall',
          thickness: resolved.profile.xDim,
        });
        const start = resolved.transform.origin;
        const end = add3(start, scale3(resolved.transform.zAxis, resolved.depth));
        members.push({
          id: resolveElementName(entity),
          type: 'wall',
          story: storyId,
          sectionId,
          materialId,
          start,
          end,
          height: resolved.profile.yDim,
          thickness: resolved.profile.xDim,
        });
        break;
      }
      case 'IFCSLAB': {
        if (resolved.profile.kind !== 'polyline') break;
        const sectionId = ensureSection(sections, {
          id: '',
          kind: 'rc_slab',
          thickness: resolved.depth,
        });
        const polygon = resolved.profile.points.map((point) =>
          applyTransform2D(resolved.transform, point),
        );
        members.push({
          id: resolveElementName(entity),
          type: 'slab',
          story: storyId,
          sectionId,
          materialId,
          polygon,
          level: resolved.transform.origin.z + resolved.depth,
        });
        break;
      }
    }
  }

  if (members.length === 0) {
    return {
      ok: false,
      errors: [{ level: 'error', message: 'Failed to extract supported IFC members.' }],
    };
  }

  const views = createDefaultViews(stories, members);
  const sheets = createDefaultSheets('IFC Import', stories);
  const project: ProjectData = {
    schemaVersion: '1.0.0',
    project: {
      id: `ifc-${Date.now()}`,
      name: resolveProjectName(entities) ?? 'IFC Import',
      unit: 'mm',
    },
    stories,
    grids: [],
    materials: [{ id: materialId, name: 'IFC Default', type: 'concrete' }],
    sections: [...sections.values()],
    members,
    openings: [],
    annotations: [],
    dimensions: [],
    views,
    sheets,
    issues: [],
  };

  const validation = validateProject(project);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  return { ok: true, data: project };
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
      const height = Math.max(distance3(member.start, member.end), 1);
      const profile = writer.rectangleProfile(`PROFILE-${member.id}`, width, depth);
      const solid = writer.extrudedSolid(profile, height);
      const shape = writer.productShape(contextRef, solid);
      const placement = writer.orientedPlacement(parentPlacementRef, member.start, {
        axis: { x: 0, y: 0, z: 1 },
        refDirection: { x: 1, y: 0, z: 0 },
      });
      return writer.product(
        'IFCCOLUMN',
        `column:${member.id}`,
        member.id,
        placement,
        shape,
      );
    }
    case 'beam': {
      const width = section && 'width' in section ? section.width : 300;
      const depth = section && 'depth' in section ? section.depth : 600;
      const direction = normalize3(sub3(member.end, member.start));
      const length = Math.max(distance3(member.start, member.end), 1);
      const transverse = perpendicularHorizontal(direction);
      const profile = writer.rectangleProfile(`PROFILE-${member.id}`, width, depth);
      const solid = writer.extrudedSolid(profile, length);
      const shape = writer.productShape(contextRef, solid);
      const placement = writer.orientedPlacement(parentPlacementRef, member.start, {
        axis: direction,
        refDirection: transverse,
      });
      return writer.product(
        'IFCBEAM',
        `beam:${member.id}`,
        member.id,
        placement,
        shape,
      );
    }
    case 'wall': {
      const thickness = section && 'thickness' in section ? section.thickness : member.thickness;
      const direction = normalize3(sub3(member.end, member.start));
      const length = Math.max(distance3(member.start, member.end), 1);
      const transverse = perpendicularHorizontal(direction);
      const profile = writer.rectangleProfile(`PROFILE-${member.id}`, thickness, member.height, {
        x: 0,
        y: member.height / 2,
      });
      const solid = writer.extrudedSolid(profile, length);
      const shape = writer.productShape(contextRef, solid);
      const placement = writer.orientedPlacement(parentPlacementRef, member.start, {
        axis: direction,
        refDirection: transverse,
      });
      return writer.product(
        'IFCWALL',
        `wall:${member.id}`,
        member.id,
        placement,
        shape,
      );
    }
    case 'slab': {
      const thickness = section && 'thickness' in section ? section.thickness : 180;
      const baseZ = member.level - thickness;
      const profile = writer.polylineProfile(
        `PROFILE-${member.id}`,
        member.polygon.map((point) => ({ x: point.x, y: point.y })),
      );
      const solid = writer.extrudedSolid(profile, thickness);
      const shape = writer.productShape(contextRef, solid);
      const placement = writer.orientedPlacement(parentPlacementRef, { x: 0, y: 0, z: baseZ }, {
        axis: { x: 0, y: 0, z: 1 },
        refDirection: { x: 1, y: 0, z: 0 },
      });
      return writer.product(
        'IFCSLAB',
        `slab:${member.id}`,
        member.id,
        placement,
        shape,
      );
    }
  }
}

function resolveStoryMembership(entities: Map<number, StepEntity>): Map<number, number> {
  const membership = new Map<number, number>();
  for (const entity of entities.values()) {
    if (entity.type !== 'IFCRELCONTAINEDINSPATIALSTRUCTURE') continue;
    const related = asRefList(entity.args[4]);
    const storyRef = asRef(entity.args[5]);
    if (!storyRef) continue;
    for (const ref of related) {
      membership.set(ref, storyRef);
    }
  }
  return membership;
}

function collectIfcStories(entities: Map<number, StepEntity>): Array<{ id: string; name: string; elevation: number }> {
  return [...entities.values()]
    .filter((entity) => entity.type === 'IFCBUILDINGSTOREY')
    .map((entity, index) => {
      const name = asString(entity.args[2]) ?? `Story ${index + 1}`;
      const placement = resolveLocalPlacement(entities, asRef(entity.args[5]));
      const elevation = asNumber(entity.args[9]) ?? placement.origin.z;
      return {
        id: sanitizeId(name, index + 1),
        name,
        elevation,
      };
    })
    .sort((a, b) => a.elevation - b.elevation);
}

function buildStoryHeights(
  rawStories: Array<{ id: string; name: string; elevation: number }>,
  elements: StepEntity[],
  membership: Map<number, number>,
  entities: Map<number, StepEntity>,
): Story[] {
  const sorted = [...rawStories].sort((a, b) => a.elevation - b.elevation);
  const result: Story[] = [];

  for (let index = 0; index < sorted.length; index++) {
    const story = sorted[index];
    const next = sorted[index + 1];
    let top = story.elevation + 3000;
    for (const element of elements) {
      const storyRef = membership.get(element.id);
      if (storyRef) {
        const entity = entities.get(storyRef);
        if (entity && (asString(entity.args[2]) ?? '') !== story.name) continue;
      }
      const resolved = resolveIfcElement(element, entities);
      if (!resolved) continue;
      top = Math.max(top, resolved.transform.origin.z + resolved.depth);
    }

    result.push({
      id: story.id,
      name: story.name,
      elevation: story.elevation,
      height: Math.max((next?.elevation ?? top) - story.elevation, 1000),
    });
  }

  return result;
}

function resolveElementStoryId(
  elementId: number,
  stories: Story[],
  membership: Map<number, number>,
  resolved: ResolvedSolid,
  entities: Map<number, StepEntity>,
): string | null {
  const storyRef = membership.get(elementId);
  if (storyRef) {
    const storyEntity = entities.get(storyRef);
    const storyName = storyEntity ? asString(storyEntity.args[2]) : null;
    const story = stories.find((item) => item.name === storyName);
    if (story) return story.id;
  }

  const z = resolved.transform.origin.z;
  const matching = [...stories]
    .sort((a, b) => a.elevation - b.elevation)
    .findLast((story) => z >= story.elevation);
  return matching?.id ?? stories[0]?.id ?? null;
}

function resolveIfcElement(entity: StepEntity, entities: Map<number, StepEntity>): ResolvedSolid | null {
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
  const shapeRef = asRefList(representation.args[2])[0];
  const shape = shapeRef ? entities.get(shapeRef) : null;
  if (!shape || shape.type !== 'IFCSHAPEREPRESENTATION') return null;
  const solidRef = asRefList(shape.args[3])[0];
  const solid = solidRef ? entities.get(solidRef) : null;
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
    return {
      kind: 'polyline',
      points,
    };
  }

  return null;
}

function resolveLocalPlacement(
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

function resolveProjectName(entities: Map<number, StepEntity>): string | null {
  const project = [...entities.values()].find((entity) => entity.type === 'IFCPROJECT');
  return project ? asString(project.args[2]) : null;
}

function resolveElementName(entity: StepEntity): string {
  return asString(entity.args[2]) ?? asString(entity.args[0]) ?? `IFC-${entity.id}`;
}

function ensureSection(sections: Map<string, Section>, section: Section): string {
  const key = JSON.stringify(section);
  const existing = [...sections.values()].find((item) => JSON.stringify(item) === key);
  if (existing) return existing.id;

  const id =
    section.kind === 'rc_column_rect'
      ? `SEC-C${section.width}x${section.depth}`
      : section.kind === 'rc_beam_rect'
        ? `SEC-B${section.width}x${section.depth}`
        : section.kind === 'rc_wall'
          ? `SEC-W${section.thickness}`
          : `SEC-S${section.thickness}`;

  const next = { ...section, id };
  sections.set(id, next);
  return id;
}

function createDefaultViews(stories: Story[], members: Member[]): View[] {
  const views: View[] = stories.map((story) => {
    const extents = computeStoryExtents(story.id, members);
    return {
      id: `VIEW-${story.id}-PLAN`,
      type: 'plan',
      story: story.id,
      center: extents.center,
      width: extents.width,
      height: extents.height,
      rotation: 0,
    } satisfies PlanView;
  });

  if (stories.length > 0) {
    views.push({
      id: 'VIEW-3D-001',
      type: 'model3d',
      story: stories[0].id,
    });
  }

  return views;
}

function createDefaultSheets(projectName: string, stories: Story[]): Sheet[] {
  return stories.map((story, index) => ({
    id: `S-${String(index + 1).padStart(3, '0')}`,
    name: `${story.name}平面図`,
    paperSize: 'A1',
    scale: '1:100',
    viewIds: [`VIEW-${story.id}-PLAN`],
    titleBlockTemplate: 'standard',
    titleBlock: {
      projectName,
      drawingTitle: `${story.name}平面図`,
      issueDate: new Date().toISOString().slice(0, 10),
    },
  }));
}

function computeStoryExtents(storyId: string, members: Member[]): {
  center: Point2D;
  width: number;
  height: number;
} {
  const points: Point2D[] = [];
  for (const member of members) {
    if (member.story !== storyId) continue;
    if (member.type === 'slab') {
      points.push(...member.polygon);
      continue;
    }
    points.push(
      { x: member.start.x, y: member.start.y },
      { x: member.end.x, y: member.end.y },
    );
  }

  if (points.length === 0) {
    return {
      center: { x: 4000, y: 3000 },
      width: 14000,
      height: 11000,
    };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    width: Math.max(maxX - minX + 4000, 8000),
    height: Math.max(maxY - minY + 4000, 6000),
  };
}

function parseIfcEntities(content: string): Map<number, StepEntity> {
  const dataMatch = content.match(/DATA;([\s\S]*?)ENDSEC;/i);
  if (!dataMatch) throw new Error('IFC DATA section was not found.');

  const statements = splitIfcStatements(dataMatch[1]);
  const entities = new Map<number, StepEntity>();

  for (const statement of statements) {
    const match = statement.match(/^#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*)\)$/i);
    if (!match) continue;

    const [, rawId, rawType, rawArgs] = match;
    const parsed = parseStepList(`(${rawArgs})`);
    entities.set(Number(rawId), {
      id: Number(rawId),
      type: rawType.toUpperCase(),
      args: parsed,
    });
  }

  return entities;
}

function splitIfcStatements(content: string): string[] {
  const statements: string[] = [];
  let buffer = '';
  let depth = 0;
  let inString = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    const next = content[index + 1];
    buffer += char;

    if (char === '\'' && next === '\'') {
      buffer += next;
      index++;
      continue;
    }

    if (char === '\'') {
      inString = !inString;
      continue;
    }

    if (inString) continue;
    if (char === '(') depth++;
    if (char === ')') depth--;

    if (char === ';' && depth === 0) {
      const statement = buffer.trim().slice(0, -1).trim();
      if (statement.length > 0) statements.push(statement);
      buffer = '';
    }
  }

  return statements;
}

function parseStepList(source: string): StepValue[] {
  const parser = createStepParser(source);
  const value = parser.parseValue();
  if (!Array.isArray(value)) {
    throw new Error('STEP arguments must be a list.');
  }
  parser.skipWhitespace();
  return value;
}

function createStepParser(source: string) {
  let index = 0;

  const skipWhitespace = () => {
    while (index < source.length && /\s/.test(source[index])) index++;
  };

  const parseString = () => {
    index++;
    let value = '';
    while (index < source.length) {
      const char = source[index];
      const next = source[index + 1];
      if (char === '\'' && next === '\'') {
        value += '\'';
        index += 2;
        continue;
      }
      if (char === '\'') {
        index++;
        break;
      }
      value += char;
      index++;
    }
    return value;
  };

  const parseWord = () => {
    const start = index;
    while (index < source.length && /[A-Z0-9_\-.]/i.test(source[index])) index++;
    return source.slice(start, index);
  };

  const parseList = (): StepValue[] => {
    index++;
    const values: StepValue[] = [];
    while (index < source.length) {
      skipWhitespace();
      if (source[index] === ')') {
        index++;
        break;
      }
      values.push(parseValue());
      skipWhitespace();
      if (source[index] === ',') index++;
    }
    return values;
  };

  const parseValue = (): StepValue => {
    skipWhitespace();
    const char = source[index];

    if (char === '(') return parseList();
    if (char === '\'') return parseString();
    if (char === '$' || char === '*') {
      index++;
      return null;
    }
    if (char === '#') {
      index++;
      return { ref: Number(parseWord()) };
    }
    if (char === '.') {
      index++;
      const value = parseWord();
      if (source[index] === '.') index++;
      return value;
    }

    const word = parseWord();
    const number = Number(word);
    return Number.isFinite(number) ? number : word;
  };

  return { parseValue, skipWhitespace };
}

class IfcWriter {
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

function toIfcGlobalId(seed: string): string {
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

function escapeIfcString(value: string): string {
  return value.replace(/'/g, "''");
}

function asRef(value: StepValue | undefined): number | null {
  return isRef(value) ? value.ref : null;
}

function asRefList(value: StepValue | undefined): number[] {
  return Array.isArray(value) ? value.map((item) => asRef(item)).filter((item): item is number => item !== null) : [];
}

function asString(value: StepValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: StepValue | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function asNumberList(value: StepValue | undefined): number[] {
  return Array.isArray(value) ? value.map((item) => asNumber(item)).filter((item): item is number => item !== null) : [];
}

function isRef(value: StepValue | undefined): value is { ref: number } {
  return typeof value === 'object' && value !== null && 'ref' in value;
}

function isCartesianPointEntity(value: StepEntity | undefined): value is StepEntity {
  return value !== undefined && value.type === 'IFCCARTESIANPOINT';
}

function sanitizeId(name: string, index: number): string {
  const value = name.replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return value || `STORY-${index}`;
}

function applyTransform2D(transform: Transform3D, point: Point2D): Point2D {
  const world = add3(
    transform.origin,
    add3(scale3(transform.xAxis, point.x), scale3(transform.yAxis, point.y)),
  );
  return { x: world.x, y: world.y };
}

function composeTransform(parent: Transform3D, child: Transform3D): Transform3D {
  return {
    origin: add3(
      parent.origin,
      add3(
        add3(scale3(parent.xAxis, child.origin.x), scale3(parent.yAxis, child.origin.y)),
        scale3(parent.zAxis, child.origin.z),
      ),
    ),
    xAxis: transformDirection(parent, child.xAxis),
    yAxis: transformDirection(parent, child.yAxis),
    zAxis: transformDirection(parent, child.zAxis),
  };
}

function transformDirection(transform: Transform3D, vector: Vector3): Vector3 {
  return normalize3(
    add3(
      add3(scale3(transform.xAxis, vector.x), scale3(transform.yAxis, vector.y)),
      scale3(transform.zAxis, vector.z),
    ),
  );
}

function defaultRefDirection(axis: Vector3): Vector3 {
  if (Math.abs(axis.z) > 0.99) {
    return { x: 1, y: 0, z: 0 };
  }
  return normalize3(cross3({ x: 0, y: 0, z: 1 }, axis));
}

function perpendicularHorizontal(direction: Vector3): Vector3 {
  const result = cross3({ x: 0, y: 0, z: 1 }, direction);
  const length = length3(result);
  if (length < 1e-6) return { x: 1, y: 0, z: 0 };
  return normalize3(result);
}

function add3(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub3(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale3(vector: Vector3, scalar: number): Vector3 {
  return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar };
}

function cross3(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function length3(vector: Vector3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize3(vector: Vector3): Vector3 {
  const length = length3(vector);
  if (length < 1e-9) return { x: 1, y: 0, z: 0 };
  return scale3(vector, 1 / length);
}

function distance3(a: Vector3, b: Vector3): number {
  return length3(sub3(a, b));
}
