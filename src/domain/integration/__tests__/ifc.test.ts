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
  });
});
