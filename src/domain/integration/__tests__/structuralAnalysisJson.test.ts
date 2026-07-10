import { describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import {
  exportStructuralAnalysisModel,
  importStructuralAnalysisJson,
  STRUCTURAL_ANALYSIS_SCHEMA,
} from '@/domain/integration/structuralAnalysisJson';
import type { ProjectData } from '@/domain/structural/types';

describe('structuralAnalysisJson', () => {
  it('exports a normalized structural analysis model', () => {
    const model = exportStructuralAnalysisModel(sampleProject as ProjectData);

    expect(model.schema).toBe(STRUCTURAL_ANALYSIS_SCHEMA);
    expect(model.linearMembers).toHaveLength(12);
    expect(model.areaMembers).toHaveLength(1);
    expect(model.nodes.length).toBeLessThan((sampleProject as ProjectData).members.length * 2);
  });

  it('imports structural analysis json into a valid project', () => {
    const json = JSON.stringify(exportStructuralAnalysisModel(sampleProject as ProjectData), null, 2);

    const result = importStructuralAnalysisJson(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.project.name).toBe('rc-sample');
    expect(result.data.members).toHaveLength((sampleProject as ProjectData).members.length);
    expect(result.data.stories).toHaveLength(2);
    expect(result.data.views.find((view) => view.type === 'model3d')).toBeTruthy();
    expect(result.data.sheets).toHaveLength(2);
  });

  it('round-trips common and wood-specific material properties', () => {
    const base = sampleProject as ProjectData;
    const woodMaterial = {
      id: 'MAT-WOOD',
      name: 'Wood E70',
      type: 'wood' as const,
      elasticModulus: 7000,
      shearModulus: 440,
      poissonRatio: 0.3,
      unitWeight: 3.8,
      referenceStrength: 21.6,
      moistureContent: 15,
      allowableBendingStress: 7.2,
      allowableCompressionStress: 6,
      allowableShearStress: 0.6,
    };
    const project: ProjectData = {
      ...base,
      materials: [woodMaterial],
      members: base.members.map((member) => ({ ...member, materialId: woodMaterial.id })),
    };

    const model = exportStructuralAnalysisModel(project);
    expect(model.materials).toEqual([woodMaterial]);
    const result = importStructuralAnalysisJson(JSON.stringify(model));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.materials).toEqual([woodMaterial]);
  });

  it('migrates legacy mixed-family material properties and poissonRatio 0.5', () => {
    const model = exportStructuralAnalysisModel(sampleProject as ProjectData);
    model.materials = [{
      ...model.materials[0],
      type: 'concrete',
      Fc: 24,
      Fy: 235,
      poissonRatio: 0.5,
    } as unknown as ProjectData['materials'][number]];

    const result = importStructuralAnalysisJson(JSON.stringify(model));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.materials[0]).toMatchObject({
      type: 'concrete',
      Fc: 24,
      poissonRatio: 0.499999,
    });
    expect(result.data.materials[0]).not.toHaveProperty('Fy');
  });

  it('bakes face alignment into the v1 axis offset without double-applying it', () => {
    const base = sampleProject as ProjectData;
    const sourceBeam = base.members.find((member) => member.type === 'beam')!;
    const project: ProjectData = {
      ...base,
      members: base.members.map((member) =>
        member.id === sourceBeam.id
          ? {
              ...member,
              axisOffset: { dx: 25, dy: 10 },
              faceAlign: 'left' as const,
            }
          : member,
      ),
    };

    const model = exportStructuralAnalysisModel(project);
    const exported = model.linearMembers.find((member) => member.id === sourceBeam.id)!;
    // 25mm explicit offset + half the 300mm beam width. No new v1 fields are
    // emitted, so existing strict structural-analysis consumers remain valid.
    expect(exported.axisOffset).toEqual({ dx: 175, dy: 10 });
    expect(exported).not.toHaveProperty('faceAlign');
    expect(exported).not.toHaveProperty('effectiveAxisOffset');

    const imported = importStructuralAnalysisJson(JSON.stringify(model));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.data.members.find((member) => member.id === sourceBeam.id)).toMatchObject({
      axisOffset: { dx: 175, dy: 10 },
    });

    // Re-exporting proves the baked value remains stable rather than applying
    // face alignment a second time.
    expect(
      exportStructuralAnalysisModel(imported.data).linearMembers.find(
        (member) => member.id === sourceBeam.id,
      )?.axisOffset,
    ).toEqual({ dx: 175, dy: 10 });
  });

  it('rejects unsupported schemas', () => {
    const result = importStructuralAnalysisJson(
      JSON.stringify({
        schema: 'other-schema',
        meta: { projectId: 'p1', projectName: 'demo', unit: 'mm' },
        stories: [],
        grids: [],
        materials: [],
        sections: [],
        nodes: [],
        linearMembers: [],
        areaMembers: [],
        openings: [],
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.message).toContain('Unsupported structural analysis schema');
  });

  it('round-trips supports, releases, user loads, combinations, masses, diaphragms and results', () => {
    const base = sampleProject as ProjectData;
    const linear = base.members.find((member) => member.type !== 'slab')!;
    const slab = base.members.find((member) => member.type === 'slab')!;
    const project: ProjectData = {
      ...base,
      members: base.members.map((member) =>
        member.id === linear.id
          ? {
              ...member,
              releases: { end: { rz: true } },
              rigidZones: { start: 250, end: 300 },
              localAxis: { rotation: Math.PI / 12, referenceVector: { x: 1, y: 0, z: 0 } },
            }
          : member,
      ),
      loadCases: [{ id: 'LC-D', name: 'Dead', type: 'dead' }],
      supports: [
        {
          id: 'SUP-1',
          storyId: linear.story,
          position: { ...linear.start },
          restraints: { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true },
        },
      ],
      nodalLoads: [
        {
          id: 'NL-1',
          loadCaseId: 'LC-D',
          storyId: linear.story,
          position: { ...linear.end },
          force: { x: 0, y: 0, z: -10 },
        },
      ],
      memberLoads: [
        {
          id: 'ML-1',
          loadCaseId: 'LC-D',
          memberId: linear.id,
          kind: 'uniform',
          direction: 'globalZ',
          magnitude: -5,
        },
      ],
      areaLoads: [
        {
          id: 'AL-1',
          loadCaseId: 'LC-D',
          memberId: slab.id,
          direction: 'globalZ',
          magnitude: -3,
        },
      ],
      loadCombinations: [
        { id: 'COMB-1', name: '1.0D', type: 'linear', factors: [{ loadCaseId: 'LC-D', factor: 1 }] },
      ],
      masses: [
        {
          id: 'MASS-1',
          storyId: linear.story,
          position: { ...linear.start },
          mass: { x: 1, y: 1, z: 1 },
        },
      ],
      diaphragms: [
        { id: 'DIA-1', storyId: slab.story, type: 'rigid', memberIds: [slab.id] },
      ],
      analysisResults: {
        source: 'unit-test',
        analysisType: 'static',
        generatedAt: '2026-01-01T00:00:00.000Z',
        combinationId: 'COMB-1',
        deformationScale: 50,
        nodeDisplacements: [
          { position: { ...linear.end }, dx: 0.1, dy: 0, dz: -1.2 },
        ],
        memberResults: [{ memberId: linear.id, axial: -100, utilization: 0.72 }],
      },
    };

    const model = exportStructuralAnalysisModel(project);
    const exportedLinear = model.linearMembers.find((member) => member.id === linear.id);
    expect(exportedLinear).toMatchObject({
      releases: { end: { rz: true } },
      rigidZones: { start: 250, end: 300 },
    });
    const result = importStructuralAnalysisJson(JSON.stringify(model));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.supports).toEqual(project.supports);
    expect(result.data.nodalLoads).toEqual(project.nodalLoads);
    expect(result.data.memberLoads).toEqual(project.memberLoads);
    expect(result.data.areaLoads).toEqual(project.areaLoads);
    expect(result.data.loadCombinations).toEqual(project.loadCombinations);
    expect(result.data.masses).toEqual(project.masses);
    expect(result.data.diaphragms).toEqual(project.diaphragms);
    expect(result.data.analysisResults).toEqual(project.analysisResults);
  });

  it('merges joints within 1mm even when points straddle a spatial-cell boundary', () => {
    const base = sampleProject as ProjectData;
    const project: ProjectData = {
      ...base,
      openings: [],
      members: [
        {
          id: 'B1', type: 'beam', story: '1F', sectionId: 'SEC-B300x600', materialId: 'MAT-RC-24',
          start: { x: 0.99, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 },
        },
        {
          id: 'B2', type: 'beam', story: '1F', sectionId: 'SEC-B300x600', materialId: 'MAT-RC-24',
          start: { x: 1.01, y: 0, z: 0 }, end: { x: 2000, y: 0, z: 0 },
        },
      ],
    };

    const model = exportStructuralAnalysisModel(project);
    expect(model.linearMembers[0].startNodeId).toBe(model.linearMembers[1].startNodeId);
  });

  it('rejects dangling area/opening/load references before conversion', () => {
    const model = exportStructuralAnalysisModel(sampleProject as ProjectData);
    model.areaMembers[0] = { ...model.areaMembers[0], nodeIds: ['N-MISSING', ...model.areaMembers[0].nodeIds.slice(1)] };
    model.openings[0] = { ...model.openings[0], memberId: 'M-MISSING' };
    model.loadCases = [{ id: 'LC-1', name: 'Dead', type: 'dead' }];
    model.memberLoads = [
      {
        id: 'ML-BAD', loadCaseId: 'LC-MISSING', memberId: 'M-MISSING', kind: 'point',
        direction: 'globalZ', magnitude: -1, position: 0.5,
      },
    ];

    const result = importStructuralAnalysisJson(JSON.stringify(model));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.message.includes('missing node'))).toBe(true);
    expect(result.errors.some((error) => error.message.includes('missing member'))).toBe(true);
    expect(result.errors.some((error) => error.message.includes('missing load case'))).toBe(true);
  });

  it('rejects an area load assigned to a linear member', () => {
    const model = exportStructuralAnalysisModel(sampleProject as ProjectData);
    model.loadCases = [{ id: 'LC-1', name: 'Dead', type: 'dead' }];
    model.areaLoads = [
      {
        id: 'AL-BAD',
        loadCaseId: 'LC-1',
        memberId: model.linearMembers[0].id,
        direction: 'globalZ',
        magnitude: -1,
      },
    ];

    const result = importStructuralAnalysisJson(JSON.stringify(model));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.message.includes('missing area member'))).toBe(true);
  });
});
