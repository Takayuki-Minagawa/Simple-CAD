import { describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { Material, Member, Opening, ProjectData, Section, Story } from '@/domain/structural/types';
import { exportIfc, importIfc } from '@/domain/integration/ifc';
import { resolvedSolidWorldBounds } from '@/domain/integration/ifc/geometry';
import { resolveIfcElement } from '@/domain/integration/ifc/resolve';
import { asRef, asString, parseIfcEntities } from '@/domain/integration/ifc/step';
import {
  buildStoryHeights,
  collectIfcStories,
  resolveStoryMembership,
} from '@/domain/integration/ifc/stories';
import {
  decodeStepString,
  encodeStepString,
} from '@/domain/integration/ifc/stringEncoding';
import { resolveLengthUnit } from '@/domain/integration/ifc/units';
import { compressIfcUuid } from '@/domain/integration/ifc/writer';
import { resolveMemberLocalAxes } from '@/domain/structural/localAxis';

const base = sampleProject as ProjectData;

function makeProject(options: {
  stories?: Story[];
  sections: Section[];
  materials?: Material[];
  members: Member[];
  openings?: Opening[];
}): ProjectData {
  return {
    ...base,
    project: { ...base.project, id: 'ifc-conformance', name: 'IFC 日本語 😀' },
    stories: options.stories ?? [{ id: 'S1', name: 'Level 1', elevation: 0, height: 3000 }],
    grids: [],
    materials:
      options.materials ?? [{ id: 'M1', name: 'Material', type: 'concrete' }],
    sections: options.sections,
    members: options.members,
    openings: options.openings ?? [],
    annotations: [],
    dimensions: [],
    constructionLines: [],
    views: [],
    sheets: [],
  };
}

function onlyEntity(ifc: string, type: string) {
  const entities = parseIfcEntities(ifc);
  const entity = [...entities.values()].find((candidate) => candidate.type === type);
  expect(entity, `${type} entity`).toBeDefined();
  return { entities, entity: entity! };
}

describe('IFC STEP conformance', () => {
  it('compresses UUIDs in IFC big-endian order with a valid first character', () => {
    const globalId = compressIfcUuid('ffffffff-ffff-ffff-ffff-ffffffffffff');
    expect(globalId).toBe('3$$$$$$$$$$$$$$$$$$$$$');
    expect(globalId).toHaveLength(22);
    expect(globalId).toMatch(/^[0-3][0-9A-Za-z_$]{21}$/);
  });

  it('round-trips STEP X2/X4 strings, apostrophes and literal backslashes', () => {
    const source = "日本語 😀 O'Brien \\ path";
    const encoded = encodeStepString(source);
    expect(encoded).toContain('\\X2\\');
    expect(encoded).toContain('\\X4\\');
    expect(decodeStepString(encoded.replace(/''/g, "'"))).toBe(source);

    const ifc = `ISO-10303-21;HEADER;ENDSEC;DATA;#1=IFCMATERIAL('${encoded}',$,$);ENDSEC;END-ISO-10303-21;`;
    const entity = parseIfcEntities(ifc).get(1)!;
    expect(asString(entity.args[0])).toBe(source);
  });

  it('decodes legacy STEP S escapes with PA-PI code-page directives', () => {
    expect(decodeStepString(String.raw`St\PA\\S\|tzenraster`)).toBe('Stützenraster');
    expect(decodeStepString(String.raw`\PE\\S\0`)).toBe('А');
    const unsupported = String.raw`\PZ\\S\|`;
    expect(decodeStepString(unsupported)).toBe(unsupported);

    const ifc = String.raw`ISO-10303-21;HEADER;ENDSEC;DATA;#1=IFCMATERIAL('St\PA\\S\|tzenraster',$,$);ENDSEC;END-ISO-10303-21;`;
    expect(asString(parseIfcEntities(ifc).get(1)?.args[0])).toBe('Stützenraster');
  });

  it('unwraps typed conversion measures and rejects unknown SI prefixes', () => {
    const wrap = (body: string) =>
      `ISO-10303-21;HEADER;ENDSEC;DATA;${body}ENDSEC;END-ISO-10303-21;`;
    const inch = parseIfcEntities(
      wrap(
        '#1=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);' +
          '#2=IFCMEASUREWITHUNIT(IFCLENGTHMEASURE(0.0254),#1);' +
          "#3=IFCCONVERSIONBASEDUNIT($,.LENGTHUNIT.,'inch',#2);" +
          '#4=IFCUNITASSIGNMENT((#3));',
      ),
    );
    expect(resolveLengthUnit(inch)).toEqual({ scale: 25.4, status: 'resolved' });

    const unknownPrefix = parseIfcEntities(
      wrap(
        '#1=IFCSIUNIT(*,.LENGTHUNIT.,.MEGA.,.METRE.);' +
          '#2=IFCUNITASSIGNMENT((#1));',
      ),
    );
    expect(resolveLengthUnit(unknownPrefix)).toEqual({ scale: 1, status: 'unsupported' });
  });

  it('finds Body after Axis and an extruded solid after a non-solid item', () => {
    const project = makeProject({
      sections: [{ id: 'B', kind: 'rc_beam_rect', width: 300, depth: 600 }],
      members: [
        {
          id: 'B1',
          type: 'beam',
          story: 'S1',
          sectionId: 'B',
          materialId: 'M1',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 5000, y: 0, z: 0 },
        },
      ],
    });
    const { entities, entity } = onlyEntity(exportIfc(project), 'IFCBEAM');
    const shapeRef = asRef(entity.args[6])!;
    const productShape = entities.get(shapeRef)!;
    const bodyRef = asRef((productShape.args[2] as import('../ifc/types').StepValue[])[0])!;
    const body = entities.get(bodyRef)!;
    const fakeCurveId = Math.max(...entities.keys()) + 1;
    const fakeAxisId = fakeCurveId + 1;
    entities.set(fakeCurveId, {
      id: fakeCurveId,
      type: 'IFCPOLYLINE',
      args: [[]],
    });
    entities.set(fakeAxisId, {
      id: fakeAxisId,
      type: 'IFCSHAPEREPRESENTATION',
      args: [null, 'Axis', 'Curve3D', [{ ref: fakeCurveId }]],
    });
    body.args[3] = [{ ref: fakeCurveId }, ...(body.args[3] as import('../ifc/types').StepValue[])];
    productShape.args[2] = [{ ref: fakeAxisId }, { ref: bodyRef }];

    expect(resolveIfcElement(entity, entities)?.depth).toBe(5000);
  });
});

