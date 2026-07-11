import { describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { createEmptyProject } from '@/app/store/projectFactories';
import { drawingTemplates } from '@/domain/templates/drawingTemplates';
import { instantiateProject } from '@/domain/projectIdentity';

describe('project identity', () => {
  it('assigns a fresh identity to every blank and template project', () => {
    expect(createEmptyProject().project.id).not.toBe(createEmptyProject().project.id);
    for (const template of drawingTemplates) {
      expect(template.create().project.id).not.toBe(template.create().project.id);
    }
  });

  it('assigns fresh identity to sample working copies without mutating source', () => {
    const sourceId = sampleProject.project.id;
    const first = instantiateProject(sampleProject as unknown as ProjectData);
    const second = instantiateProject(sampleProject as unknown as ProjectData);
    expect(first.project.id).not.toBe(second.project.id);
    expect(first.project.id).not.toBe(sourceId);
    expect(sampleProject.project.id).toBe(sourceId);
  });
});
