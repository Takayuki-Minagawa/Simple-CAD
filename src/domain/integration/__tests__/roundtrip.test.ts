import { describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { exportDxf } from '@/domain/export/dxfExport';
import { importDxf, getAutoSections } from '@/domain/import/dxfImport';
import { exportIfc, importIfc } from '@/domain/integration/ifc';
import { parseIfcEntities } from '@/domain/integration/ifc/step';
import { resolveLengthUnitScale } from '@/domain/integration/ifc/units';
import {
  exportStructuralAnalysisModel,
  importStructuralAnalysisJson,
} from '@/domain/integration/structuralAnalysisJson';
import { diffProjects } from '@/domain/validation/roundtripDiff';

const base = sampleProject as ProjectData;

/** Multi-story project with a rotated column to exercise rotation round-tripping. */
function buildRichProject(): ProjectData {
  const members = base.members.map((m, i) =>
    m.type === 'column' && i === 0 ? { ...m, rotation: Math.PI / 6 } : m,
  );
  return { ...base, members };
}

describe('roundtrip: analysis JSON', () => {
  it('preserves coordinates, sections, counts and rotation', () => {
    const project = buildRichProject();
    const json = JSON.stringify(exportStructuralAnalysisModel(project), null, 2);
    const result = importStructuralAnalysisJson(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const diff = diffProjects(project, result.data, { coord: 1, angle: 1e-3 });
    expect(diff.differences).toEqual([]);
    expect(diff.counts.actualMembers).toBe(project.members.length);
  });

  it('surfaces dropped members instead of silently dropping them (B6)', () => {
    const model = exportStructuralAnalysisModel(base);
    // Corrupt one linear member's node reference.
    model.linearMembers[0] = { ...model.linearMembers[0], startNodeId: 'N-MISSING' };
    const result = importStructuralAnalysisJson(JSON.stringify(model));
    // Reference-integrity validation rejects the dangling reference.
    expect(result.ok).toBe(false);
  });
});

describe('roundtrip: IFC', () => {
  it('preserves linear members within tolerance (multi-story)', () => {
    const project = buildRichProject();
    const ifc = exportIfc(project);
    const result = importIfc(ifc);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.stories).toHaveLength(project.stories.length);
    expect(result.data.members).toHaveLength(project.members.length);

    const diff = diffProjects(project, result.data, { coord: 2, angle: 5e-3 });
    expect(diff.differences).toEqual([]);
  });

  it('round-trips column rotation through placement refDirection (B5)', () => {
    const project = buildRichProject();
    const ifc = exportIfc(project);
    const result = importIfc(ifc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const rotatedCols = result.data.members.filter(
      (m) => m.type === 'column' && Math.abs((m.rotation ?? 0) % Math.PI) > 1e-3,
    );
    expect(rotatedCols.length).toBeGreaterThanOrEqual(1);
  });

  it('resolves IFC length units to a mm scale (3-3)', () => {
    const mk = (body: string) =>
      `ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\n${body}\nENDSEC;\nEND-ISO-10303-21;`;
    const metre = mk('#1=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);\n#2=IFCUNITASSIGNMENT((#1));');
    const milli = mk('#1=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);\n#2=IFCUNITASSIGNMENT((#1));');
    expect(resolveLengthUnitScale(parseIfcEntities(metre))).toBeCloseTo(1000);
    expect(resolveLengthUnitScale(parseIfcEntities(milli))).toBeCloseTo(1);
  });

  it('collects fallback warnings when a section is missing (B7)', () => {
    const project: ProjectData = {
      ...base,
      members: base.members.filter((m) => m.type === 'column').slice(0, 1).map((m) => ({
        ...m,
        sectionId: 'SEC-DOES-NOT-EXIST',
      })),
    };
    const warnings: string[] = [];
    exportIfc(project, warnings);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('roundtrip: DXF', () => {
  // DXF is a geometry-only interchange format: the importer heuristically
  // reconstructs members from raw polygons/lines, so a full project doesn't
  // round-trip member-for-member. We assert the things that MUST survive:
  // coordinate precision, units, and column rotation. We use a column-only
  // project where the reconstruction is well defined (squarish rect → column).
  function columnProject(): ProjectData {
    const columns = base.members
      .filter((m) => m.type === 'column' && m.story === '1F')
      .map((m, i) => (i === 0 ? { ...m, rotation: Math.PI / 6 } : m));
    // Drop grids/dimensions/annotations so they don't export as lines that
    // re-import as walls — we are isolating the column reconstruction path here.
    return { ...base, grids: [], dimensions: [], annotations: [], constructionLines: [], members: columns };
  }

  it('preserves column coordinates within tolerance and recovers rotation', () => {
    const project = columnProject();
    const dxf = exportDxf(project, '1F');
    const result = importDxf(dxf, '1F', { convertGeometry: true });

    expect(result.warnings).toEqual([]);

    const imported: ProjectData = {
      ...base,
      members: result.members,
      sections: getAutoSections(result),
    };

    const diff = diffProjects(project, imported, { coord: 2, angle: 5e-3 });
    expect(diff.differences).toEqual([]);
    expect(diff.counts.matchedMembers).toBe(project.members.length);

    // The rotated column survives the round-trip.
    const rotated = result.members.filter(
      (m) => m.type === 'column' && Math.abs((m.rotation ?? 0) % Math.PI) > 1e-3,
    );
    expect(rotated.length).toBe(1);
  });

  it('preserves a non-square column orientation without a 90° swap (P1)', () => {
    const project: ProjectData = {
      ...base,
      grids: [],
      dimensions: [],
      annotations: [],
      constructionLines: [],
      sections: [{ id: 'SEC-NS', kind: 'rc_column_rect', width: 800, depth: 600 }],
      members: [
        {
          id: 'C-NS',
          type: 'column',
          story: '1F',
          sectionId: 'SEC-NS',
          materialId: base.materials[0].id,
          start: { x: 0, y: 0, z: 0 },
          end: { x: 0, y: 0, z: 3000 },
        },
      ],
    };

    const dxf = exportDxf(project, '1F');
    const result = importDxf(dxf, '1F', { convertGeometry: true });
    expect(result.warnings).toEqual([]);

    const col = result.members.find((m) => m.type === 'column')!;
    const sec = getAutoSections(result).find((s) => s.id === col.sectionId)!;
    // 800 (X) wide × 600 (Y) deep at rotation 0 must NOT come back as 600×800.
    expect(sec).toMatchObject({ kind: 'rc_column_rect', width: 800, depth: 600 });
    expect(Math.abs((col.rotation ?? 0) % Math.PI)).toBeLessThan(1e-3);
  });

  it('writes $INSUNITS and EXTMIN/EXTMAX headers (B4 / 3-3)', () => {
    const dxf = exportDxf(base, '1F');
    expect(dxf).toContain('$INSUNITS');
    expect(dxf).toContain('$EXTMIN');
    expect(dxf).toContain('$EXTMAX');
  });

  it('scales metre-unit DXF to mm via $INSUNITS=6', () => {
    // A 5m line in metres → 5000mm after import.
    const dxf = [
      '0', 'SECTION', '2', 'HEADER',
      '9', '$INSUNITS', '70', '6',
      '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LINE', '8', 'WALL',
      '10', '0', '20', '0', '11', '5', '21', '0',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');

    const result = importDxf(dxf, '1F', { convertGeometry: true });
    const wall = result.members[0];
    expect(wall.type).toBe('wall');
    if (wall.type === 'wall') {
      expect(wall.end.x).toBeCloseTo(5000, 3);
    }
    expect(result.warnings.some((w) => w.includes('INSUNITS'))).toBe(true);
  });
});
