import { beforeEach, describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import { useProjectStore } from '@/app/store/projectStore';
import { useEditorStore } from '@/app/store/editorStore';
import type { ProjectData } from '@/domain/structural/types';

describe('projectStore duplicateStory', () => {
  beforeEach(() => {
    const cloned = JSON.parse(JSON.stringify(sampleProject)) as ProjectData;
    useProjectStore.getState().loadProject(cloned);
  });

  it('clears incompatible material properties when its type changes', () => {
    const store = useProjectStore.getState();
    const id = store.data!.materials[0].id;
    store.updateMaterial(id, {
      type: 'concrete',
      elasticModulus: 22500,
      Fc: 24,
    });
    store.updateMaterial(id, {
      type: 'wood',
      referenceStrength: 21.6,
      moistureContent: 15,
    });

    const material = useProjectStore.getState().data!.materials.find((item) => item.id === id)!;
    expect(material).toMatchObject({
      type: 'wood',
      elasticModulus: 22500,
      referenceStrength: 21.6,
      moistureContent: 15,
    });
    expect('Fc' in material).toBe(false);
    expect('F' in material).toBe(false);
    expect('Fy' in material).toBe(false);
  });

  it('duplicates story-linked data and shifts member elevations', () => {
    const createdId = useProjectStore.getState().duplicateStory('1F', {
      id: '3F',
      name: '3F',
      elevation: 6000,
      height: 3000,
    });

    const data = useProjectStore.getState().data!;
    const clonedColumn = data.members.find((member) => member.id === 'C-X1Y1-3F');
    const clonedOpening = data.openings.find((opening) => opening.id === 'OP-W1-3F');
    const clonedAnnotation = data.annotations.find((annotation) => annotation.id === 'NOTE-001-3F');
    const clonedDimension = data.dimensions.find((dimension) => dimension.id === 'DIM-X-001-3F');
    const clonedPlanView = data.views.find((view) => view.id === 'VIEW-3F-PLAN');
    const cloned3dView = data.views.find((view) => view.id === 'VIEW-3D-001-3F');
    const clonedSheet = data.sheets.find((sheet) => sheet.id === 'S-001-3F');

    expect(createdId).toBe('3F');
    expect(data.stories.some((story) => story.id === '3F')).toBe(true);
    expect(clonedColumn).toMatchObject({
      type: 'column',
      story: '3F',
      start: { x: 0, y: 0, z: 6000 },
      end: { x: 0, y: 0, z: 9000 },
    });
    expect(clonedOpening).toMatchObject({
      memberId: 'W-X3-Y1Y2-3F',
      position: { x: 8000, y: 3000, z: 6900 },
    });
    expect(clonedAnnotation?.story).toBe('3F');
    expect(clonedDimension?.story).toBe('3F');
    expect(clonedPlanView?.story).toBe('3F');
    expect(cloned3dView?.story).toBe('3F');
    expect(clonedSheet).toMatchObject({
      name: '3F平面図',
      viewIds: ['VIEW-3F-PLAN'],
    });
    expect(clonedSheet?.titleBlock?.drawingTitle).toBe('3F平面図');
  });

  it('remaps associative member references and nested viewport references', () => {
    const store = useProjectStore.getState();
    const beam = store.data!.members.find((member) => member.type === 'beam')!;
    const dimension = store.data!.dimensions.find((item) => item.story === '1F')!;
    store.updateDimension(dimension.id, {
      associative: true,
      refMemberIds: [beam.id],
    });
    const sheet = useProjectStore.getState().data!.sheets.find((item) => item.id === 'S-001')!;
    const viewId = sheet.viewIds[0];
    store.addViewport({
      id: 'VP-1F',
      sheetId: sheet.id,
      viewId,
      x: 10,
      y: 10,
      width: 100,
      height: 100,
      scale: '1:100',
    });

    store.duplicateStory('1F', { id: '3F', name: '3F', elevation: 6000, height: 3000 });
    const data = useProjectStore.getState().data!;
    const copiedDimension = data.dimensions.find((item) => item.id === `${dimension.id}-3F`)!;
    expect(copiedDimension.refMemberIds).toEqual([beam.id.replace('1F', '3F')]);
    const copiedSheet = data.sheets.find((item) => item.id === 'S-001-3F')!;
    expect(copiedSheet.viewports?.[0]).toMatchObject({
      id: 'VP-3F',
      sheetId: 'S-001-3F',
      viewId: 'VIEW-3F-PLAN',
    });
  });

  it('duplicates story-scoped analysis model data and remaps member loads', () => {
    const data = useProjectStore.getState().data!;
    const beam = data.members.find((member) => member.type === 'beam' && member.story === '1F')!;
    const slab = data.members.find((member) => member.type === 'slab' && member.story === '1F')!;
    useProjectStore.getState().addLoadCase({ id: 'LC-D', name: 'Dead', type: 'dead' });
    useProjectStore.getState().updateAnalysisData({
      supports: [{
        id: 'SUP-1F', storyId: '1F', position: { x: 0, y: 0, z: 0 },
        restraints: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
      }],
      nodalLoads: [{
        id: 'NL-1F', loadCaseId: 'LC-D', storyId: '1F',
        position: { x: 0, y: 0, z: 0 }, force: { x: 0, y: 0, z: -1 },
      }],
      memberLoads: [{
        id: 'ML-1F', loadCaseId: 'LC-D', memberId: beam.id, kind: 'uniform',
        direction: 'globalZ', magnitude: -1,
      }],
      areaLoads: [{
        id: 'AL-1F', loadCaseId: 'LC-D', memberId: slab.id,
        direction: 'globalZ', magnitude: -1,
      }],
      masses: [{
        id: 'MASS-1F', storyId: '1F', position: { x: 0, y: 0, z: 0 },
        mass: { x: 1, y: 1, z: 1 },
      }],
      diaphragms: [{
        id: 'DIA-1F', storyId: '1F', type: 'rigid', memberIds: [beam.id, slab.id],
        masterPosition: { x: 0, y: 0, z: 0 },
      }],
    });

    useProjectStore.getState().duplicateStory('1F', {
      id: '3F', name: '3F', elevation: 6000, height: 3000,
    });
    const after = useProjectStore.getState().data!;
    expect(after.supports?.find((item) => item.id === 'SUP-3F')).toMatchObject({
      storyId: '3F', position: { z: 6000 },
    });
    expect(after.nodalLoads?.find((item) => item.id === 'NL-3F')).toMatchObject({
      storyId: '3F', position: { z: 6000 }, loadCaseId: 'LC-D',
    });
    expect(after.memberLoads?.find((item) => item.id === 'ML-3F')?.memberId).toBe(
      beam.id.replace('1F', '3F'),
    );
    expect(after.areaLoads?.find((item) => item.id === 'AL-3F')?.memberId).toBe(
      slab.id.replace('1F', '3F'),
    );
    expect(after.masses?.find((item) => item.id === 'MASS-3F')).toMatchObject({
      storyId: '3F', position: { z: 6000 },
    });
    expect(after.diaphragms?.find((item) => item.id === 'DIA-3F')).toMatchObject({
      storyId: '3F', masterPosition: { z: 6000 },
    });
  });
});

describe('projectStore transactional document commands', () => {
  beforeEach(() => {
    useProjectStore.getState().loadProject(
      JSON.parse(JSON.stringify(sampleProject)) as ProjectData,
    );
  });

  it('clears optional fields and treats identical updates as true no-ops', () => {
    const project = JSON.parse(JSON.stringify(sampleProject)) as ProjectData;
    const beam = project.members.find((member) => member.type === 'beam')!;
    beam.releases = { start: { rz: true } };
    project.loadCases = [{ id: 'LC-CLEAR', name: 'Clear', type: 'other', factor: 1.2 }];
    project.materials[0].elasticModulus = 25_000;
    const section = project.sections.find((item) => item.kind === 'rc_beam_rect')!;
    section.cover = 40;
    project.analysisResults = {
      source: 'test',
      analysisType: 'static',
      generatedAt: '2026-01-01',
    };
    useProjectStore.getState().loadProject(project);

    const store = useProjectStore.getState();
    store.updateMember(beam.id, { releases: undefined });
    store.updateLoadCase('LC-CLEAR', { factor: undefined });
    store.updateMaterial(project.materials[0].id, { elasticModulus: undefined });
    store.updateSection(section.id, { cover: undefined } as never);

    const cleared = useProjectStore.getState().data!;
    expect(cleared.members.find((member) => member.id === beam.id)?.releases).toBeUndefined();
    expect(cleared.loadCases?.[0].factor).toBeUndefined();
    expect(cleared.materials[0].elasticModulus).toBeUndefined();
    const clearedSection = cleared.sections.find((item) => item.id === section.id);
    expect(clearedSection && 'cover' in clearedSection ? clearedSection.cover : undefined)
      .toBeUndefined();

    const analysisResults = {
      source: 'no-op-test',
      analysisType: 'static' as const,
      generatedAt: '2026-01-02',
    };
    useProjectStore.getState().updateAnalysisData({ analysisResults });
    useProjectStore.getState().markClean();
    const revision = useProjectStore.getState().currentRevision;
    const historyLength = useProjectStore.temporal.getState().pastStates.length;
    const current = useProjectStore.getState().data!;
    useProjectStore.getState().updateMember(beam.id, { releases: undefined });
    useProjectStore.getState().updateLoadCase('LC-CLEAR', { factor: undefined });
    useProjectStore.getState().updateMaterial(current.materials[0].id, {
      name: current.materials[0].name,
    });
    useProjectStore.getState().updateSection(section.id, { cover: undefined } as never);

    expect(useProjectStore.getState().currentRevision).toBe(revision);
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(historyLength);
    expect(useProjectStore.getState().isDirty).toBe(false);
    expect(useProjectStore.getState().data!.analysisResults).toEqual(analysisResults);
  });

  it('rejects a grid edit that would collapse a pinned member without partial changes', () => {
    const store = useProjectStore.getState();
    const beam = store.data!.members.find((member) => member.type === 'beam')!;
    const x1 = store.data!.grids.find((grid) => grid.name === 'X1')!;
    const x2 = store.data!.grids.find((grid) => grid.name === 'X2')!;
    store.updateMember(beam.id, {
      gridRef: { startGrid: ['X1', 'Y1'], endGrid: ['X2', 'Y1'] },
    });
    useProjectStore.getState().markClean();
    const before = structuredClone(useProjectStore.getState().data!);
    const revision = useProjectStore.getState().currentRevision;

    useProjectStore.getState().updateGrid(x2.id, { position: x1.position });

    expect(useProjectStore.getState().data).toEqual(before);
    expect(useProjectStore.getState().currentRevision).toBe(revision);
    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it('rejects an import whose grid resolution collapses a member atomically', () => {
    const before = structuredClone(useProjectStore.getState().data!);
    const beam = before.members.find((member) => member.type === 'beam')!;
    const summary = useProjectStore.getState().importEntities({
      grids: [
        { id: 'G-IX1', axis: 'X', name: 'IX1', position: 100_000 },
        { id: 'G-IX2', axis: 'X', name: 'IX2', position: 100_000 },
        { id: 'G-IY1', axis: 'Y', name: 'IY1', position: 100_000 },
      ],
      members: [{
        ...beam,
        id: 'B-COLLAPSE',
        start: { x: 100_000, y: 100_000, z: beam.start.z },
        end: { x: 101_000, y: 100_000, z: beam.end.z },
        gridRef: { startGrid: ['IX1', 'IY1'], endGrid: ['IX2', 'IY1'] },
      }],
    });

    expect(summary.added.members).toBe(0);
    expect(summary.skipped.members).toBe(1);
    expect(summary.warnings.some((warning) => warning.startsWith('Import rejected:'))).toBe(true);
    expect(useProjectStore.getState().data).toEqual(before);
  });

  it('keeps associative dimension endpoints distinct after grid edits and imports', () => {
    const project = structuredClone(sampleProject) as unknown as ProjectData;
    const beam = project.members.find((member) => member.type === 'beam')!;
    project.dimensions = [{
      id: 'DIM-WILL-COLLAPSE',
      story: beam.story,
      start: { x: beam.start.x, y: beam.start.y },
      end: { x: beam.start.x + 0.5, y: beam.start.y },
      offset: 100,
      associative: true,
      refMemberIds: [beam.id],
    }];
    useProjectStore.getState().loadProject(project);
    useProjectStore.getState().markClean();
    const before = structuredClone(useProjectStore.getState().data!);
    const grid = before.grids[0];

    useProjectStore.getState().updateGrid(grid.id, { name: `${grid.name}-renamed` });
    let dimension = useProjectStore.getState().data!.dimensions[0];
    expect(dimension.start).not.toEqual(dimension.end);

    const summary = useProjectStore.getState().importEntities({
      annotations: [{
        id: 'ANN-ROLLBACK',
        type: 'text',
        story: beam.story,
        x: 0,
        y: 0,
        text: 'must not be partially imported',
      }],
    });
    expect(summary.added.annotations).toBe(1);
    dimension = useProjectStore.getState().data!.dimensions[0];
    expect(dimension.start).not.toEqual(dimension.end);
  });

  it('allows a healthy target to move when an unrelated legacy member is degenerate', () => {
    const project = JSON.parse(JSON.stringify(sampleProject)) as ProjectData;
    const degenerate = project.members.find((member) => member.type === 'beam')!;
    degenerate.end = { ...degenerate.start };
    const healthy = project.members.find(
      (member) => member.id !== degenerate.id && member.type !== 'slab',
    )!;
    useProjectStore.getState().loadProject(project);
    const beforeX = healthy.type === 'slab' ? 0 : healthy.start.x;

    useProjectStore.getState().moveMember(healthy.id, 250, 0);

    const moved = useProjectStore.getState().data!.members.find(
      (member) => member.id === healthy.id,
    )!;
    expect(moved.type !== 'slab' && moved.start.x).toBe(beforeX + 250);
    expect(useProjectStore.getState().data!.members.find(
      (member) => member.id === degenerate.id,
    )).toMatchObject({ end: degenerate.end });
  });

  it('moves point analysis data with an otherwise unshared member joint', () => {
    const store = useProjectStore.getState();
    const template = store.data!.members.find((member) => member.type === 'beam')!;
    const isolated = {
      ...template,
      id: 'B-ANALYSIS-MOVE',
      start: { x: 100_000, y: 100_000, z: template.start.z },
      end: { x: 105_000, y: 100_000, z: template.end.z },
      gridRef: undefined,
    };
    store.addMember(isolated);
    store.addLoadCase({ id: 'LC-MOVE', name: 'Move', type: 'other' });
    store.updateAnalysisData({
      supports: [{
        id: 'SUP-MOVE',
        storyId: isolated.story,
        position: { ...isolated.start },
        restraints: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
      }],
      nodalLoads: [{
        id: 'NL-MOVE',
        loadCaseId: 'LC-MOVE',
        storyId: isolated.story,
        position: { ...isolated.start },
        force: { x: 0, y: 0, z: -1 },
      }],
      masses: [{
        id: 'MASS-MOVE',
        storyId: isolated.story,
        position: { ...isolated.start },
        mass: { x: 1, y: 1, z: 1 },
      }],
    });

    useProjectStore.getState().moveMember(isolated.id, 250, 500);

    const after = useProjectStore.getState().data!;
    for (const position of [
      after.supports?.[0].position,
      after.nodalLoads?.[0].position,
      after.masses?.[0].position,
    ]) {
      expect(position).toMatchObject({ x: isolated.start.x + 250, y: isolated.start.y + 500 });
    }
  });

  it('cascades deleted member references from openings, groups, dimensions and loads', () => {
    const store = useProjectStore.getState();
    const wall = store.data!.members.find((member) => member.type === 'wall')!;
    const slab = store.data!.members.find((member) => member.type === 'slab')!;
    const dimension = store.data!.dimensions[0];
    store.addLoadCase({ id: 'LC-1', name: 'Dead', type: 'dead' });
    store.createGroup([wall.id, dimension.id], 'members only');
    store.updateDimension(dimension.id, {
      associative: true,
      refMemberIds: [wall.id],
    });
    store.updateAnalysisData({
      memberLoads: [{
        id: 'ML-1', loadCaseId: 'LC-1', memberId: wall.id, kind: 'uniform',
        direction: 'globalZ', magnitude: -1,
      }],
      areaLoads: [{
        id: 'AL-1', loadCaseId: 'LC-1', memberId: slab.id,
        direction: 'globalZ', magnitude: -1,
      }],
    });

    useProjectStore.getState().deleteEntities([wall.id, slab.id]);
    const data = useProjectStore.getState().data!;
    expect(data.openings.some((opening) => opening.memberId === wall.id)).toBe(false);
    expect(data.groups?.flatMap((group) => group.memberIds) ?? []).not.toContain(wall.id);
    expect(data.groups?.flatMap((group) => group.memberIds) ?? []).not.toContain(dimension.id);
    expect(data.dimensions.find((item) => item.id === dimension.id)).toMatchObject({
      associative: false,
    });
    expect(data.memberLoads).toEqual([]);
    expect(data.areaLoads).toEqual([]);
  });

  it('removes newly orphaned analysis points but keeps shared joints and diaphragm masters', () => {
    const store = useProjectStore.getState();
    const template = store.data!.members.find((member) => member.type === 'beam')!;
    const z = template.start.z;
    const makeBeam = (id: string, startX: number, endX: number, endY = 0): typeof template => ({
      ...template,
      id,
      start: { x: startX, y: 100_000, z },
      end: { x: endX, y: 100_000 + endY, z },
      gridRef: undefined,
    });
    const orphan = makeBeam('B-ORPHAN-NODE', 100_000, 101_000);
    const shared = makeBeam('B-SHARED-NODE', 110_000, 111_000);
    const keeper = makeBeam('B-KEEP-NODE', 110_000, 110_000, 1_000);
    store.addMember(orphan);
    store.addMember(shared);
    store.addMember(keeper);
    store.addLoadCase({ id: 'LC-NODES', name: 'Nodes', type: 'other' });

    const points = [
      { suffix: 'ORPHAN', position: orphan.start },
      { suffix: 'SHARED', position: shared.start },
      { suffix: 'MASTER', position: shared.end },
    ];
    store.updateAnalysisData({
      supports: points.map(({ suffix, position }) => ({
        id: `SUP-${suffix}`,
        storyId: template.story,
        position: { ...position },
        restraints: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
      })),
      nodalLoads: points.map(({ suffix, position }) => ({
        id: `NL-${suffix}`,
        loadCaseId: 'LC-NODES',
        storyId: template.story,
        position: { ...position },
        force: { x: 0, y: 0, z: -1 },
      })),
      masses: points.map(({ suffix, position }) => ({
        id: `MASS-${suffix}`,
        storyId: template.story,
        position: { ...position },
        mass: { x: 1, y: 1, z: 1 },
      })),
      diaphragms: [{
        id: 'DIA-MASTER',
        storyId: template.story,
        type: 'rigid',
        memberIds: [shared.id],
        masterPosition: { ...shared.end },
      }],
    });

    useProjectStore.getState().deleteEntities([orphan.id, shared.id]);

    const after = useProjectStore.getState().data!;
    expect(after.supports?.map((item) => item.id)).toEqual(['SUP-SHARED', 'SUP-MASTER']);
    expect(after.nodalLoads?.map((item) => item.id)).toEqual(['NL-SHARED', 'NL-MASTER']);
    expect(after.masses?.map((item) => item.id)).toEqual(['MASS-SHARED', 'MASS-MASTER']);
    expect(after.diaphragms?.[0]).toMatchObject({
      memberIds: [],
      masterPosition: shared.end,
    });
  });

  it('does not let a pre-existing unrelated validation error block imports or result updates', () => {
    const project = JSON.parse(JSON.stringify(sampleProject)) as ProjectData;
    project.supports = [{
      id: 'SUP-LEGACY-ORPHAN',
      storyId: project.stories[0].id,
      position: { x: 999_999, y: 999_999, z: 999_999 },
      restraints: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
    }];
    useProjectStore.getState().loadProject(project);

    const summary = useProjectStore.getState().importEntities({
      annotations: [{
        id: 'ANN-LEGACY-IMPORT',
        type: 'text',
        story: project.stories[0].id,
        x: 0,
        y: 0,
        text: 'imported despite legacy error',
      }],
    });
    const results = {
      source: 'legacy-model',
      analysisType: 'static' as const,
      generatedAt: '2026-01-03',
    };
    useProjectStore.getState().updateAnalysisData({ analysisResults: results });

    expect(summary.added.annotations).toBe(1);
    expect(useProjectStore.getState().data!.analysisResults).toEqual(results);
  });

  it('rejects additional copies of an existing validation error', () => {
    const project = structuredClone(sampleProject) as unknown as ProjectData;
    const invalidDisplacement = {
      position: { x: Number.NaN, y: 0, z: 0 },
      dx: 0,
      dy: 0,
      dz: 0,
    };
    project.analysisResults = {
      source: 'legacy-invalid',
      analysisType: 'static',
      generatedAt: '2026-01-01',
      nodeDisplacements: [invalidDisplacement],
    };
    useProjectStore.getState().loadProject(project);

    useProjectStore.getState().updateAnalysisData({
      analysisResults: {
        ...project.analysisResults,
        nodeDisplacements: [invalidDisplacement, { ...invalidDisplacement }],
      },
    });

    expect(useProjectStore.getState().data!.analysisResults?.nodeDisplacements).toHaveLength(1);
  });

  it('keeps grid references stable across rename and detaches them on delete', () => {
    const store = useProjectStore.getState();
    const beam = store.data!.members.find((member) => member.type === 'beam')!;
    const x1 = store.data!.grids.find((grid) => grid.name === 'X1')!;
    store.updateMember(beam.id, {
      gridRef: { startGrid: ['X1', 'Y1'], endGrid: ['X2', 'Y1'] },
    });

    store.updateGrid(x1.id, { name: 'A', position: 250 });
    let updated = useProjectStore.getState().data!.members.find((member) => member.id === beam.id)!;
    expect(updated.gridRef?.startGrid).toEqual(['A', 'Y1']);
    expect(updated.type !== 'slab' && updated.start.x).toBe(250);

    store.deleteGrid(x1.id);
    updated = useProjectStore.getState().data!.members.find((member) => member.id === beam.id)!;
    expect(updated.gridRef?.startGrid).toBeUndefined();
  });

  it('detaches grid references that use grid IDs rather than names', () => {
    const store = useProjectStore.getState();
    const beam = store.data!.members.find((member) => member.type === 'beam')!;
    const x1 = store.data!.grids.find((grid) => grid.name === 'X1')!;
    const y1 = store.data!.grids.find((grid) => grid.name === 'Y1')!;
    store.updateMember(beam.id, {
      gridRef: { startGrid: [x1.id, y1.id], endGrid: ['X2', y1.id] },
    });

    store.deleteGrid(x1.id);

    const updated = useProjectStore.getState().data!.members.find(
      (member) => member.id === beam.id,
    )!;
    expect(updated.gridRef?.startGrid).toBeUndefined();
    expect(updated.gridRef?.endGrid).toEqual(['X2', y1.id]);
  });

  it('does not retarget or detach an exact grid ID that collides with another grid name', () => {
    const project = structuredClone(sampleProject) as unknown as ProjectData;
    const beam = project.members.find((member) => member.type === 'beam')!;
    const yGrid = project.grids.find((grid) => grid.axis === 'Y')!;
    project.grids = [
      { id: 'GRID-A', name: 'GRID-B', axis: 'X', position: 0 },
      { id: 'GRID-B', name: 'X-referenced', axis: 'X', position: 4000 },
      { id: 'GRID-C', name: 'X-end', axis: 'X', position: 8000 },
      yGrid,
    ];
    beam.gridRef = {
      startGrid: ['GRID-B', yGrid.id],
      endGrid: ['GRID-C', yGrid.id],
    };
    useProjectStore.getState().loadProject(project);

    useProjectStore.getState().updateGrid('GRID-A', { name: 'renamed-A' });
    let updated = useProjectStore.getState().data!.members.find(
      (member) => member.id === beam.id,
    )!;
    expect(updated.gridRef?.startGrid).toEqual(['GRID-B', yGrid.id]);
    expect(updated.type !== 'slab' && updated.start.x).toBe(4000);

    useProjectStore.getState().deleteGrid('GRID-A');
    updated = useProjectStore.getState().data!.members.find((member) => member.id === beam.id)!;
    expect(updated.gridRef?.startGrid).toEqual(['GRID-B', yGrid.id]);
  });

  it('remaps imported grid IDs that collide with existing grid names', () => {
    const project = structuredClone(sampleProject) as unknown as ProjectData;
    const existingX = project.grids.find((grid) => grid.axis === 'X')!;
    const endX = project.grids.find(
      (grid) => grid.axis === 'X' && grid.id !== existingX.id,
    )!;
    const yGrid = project.grids.find((grid) => grid.axis === 'Y')!;
    existingX.name = 'COLLISION';
    const beam = project.members.find((member) => member.type === 'beam')!;
    beam.gridRef = {
      startGrid: ['COLLISION', yGrid.id],
      endGrid: [endX.id, yGrid.id],
    };
    useProjectStore.getState().loadProject(project);

    const summary = useProjectStore.getState().importEntities({
      grids: [{ id: 'COLLISION', name: 'Imported X', axis: 'X', position: 100_000 }],
    });

    expect(summary.added.grids).toBe(1);
    expect(useProjectStore.getState().data!.grids.some(
      (grid) => grid.id === 'COLLISION' && grid.position === 100_000,
    )).toBe(false);
    const updated = useProjectStore.getState().data!.members.find(
      (member) => member.id === beam.id,
    )!;
    expect(updated.gridRef?.startGrid).toEqual(['COLLISION', yGrid.id]);
    expect(updated.type !== 'slab' && updated.start.x).toBe(existingX.position);
  });

  it('shifts story members and openings with an elevation edit', () => {
    const before = useProjectStore.getState().data!;
    const member = before.members.find((item) => item.story === '1F' && item.type !== 'slab')!;
    const opening = before.openings[0];
    const memberZ = member.type !== 'slab' ? member.start.z : 0;
    const memberNode = member.type !== 'slab' ? member.start : { x: 0, y: 0, z: memberZ };
    const openingZ = opening.position.z;
    useProjectStore.getState().addLoadCase({ id: 'LC', name: 'Dead', type: 'dead' });
    useProjectStore.getState().updateAnalysisData({
      supports: [{
        id: 'SUP-SHIFT', storyId: '1F', position: { ...memberNode },
        restraints: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
      }],
      nodalLoads: [{
        id: 'NL-SHIFT', loadCaseId: 'LC', storyId: '1F',
        position: { ...memberNode }, force: { x: 0, y: 0, z: -1 },
      }],
      masses: [{
        id: 'M-SHIFT', storyId: '1F', position: { ...memberNode },
        mass: { x: 1, y: 1, z: 1 },
      }],
      diaphragms: [{
        id: 'D-SHIFT', storyId: '1F', type: 'rigid',
        masterPosition: { ...memberNode },
      }],
    });
    useProjectStore.getState().updateStory('1F', { elevation: 500 });
    const after = useProjectStore.getState().data!;
    const shifted = after.members.find((item) => item.id === member.id)!;
    expect(shifted.type !== 'slab' && shifted.start.z).toBe(memberZ + 500);
    expect(after.openings.find((item) => item.id === opening.id)?.position.z).toBe(openingZ + 500);
    expect(after.supports?.[0].position.z).toBe(memberZ + 500);
    expect(after.nodalLoads?.[0].position.z).toBe(memberZ + 500);
    expect(after.masses?.[0].position.z).toBe(memberZ + 500);
    expect(after.diaphragms?.[0].masterPosition?.z).toBe(memberZ + 500);
  });

  it('updates a chained story elevation set as one undo transaction', () => {
    const before = useProjectStore.getState().data!.stories.map((story) => ({ ...story }));
    const historyBefore = useProjectStore.temporal.getState().pastStates.length;
    useProjectStore.getState().updateStories([
      { id: '1F', updates: { height: before[0].height + 500 } },
      { id: '2F', updates: { elevation: before[1].elevation + 500 } },
    ]);
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(historyBefore + 1);
    expect(useProjectStore.getState().data!.stories.find((story) => story.id === '2F')?.elevation)
      .toBe(before[1].elevation + 500);
    useProjectStore.temporal.getState().undo();
    expect(useProjectStore.getState().data!.stories).toEqual(before);
  });

  it('moves member Z coordinates and hosted openings when changing story', () => {
    const before = useProjectStore.getState().data!;
    const wall = before.members.find(
      (member) => member.type === 'wall' && member.story === '1F' &&
        before.openings.some((opening) => opening.memberId === member.id),
    )!;
    const slab = before.members.find((member) => member.type === 'slab' && member.story === '1F')!;
    const opening = before.openings.find((item) => item.memberId === wall.id)!;
    const wallZ = wall.type === 'wall' ? wall.start.z : 0;
    const slabZ = slab.type === 'slab' ? slab.level : 0;
    const openingZ = opening.position.z;
    const delta = before.stories.find((story) => story.id === '2F')!.elevation -
      before.stories.find((story) => story.id === '1F')!.elevation;

    useProjectStore.getState().updateMembers([wall.id, slab.id], { story: '2F' });
    const after = useProjectStore.getState().data!;
    const movedWall = after.members.find((member) => member.id === wall.id)!;
    const movedSlab = after.members.find((member) => member.id === slab.id)!;
    expect(movedWall).toMatchObject({ story: '2F', start: { z: wallZ + delta } });
    expect(movedSlab).toMatchObject({ story: '2F', level: slabZ + delta });
    expect(after.openings.find((item) => item.id === opening.id)?.position.z).toBe(openingZ + delta);
  });

  it('invalidates analysis results only for analysis-model changes', () => {
    const result = {
      source: 'test', analysisType: 'static' as const, generatedAt: '2026-01-01',
    };
    useProjectStore.getState().updateAnalysisData({ analysisResults: result });
    useProjectStore.getState().addAnnotation({
      id: 'A-NON-MODEL', type: 'text', story: '1F', x: 0, y: 0, text: 'note',
    });
    expect(useProjectStore.getState().data!.analysisResults).toEqual(result);
    const presentationMembers = useProjectStore.getState().data!.members.slice(0, 2);
    useProjectStore.getState().updateMember(presentationMembers[0].id, { color: '#123456' });
    expect(useProjectStore.getState().data!.analysisResults).toEqual(result);
    useProjectStore.getState().updateMembers(
      presentationMembers.map((member) => member.id),
      { lineType: 'dashed', lineWeight: 0.5 },
    );
    expect(useProjectStore.getState().data!.analysisResults).toEqual(result);
    const annotationId = useProjectStore.getState().data!.annotations[0].id;
    useProjectStore.getState().translateEntities([annotationId], 10, 20);
    expect(useProjectStore.getState().data!.analysisResults).toEqual(result);
    useProjectStore.getState().duplicateEntities([annotationId], 100, 100, 1);
    expect(useProjectStore.getState().data!.analysisResults).toEqual(result);
    const member = useProjectStore.getState().data!.members[0];
    useProjectStore.getState().moveMember(member.id, 1, 0);
    expect(useProjectStore.getState().data!.analysisResults).toBeUndefined();
  });

  it('tracks the save revision through undo/redo and clears history on load', () => {
    const store = useProjectStore.getState();
    const annotation = { id: 'A-HISTORY', type: 'text' as const, story: '1F', x: 0, y: 0, text: 'x' };
    store.addAnnotation(annotation);
    expect(useProjectStore.getState().isDirty).toBe(true);
    useProjectStore.temporal.getState().undo();
    expect(useProjectStore.getState().isDirty).toBe(false);
    useProjectStore.temporal.getState().redo();
    expect(useProjectStore.getState().isDirty).toBe(true);
    useProjectStore.getState().markClean();
    expect(useProjectStore.getState().isDirty).toBe(false);
    useProjectStore.temporal.getState().undo();
    expect(useProjectStore.getState().isDirty).toBe(true);

    useProjectStore.getState().loadProject(JSON.parse(JSON.stringify(sampleProject)) as ProjectData);
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0);
    expect(useProjectStore.temporal.getState().futureStates).toHaveLength(0);
  });

  it('imports a batch as one undo step and rejects invalid geometry', () => {
    const initialMembers = useProjectStore.getState().data!.members.length;
    useProjectStore.getState().importEntities({
      annotations: [
        { id: 'A-BATCH-1', type: 'text', story: '1F', x: 0, y: 0, text: '1' },
        { id: 'A-BATCH-2', type: 'text', story: '1F', x: 1, y: 1, text: '2' },
      ],
      members: [{
        id: 'B-BAD', type: 'beam', story: '1F', sectionId: 'SEC-B300x600',
        materialId: 'MAT-RC-24', start: { x: 0, y: 0, z: 3000 },
        end: { x: 0, y: 0, z: 3000 },
      }],
    });
    expect(useProjectStore.getState().data!.annotations).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'A-BATCH-1' }), expect.objectContaining({ id: 'A-BATCH-2' })]),
    );
    expect(useProjectStore.getState().data!.members).toHaveLength(initialMembers);
    useProjectStore.temporal.getState().undo();
    expect(useProjectStore.getState().data!.annotations.some((item) => item.id.startsWith('A-BATCH'))).toBe(false);
  });

  it('remaps a repeated import batch without dropping entities or references', () => {
    useProjectStore.getState().newProject();
    const batch = {
      materials: [{ id: 'MAT-RC-24', name: 'Imported RC', type: 'concrete' as const }],
      sections: [{ id: 'SEC-WALL200', kind: 'rc_wall' as const, thickness: 180 }],
      grids: [
        { id: 'G-X1', axis: 'X' as const, name: 'X1', position: 0 },
        { id: 'G-X2', axis: 'X' as const, name: 'X2', position: 1000 },
        { id: 'G-Y1', axis: 'Y' as const, name: 'Y1', position: 0 },
      ],
      members: [{
        id: 'W-IMPORT', type: 'wall' as const, story: '1F',
        sectionId: 'SEC-WALL200', materialId: 'MAT-RC-24',
        start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 },
        height: 3000, thickness: 180,
        gridRef: { startGrid: ['X1', 'Y1'] as [string, string], endGrid: ['X2', 'Y1'] as [string, string] },
      }],
      openings: [{
        id: 'OP-IMPORT', memberId: 'W-IMPORT', type: 'window' as const,
        position: { x: 500, y: 0, z: 900 }, width: 600, height: 1200,
      }],
      annotations: [{
        id: 'ANN-IMPORT', type: 'text' as const, story: '1F', x: 0, y: 0, text: 'DXF',
      }],
      dimensions: [{
        id: 'DIM-IMPORT', story: '1F', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 },
        offset: -500, associative: true, refMemberIds: ['W-IMPORT'],
      }],
      constructionLines: [{
        id: 'CL-IMPORT', story: '1F', type: 'xline' as const,
        origin: { x: 0, y: 0 }, direction: { x: 1, y: 0 },
      }],
    };

    const first = useProjectStore.getState().importEntities(batch);
    const second = useProjectStore.getState().importEntities(batch);
    expect(first.added.members).toBe(1);
    expect(second.added).toMatchObject({
      materials: 1, sections: 1, grids: 3, members: 1, openings: 1,
      annotations: 1, dimensions: 1, constructionLines: 1,
    });
    const data = useProjectStore.getState().data!;
    const copiedWall = data.members.find((member) => member.id === 'W-IMPORT-2')!;
    expect(copiedWall).toMatchObject({
      sectionId: 'SEC-WALL200-3',
      materialId: 'MAT-RC-24-3',
      gridRef: { startGrid: ['X1-2', 'Y1-2'], endGrid: ['X2-2', 'Y1-2'] },
    });
    expect(data.openings.find((opening) => opening.id === 'OP-IMPORT-2')?.memberId).toBe(copiedWall.id);
    expect(data.dimensions.find((dimension) => dimension.id === 'DIM-IMPORT-2')?.refMemberIds).toEqual([copiedWall.id]);
    expect(data.annotations.filter((annotation) => annotation.text === 'DXF')).toHaveLength(2);
  });

  it('enforces the shared selectable ID namespace on direct store writes', () => {
    const member = useProjectStore.getState().data!.members[0];
    const annotationCount = useProjectStore.getState().data!.annotations.length;
    useProjectStore.getState().addAnnotation({
      id: member.id, type: 'text', story: member.story, x: 0, y: 0, text: 'collision',
    });
    expect(useProjectStore.getState().data!.annotations).toHaveLength(annotationCount);
    useProjectStore.getState().updateMember(member.id, { id: '' });
    expect(useProjectStore.getState().data!.members.some((item) => item.id === member.id)).toBe(true);
    expect(useProjectStore.getState().data!.members.some((item) => item.id === '')).toBe(false);
  });

  it('skips non-finite values in every imported geometry category', () => {
    const summary = useProjectStore.getState().importEntities({
      materials: [{ id: 'M-NAN', name: 'bad', type: 'other', elasticModulus: Number.NaN }],
      sections: [{ id: 'S-NAN', kind: 'rc_wall', thickness: Number.NaN }],
      grids: [{ id: 'G-NAN', axis: 'X', name: 'bad', position: Number.NaN }],
      members: [{
        id: 'W-NAN', type: 'wall', story: '1F', sectionId: 'SEC-WALL200', materialId: 'MAT-RC-24',
        start: { x: Number.NaN, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 },
        height: 3000, thickness: 200,
      }],
      openings: [{
        id: 'O-NAN', memberId: 'missing', type: 'void', position: { x: Number.NaN, y: 0, z: 0 },
        width: 1, height: 1,
      }],
      annotations: [{ id: 'A-NAN', type: 'text', story: '1F', x: Number.NaN, y: 0, text: 'bad' }],
      dimensions: [{
        id: 'D-NAN', story: '1F', start: { x: 0, y: 0 }, end: { x: Number.NaN, y: 0 }, offset: 1,
      }],
      constructionLines: [{
        id: 'C-NAN', story: '1F', type: 'xline', origin: { x: 0, y: 0 },
        direction: { x: Number.NaN, y: 0 },
      }],
    });
    expect(Object.values(summary.added).every((count) => count === 0)).toBe(true);
    expect(Object.values(summary.skipped).every((count) => count === 1)).toBe(true);
  });

  it('rejects the transactional import candidate when final reference validation fails', () => {
    const before = useProjectStore.getState().data!.members.length;
    const summary = useProjectStore.getState().importEntities({
      members: [{
        id: 'B-BAD-GRID', type: 'beam', story: '1F', sectionId: 'SEC-B300x600',
        materialId: 'MAT-RC-24', start: { x: 0, y: 0, z: 3000 },
        end: { x: 1000, y: 0, z: 3000 },
        gridRef: { startGrid: ['X1', 'X2'], endGrid: ['X1', 'X2'] },
      }],
    });
    expect(summary.added.members).toBe(0);
    expect(summary.skipped.members).toBe(1);
    expect(summary.warnings.some((warning) => warning.startsWith('Import rejected:'))).toBe(true);
    expect(useProjectStore.getState().data!.members).toHaveLength(before);
  });

  it('moves every endpoint at a shared joint in one command', () => {
    const beam = useProjectStore.getState().data!.members.find((member) => member.type === 'beam')!;
    useProjectStore.getState().addMember({
      ...beam,
      id: 'B-JOINT',
      start: { ...beam.start },
      end: { ...beam.end, x: beam.end.x + 1000 },
    });
    useProjectStore.getState().addLoadCase({ id: 'LC-JOINT', name: 'Joint', type: 'other' });
    useProjectStore.getState().updateAnalysisData({
      supports: [{
        id: 'SUP-JOINT', storyId: beam.story, position: { ...beam.start },
        restraints: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
      }],
      nodalLoads: [{
        id: 'NL-JOINT', loadCaseId: 'LC-JOINT', storyId: beam.story,
        position: { ...beam.start }, force: { x: 0, y: 0, z: -1 },
      }],
      masses: [{
        id: 'M-JOINT', storyId: beam.story, position: { ...beam.start },
        mass: { x: 1, y: 1, z: 1 },
      }],
      diaphragms: [{
        id: 'D-JOINT', storyId: beam.story, type: 'rigid', masterPosition: { ...beam.start },
      }],
    });
    useProjectStore.getState().moveConnectedJoint(
      { x: beam.start.x, y: beam.start.y },
      { x: beam.start.x + 125, y: beam.start.y + 250 },
      beam.story,
    );
    const members = useProjectStore.getState().data!.members;
    for (const id of [beam.id, 'B-JOINT']) {
      const updated = members.find((member) => member.id === id)!;
      expect(updated.type !== 'slab' && updated.start).toMatchObject({
        x: beam.start.x + 125,
        y: beam.start.y + 250,
      });
    }
    const movedData = useProjectStore.getState().data!;
    for (const position of [
      movedData.supports?.[0].position,
      movedData.nodalLoads?.[0].position,
      movedData.masses?.[0].position,
      movedData.diaphragms?.[0].masterPosition,
    ]) {
      expect(position).toMatchObject({ x: beam.start.x + 125, y: beam.start.y + 250 });
    }
  });

  it('deletes and reorders stories transactionally while keeping editor state safe', () => {
    const originalIds = useProjectStore.getState().data!.stories.map((story) => story.id);
    expect(originalIds.length).toBeGreaterThan(1);
    useProjectStore.getState().reorderStories([...originalIds].reverse());
    expect(useProjectStore.getState().data!.stories.map((story) => story.id)).toEqual(
      [...originalIds].reverse(),
    );
    useEditorStore.setState({ activeStory: '1F' });
    expect(useProjectStore.getState().deleteStory('1F')).toBe(true);
    expect(useProjectStore.getState().data!.members.some((member) => member.story === '1F')).toBe(false);
    expect(useProjectStore.getState().data!.views.some((view) => view.story === '1F')).toBe(false);
    expect(useEditorStore.getState().activeStory).not.toBe('1F');
  });

  it('recomputes chained elevations and story geometry in the same reorder transaction', () => {
    const before = useProjectStore.getState().data!;
    const orderedIds = before.stories.map((story) => story.id).reverse();
    const first = before.stories.find((story) => story.id === orderedIds[0])!;
    const second = before.stories.find((story) => story.id === orderedIds[1])!;
    const member = before.members.find(
      (item) => item.story === second.id && item.type !== 'slab',
    )!;
    const memberZ = member.type === 'slab' ? 0 : member.start.z;
    const expectedElevation = first.elevation + first.height;
    const expectedDelta = expectedElevation - second.elevation;
    const historyBefore = useProjectStore.temporal.getState().pastStates.length;

    useProjectStore.getState().reorderStories(orderedIds, true);

    const after = useProjectStore.getState().data!;
    expect(after.stories.map((story) => story.id)).toEqual(orderedIds);
    expect(after.stories[0].elevation).toBe(first.elevation);
    expect(after.stories[1].elevation).toBe(expectedElevation);
    const shifted = after.members.find((item) => item.id === member.id)!;
    expect(shifted.type !== 'slab' && shifted.start.z).toBe(memberZ + expectedDelta);
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(historyBefore + 1);
  });

  it('preserves a pre-existing blank sheet when deleting an unrelated story', () => {
    const project = JSON.parse(JSON.stringify(sampleProject)) as ProjectData;
    project.sheets.push({
      id: 'S-BLANK', name: 'Blank notes', paperSize: 'A3', scale: '1:100', viewIds: [],
    });
    useProjectStore.getState().loadProject(project);
    expect(useProjectStore.getState().deleteStory('1F')).toBe(true);
    expect(useProjectStore.getState().data!.sheets.some((sheet) => sheet.id === 'S-BLANK')).toBe(true);
  });

  it('deletes and reorders sheets and removes newly orphaned views', () => {
    const data = useProjectStore.getState().data!;
    expect(data.sheets.length).toBeGreaterThan(1);
    const ids = data.sheets.map((sheet) => sheet.id);
    useProjectStore.getState().reorderSheets([...ids].reverse());
    expect(useProjectStore.getState().data!.sheets.map((sheet) => sheet.id)).toEqual(
      [...ids].reverse(),
    );
    const target = useProjectStore.getState().data!.sheets[0];
    const targetViews = [...target.viewIds];
    expect(useProjectStore.getState().deleteSheet(target.id)).toBe(true);
    const after = useProjectStore.getState().data!;
    const stillReferenced = new Set(after.sheets.flatMap((sheet) => sheet.viewIds));
    for (const viewId of targetViews) {
      if (!stillReferenced.has(viewId)) {
        expect(after.views.some((view) => view.id === viewId)).toBe(false);
      }
    }
  });
});
