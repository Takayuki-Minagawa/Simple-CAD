import { describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import { exportIfc, importIfc } from '@/domain/integration/ifc';
import type { ProjectData } from '@/domain/structural/types';

describe('ifc integration', () => {
  it('exports supported IFC entities', () => {
    const ifc = exportIfc(sampleProject as ProjectData);

    expect(ifc).toContain('FILE_SCHEMA((\'IFC4\'))');
    expect(ifc).toContain('IFCCOLUMN');
    expect(ifc).toContain('IFCBEAM');
    expect(ifc).toContain('IFCWALL');
    expect(ifc).toContain('IFCSLAB');
  });

  it('imports its exported IFC subset back into a project', () => {
    const ifc = exportIfc(sampleProject as ProjectData);

    const result = importIfc(ifc);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.project.name).toBe('rc-sample');
    expect(result.data.members).toHaveLength((sampleProject as ProjectData).members.length);
    expect(result.data.stories).toHaveLength(2);
    expect(result.data.views.find((view) => view.type === 'model3d')).toBeTruthy();
    expect(result.data.openings).toEqual((sampleProject as ProjectData).openings);
    expect(result.data.materials).toEqual((sampleProject as ProjectData).materials);

    const sourceSlab = (sampleProject as ProjectData).members.find((member) => member.type === 'slab');
    const importedSlab = result.data.members.find((member) => member.type === 'slab');
    expect(importedSlab?.type === 'slab' && importedSlab.polygon).toHaveLength(
      sourceSlab?.type === 'slab' ? sourceSlab.polygon.length : 0,
    );
  });

  it('round-trips H-shape and pipe profiles without rectangular fallback', () => {
    const base = sampleProject as ProjectData;
    const project: ProjectData = {
      ...base,
      materials: [
        {
          id: 'MAT-STEEL',
          name: 'SN490',
          type: 'steel',
          elasticModulus: 205000,
          unitWeight: 78.5,
          Fy: 325,
        },
      ],
      sections: [
        { id: 'H-C', kind: 's_column_h', width: 300, depth: 300, tw: 10, tf: 15 },
        { id: 'P-B', kind: 's_pipe', diameter: 216.3, thickness: 8.2 },
      ],
      members: [
        {
          id: 'HC1',
          type: 'column',
          story: '1F',
          sectionId: 'H-C',
          materialId: 'MAT-STEEL',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 0, y: 0, z: 3000 },
        },
        {
          id: 'PB1',
          type: 'beam',
          story: '1F',
          sectionId: 'P-B',
          materialId: 'MAT-STEEL',
          start: { x: 0, y: 0, z: 3000 },
          end: { x: 5000, y: 0, z: 3000 },
        },
      ],
      openings: [],
    };

    const ifc = exportIfc(project);
    expect(ifc).toContain('IFCISHAPEPROFILEDEF');
    expect(ifc).toContain('IFCHOLLOWCIRCLEPROFILEDEF');
    const result = importIfc(ifc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.sections).toEqual(expect.arrayContaining(project.sections));
    expect(result.data.materials).toEqual(project.materials);
  });

  it('warns and skips zero-length members instead of exporting a fake 1mm solid', () => {
    const base = sampleProject as ProjectData;
    const project: ProjectData = {
      ...base,
      members: [
        {
          id: 'C0',
          type: 'column',
          story: '1F',
          sectionId: 'SEC-C600',
          materialId: 'MAT-RC-24',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 0, y: 0, z: 0 },
        },
      ],
      openings: [],
    };
    const warnings: string[] = [];
    const ifc = exportIfc(project, warnings);

    expect(ifc).not.toContain('IFCCOLUMN(');
    expect(warnings.some((warning) => warning.includes('長さ0'))).toBe(true);
  });
});
