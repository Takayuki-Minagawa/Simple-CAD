import { describe, it, expect } from 'vitest';
import { validateReferences } from '../referenceValidator';
import { validateProject } from '..';
import sampleProject from '@/samples/sample-project.json';
import { isLinearMember, type ProjectData } from '@/domain/structural/types';

const validData = sampleProject as unknown as ProjectData;

describe('validateReferences', () => {
  it('passes for valid sample project', () => {
    const result = validateReferences(validData);
    expect(result.ok).toBe(true);
    expect(result.errors.every((error) => error.level !== 'error')).toBe(true);
    expect(result.errors.some((error) => error.path === '/supports')).toBe(true);
  });

  it('detects invalid story reference in member', () => {
    const data: ProjectData = {
      ...validData,
      members: [
        {
          id: 'C-TEST',
          type: 'column',
          story: 'NON_EXISTENT',
          sectionId: 'SEC-C600',
          materialId: 'MAT-RC-24',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 0, y: 0, z: 3000 },
        },
      ],
    };
    const result = validateReferences(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('story'))).toBe(true);
  });

  it('detects section.kind ↔ member.type mismatch', () => {
    const data: ProjectData = {
      ...validData,
      members: [
        {
          id: 'C-BADSEC',
          type: 'column',
          story: '1F',
          // rc_slab section used by a column → inconsistent
          sectionId: 'SEC-SLAB180',
          materialId: 'MAT-RC-24',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 0, y: 0, z: 3000 },
        },
      ],
    };
    const result = validateReferences(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('section.kind'))).toBe(true);
  });

  it('detects group referencing a missing member', () => {
    const data: ProjectData = {
      ...validData,
      groups: [{ id: 'G1', name: 'g', memberIds: ['NON_EXISTENT'] }],
    };
    const result = validateReferences(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Group'))).toBe(true);
  });

  it('detects viewport referencing a missing view', () => {
    const data: ProjectData = {
      ...validData,
      sheets: [
        {
          ...validData.sheets[0],
          viewports: [
            {
              id: 'VP1',
              sheetId: validData.sheets[0].id,
              viewId: 'NON_EXISTENT_VIEW',
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              scale: '1:100',
            },
          ],
        },
        ...validData.sheets.slice(1),
      ],
    };
    const result = validateReferences(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Viewport'))).toBe(true);
  });

  it('detects duplicate IDs', () => {
    const data: ProjectData = {
      ...validData,
      stories: [
        { id: '1F', name: '1F', elevation: 0, height: 3000 },
        { id: '1F', name: '1F duplicate', elevation: 3000, height: 3000 },
      ],
    };
    const result = validateReferences(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('重複'))).toBe(true);
  });

  it('detects IDs colliding across selectable entity collections', () => {
    const memberId = validData.members[0].id;
    const data: ProjectData = {
      ...validData,
      annotations: [
        ...validData.annotations,
        { id: memberId, type: 'text', story: '1F', x: 0, y: 0, text: 'collision' },
      ],
    };
    const result = validateReferences(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.path === '/selectableEntities')).toBe(true);
  });

  it('rejects isolated supports, nodal loads and masses beyond the 1mm tolerance', () => {
    const data: ProjectData = {
      ...validData,
      loadCases: [{ id: 'LC1', name: 'Dead', type: 'dead' }],
      supports: [{
        id: 'SUP-ISO', storyId: '1F', position: { x: 999999, y: 999999, z: 0 },
        restraints: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
      }],
      nodalLoads: [{
        id: 'NL-ISO', storyId: '1F', loadCaseId: 'LC1',
        position: { x: 999999, y: 999999, z: 0 }, force: { x: 0, y: 0, z: -1 },
      }],
      masses: [{
        id: 'M-ISO', storyId: '1F', position: { x: 999999, y: 999999, z: 0 },
        mass: { x: 1, y: 1, z: 1 },
      }],
    };
    const result = validateReferences(data);
    expect(result.errors.filter((error) => error.message.includes('接続されていません'))).toHaveLength(3);
  });

  it('accepts analysis points connected to a member node or diaphragm master', () => {
    const member = validData.members.find(
      (item) => item.story === '1F' && isLinearMember(item),
    );
    if (!member || !isLinearMember(member)) throw new Error('missing linear member');
    const master = { x: 12345, y: 6789, z: 3000 };
    const data: ProjectData = {
      ...validData,
      supports: [{
        id: 'SUP-NODE', storyId: '1F', position: { ...member.start },
        restraints: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
      }],
      diaphragms: [{ id: 'DIA', storyId: '1F', type: 'rigid', masterPosition: master }],
      masses: [{ id: 'M-MASTER', storyId: '1F', position: master, mass: { x: 1, y: 1, z: 1 } }],
    };
    const result = validateReferences(data);
    expect(result.errors.some((error) => error.message.includes('接続されていません'))).toBe(false);
  });

  it('detects duplicate load-case factors in a combination', () => {
    const data: ProjectData = {
      ...validData,
      loadCases: [{ id: 'LC1', name: 'Dead', type: 'dead' }],
      loadCombinations: [
        {
          id: 'COMB1',
          name: 'duplicate',
          type: 'linear',
          factors: [
            { loadCaseId: 'LC1', factor: 1 },
            { loadCaseId: 'LC1', factor: 0.5 },
          ],
        },
      ],
    };

    const result = validateReferences(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.message.includes('重複'))).toBe(true);
  });

  it('recursively validates references inside external projects', () => {
    const nested = structuredClone(validData);
    nested.members[0].materialId = 'MISSING-IN-XREF';
    const data = structuredClone(validData);
    data.externalRefs = [
      {
        id: 'XREF-1',
        name: 'invalid nested project',
        data: nested,
        offsetX: 0,
        offsetY: 0,
        visible: true,
      },
    ];

    const result = validateProject(data);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some(
        (error) =>
          error.path?.startsWith('/externalRefs/0/data') &&
          error.message.includes('MISSING-IN-XREF'),
      ),
    ).toBe(true);
  });
});
