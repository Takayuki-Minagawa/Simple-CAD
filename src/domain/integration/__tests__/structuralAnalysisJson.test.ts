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
});