describe('IFC geometry and identity interoperability', () => {
  it('uses world Z extents for story height instead of horizontal extrusion length', () => {
    const project = makeProject({
      sections: [{ id: 'B', kind: 'rc_beam_rect', width: 300, depth: 600 }],
      members: [
        {
          id: 'LONG',
          type: 'beam',
          story: 'S1',
          sectionId: 'B',
          materialId: 'M1',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 100_000, y: 0, z: 0 },
        },
      ],
    });
    const entities = parseIfcEntities(exportIfc(project));
    const elements = [...entities.values()].filter((entity) => entity.type === 'IFCBEAM');
    const stories = buildStoryHeights(
      collectIfcStories(entities),
      elements,
      resolveStoryMembership(entities),
      entities,
    );
    expect(stories[0].height).toBe(3000);
  });

  it('computes exact circular-profile bounds instead of its square envelope', () => {
    const invSqrt2 = 1 / Math.sqrt(2);
    const bounds = resolvedSolidWorldBounds({
      profile: { kind: 'hollowCircle', diameter: 200, wallThickness: 10 },
      depth: 10_000,
      transform: {
        origin: { x: 0, y: 0, z: 0 },
        xAxis: { x: 0, y: invSqrt2, z: invSqrt2 },
        yAxis: { x: 0, y: -invSqrt2, z: invSqrt2 },
        zAxis: { x: 1, y: 0, z: 0 },
      },
    });
    expect(bounds.min.z).toBeCloseTo(-100, 10);
    expect(bounds.max.z).toBeCloseTo(100, 10);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(10_000, 10);
  });

  it('uniquifies duplicate member/material/story names and thickness-sensitive sections', () => {
    const project = makeProject({
      stories: [
        { id: 'S1', name: 'Level', elevation: 0, height: 3000 },
        { id: 'S2', name: 'Level', elevation: 3000, height: 3000 },
      ],
      sections: [
        { id: 'H1', kind: 's_beam_h', width: 300, depth: 500, tw: 10, tf: 16 },
        { id: 'H2', kind: 's_beam_h', width: 300, depth: 500, tw: 12, tf: 20 },
      ],
      materials: [
        { id: 'M1', name: 'Steel A', type: 'steel' },
        { id: 'M2', name: 'Steel B', type: 'steel' },
      ],
      members: [
        {
          id: 'B1',
          type: 'beam',
          story: 'S1',
          sectionId: 'H1',
          materialId: 'M1',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 5000, y: 0, z: 0 },
        },
        {
          id: 'B2',
          type: 'beam',
          story: 'S2',
          sectionId: 'H2',
          materialId: 'M2',
          start: { x: 0, y: 1000, z: 3000 },
          end: { x: 5000, y: 1000, z: 3000 },
        },
      ],
    });
    const ifc = exportIfc(project)
      .replace("'B1'", "'DUP'")
      .replace("'B2'", "'DUP'")
      .replace("IFCMATERIAL('M1'", "IFCMATERIAL('MAT-DUP'")
      .replace("IFCMATERIAL('M2'", "IFCMATERIAL('MAT-DUP'")
      .replace("'SECTION:H1'", "'PROFILE-H1'")
      .replace("'SECTION:H2'", "'PROFILE-H2'");
    const result = importIfc(ifc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.stories.map((story) => story.id)).toEqual(['Level', 'Level-2']);
    expect(result.data.members.map((member) => member.id)).toEqual(['DUP', 'DUP-2']);
    expect(result.data.materials.map((material) => material.id).sort()).toEqual([
      'MAT-DUP',
      'MAT-DUP-2',
    ]);
    expect(result.data.sections.map((section) => section.id).sort()).toEqual([
      'SEC-HB300x500x10x16',
      'SEC-HB300x500x12x20',
    ]);
    expect(result.data.members.map((member) => member.story)).toEqual(['Level', 'Level-2']);
  });

  it('migrates legacy mixed material JSON embedded in IFC descriptions', () => {
    const project = makeProject({
      sections: [{ id: 'B1', kind: 'rc_beam_rect', width: 300, depth: 500 }],
      materials: [{
        id: 'M1',
        name: 'Legacy concrete',
        type: 'concrete',
        Fc: 24,
        Fy: 235,
        poissonRatio: 0.5,
      } as unknown as Material],
      members: [{
        id: 'B1',
        type: 'beam',
        story: 'S1',
        sectionId: 'B1',
        materialId: 'M1',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 4000, y: 0, z: 0 },
      }],
    });

    const result = importIfc(exportIfc(project));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.materials[0]).toMatchObject({
      type: 'concrete',
      Fc: 24,
      poissonRatio: 0.499999,
    });
    expect(result.data.materials[0]).not.toHaveProperty('Fy');
  });

  it('preserves distinct source section IDs even when their dimensions are identical', () => {
    const project = makeProject({
      sections: [
        { id: 'H1', kind: 's_beam_h', width: 300, depth: 500, tw: 10, tf: 16 },
        { id: 'H2', kind: 's_beam_h', width: 300, depth: 500, tw: 10, tf: 16 },
      ],
      members: [
        {
          id: 'B1', type: 'beam', story: 'S1', sectionId: 'H1', materialId: 'M1',
          start: { x: 0, y: 0, z: 0 }, end: { x: 4000, y: 0, z: 0 },
        },
        {
          id: 'B2', type: 'beam', story: 'S1', sectionId: 'H2', materialId: 'M1',
          start: { x: 0, y: 1000, z: 0 }, end: { x: 4000, y: 1000, z: 0 },
        },
      ],
    });

    const result = importIfc(exportIfc(project));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sections.map((section) => section.id).sort()).toEqual(['H1', 'H2']);
    expect(result.data.members.map((member) => member.sectionId)).toEqual(['H1', 'H2']);
  });

  it('exports penetrating wall openings with lower-edge semantics and restores metadata', () => {
    const wall: Extract<Member, { type: 'wall' }> = {
      id: 'W1',
      type: 'wall',
      story: 'S1',
      sectionId: 'W',
      materialId: 'M1',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 4000, y: 0, z: 0 },
      height: 3000,
      thickness: 200,
      axisOffset: { dx: 50, dy: 0 },
      faceAlign: 'left',
    };
    const opening: Opening = {
      id: 'W1',
      memberId: wall.id,
      type: 'window',
      position: { x: 2000, y: 0, z: 900 },
      width: 1800,
      height: 1200,
    };
    const project = makeProject({
      sections: [{ id: 'W', kind: 'rc_wall', thickness: 200 }],
      members: [wall],
      openings: [opening],
    });
    const entities = parseIfcEntities(exportIfc(project));
    const wallEntity = [...entities.values()].find((entity) => entity.type === 'IFCWALL')!;
    const openingEntity = [...entities.values()].find(
      (entity) => entity.type === 'IFCOPENINGELEMENT',
    )!;
    const wallBounds = resolvedSolidWorldBounds(resolveIfcElement(wallEntity, entities)!);
    const openingBounds = resolvedSolidWorldBounds(resolveIfcElement(openingEntity, entities)!);
    expect(wallBounds.min.y).toBeCloseTo(50, 8);
    expect(wallBounds.max.y).toBeCloseTo(250, 8);
    expect(openingBounds.min.y).toBeCloseTo(49, 8);
    expect(openingBounds.max.y).toBeCloseTo(251, 8);
    expect(openingBounds.min.z).toBeCloseTo(900, 8);
    expect(openingBounds.max.z).toBeCloseTo(2100, 8);

    const result = importIfc(exportIfc(project));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.members[0]).toMatchObject({
      id: 'W1',
      start: wall.start,
      end: wall.end,
      axisOffset: wall.axisOffset,
      faceAlign: 'left',
    });
    expect(result.data.openings[0]).toEqual({ ...opening, id: 'W1-2' });

    const withoutOpeningMetadata = exportIfc(project).replace(
      /'SIMPLECAD_OPENING:[^']*'/,
      '$',
    );
    const inferred = importIfc(withoutOpeningMetadata);
    expect(inferred.ok).toBe(true);
    if (!inferred.ok) return;
    expect(inferred.data.openings[0].position).toEqual(opening.position);
  });

  it('penetrates the full slab thickness and applies slab eccentricity', () => {
    const slab: Extract<Member, { type: 'slab' }> = {
      id: 'S1-SLAB',
      type: 'slab',
      story: 'S1',
      sectionId: 'S',
      materialId: 'M1',
      polygon: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 4000 },
        { x: 0, y: 4000 },
      ],
      level: 3000,
      axisOffset: { dx: 10, dy: 20 },
    };
    const opening: Opening = {
      id: 'O1',
      memberId: slab.id,
      type: 'void',
      position: { x: 2000, y: 2000, z: 3000 },
      width: 1000,
      height: 800,
    };
    const project = makeProject({
      sections: [{ id: 'S', kind: 'rc_slab', thickness: 180 }],
      members: [slab],
      openings: [opening],
    });
    const { entities, entity } = onlyEntity(exportIfc(project), 'IFCOPENINGELEMENT');
    const bounds = resolvedSolidWorldBounds(resolveIfcElement(entity, entities)!);
    expect(bounds.min.z).toBeCloseTo(2819, 8);
    expect(bounds.max.z).toBeCloseTo(3001, 8);
    expect((bounds.min.x + bounds.max.x) / 2).toBeCloseTo(2010, 8);
    expect((bounds.min.y + bounds.max.y) / 2).toBeCloseTo(2020, 8);

    const withoutOpeningMetadata = exportIfc(project).replace(
      /'SIMPLECAD_OPENING:[^']*'/,
      '$',
    );
    const result = importIfc(withoutOpeningMetadata);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.openings[0].position).toEqual(opening.position);
  });

  it('shares the full local-axis basis with IFC and restores roll metadata', () => {
    const beam: Extract<Member, { type: 'beam' }> = {
      id: 'B-AXIS',
      type: 'beam',
      story: 'S1',
      sectionId: 'B',
      materialId: 'M1',
      start: { x: 100, y: 200, z: 500 },
      end: { x: 4100, y: 1200, z: 1500 },
      rotation: 0.25,
      localAxis: {
        rotation: -0.1,
        referenceVector: { x: 0, y: 0, z: 1 },
      },
    };
    const project = makeProject({
      sections: [{ id: 'B', kind: 'rc_beam_rect', width: 300, depth: 600 }],
      members: [beam],
    });
    const { entities, entity } = onlyEntity(exportIfc(project), 'IFCBEAM');
    const resolved = resolveIfcElement(entity, entities)!;
    const expected = resolveMemberLocalAxes(beam.start, beam.end, beam.rotation, beam.localAxis);
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(resolved.transform[`${axis}Axis`]).toMatchObject({
        x: expect.closeTo(expected[axis].x, 10),
        y: expect.closeTo(expected[axis].y, 10),
        z: expect.closeTo(expected[axis].z, 10),
      });
    }

    const result = importIfc(exportIfc(project));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.members[0]).toMatchObject({
      start: beam.start,
      end: beam.end,
      rotation: beam.rotation,
      localAxis: beam.localAxis,
    });

    const withoutMetadata = exportIfc(project).replace(/'SIMPLECAD_MEMBER:[^']*'/, '$');
    const inferred = importIfc(withoutMetadata);
    expect(inferred.ok).toBe(true);
    if (!inferred.ok) return;
    expect(inferred.data.members[0].rotation).toBeCloseTo(
      beam.rotation! + beam.localAxis!.rotation,
      8,
    );
  });
});
