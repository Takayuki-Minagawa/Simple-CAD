import { describe, expect, it } from 'vitest';
import type { ProjectData } from '@/domain/structural/types';
import { applyEdgeEdit, computeEdgeEdit } from '../editTrim';

function project(): ProjectData {
  return {
    schemaVersion: '1.0.0',
    project: { id: 'P', name: 'T', unit: 'mm' },
    stories: [{ id: '1F', name: '1F', elevation: 0, height: 3000 }],
    grids: [],
    materials: [{ id: 'M', name: 'C', type: 'concrete' }],
    sections: [{ id: 'S', kind: 'rc_beam_rect', width: 300, depth: 600 }, { id: 'W', kind: 'rc_wall', thickness: 200 }],
    members: [
      // Horizontal beam from x=0 to x=5000 at y=1000.
      { id: 'beam-a', type: 'beam', story: '1F', sectionId: 'S', materialId: 'M', start: { x: 0, y: 1000, z: 3000 }, end: { x: 5000, y: 1000, z: 3000 } },
      // Vertical beam crossing beam-a at x=3000.
      { id: 'beam-b', type: 'beam', story: '1F', sectionId: 'S', materialId: 'M', start: { x: 3000, y: 0, z: 3000 }, end: { x: 3000, y: 4000, z: 3000 } },
      // Vertical beam beyond beam-a's end at x=8000.
      { id: 'beam-c', type: 'beam', story: '1F', sectionId: 'S', materialId: 'M', start: { x: 8000, y: 0, z: 3000 }, end: { x: 8000, y: 4000, z: 3000 } },
      // Two walls that would meet at (6000, 6000) if extended.
      { id: 'wall-1', type: 'wall', story: '1F', sectionId: 'W', materialId: 'M', start: { x: 0, y: 6000, z: 0 }, end: { x: 5000, y: 6000, z: 0 }, height: 3000, thickness: 200 },
      { id: 'wall-2', type: 'wall', story: '1F', sectionId: 'W', materialId: 'M', start: { x: 6000, y: 0, z: 0 }, end: { x: 6000, y: 5000, z: 0 }, height: 3000, thickness: 200 },
    ],
    openings: [],
    annotations: [],
    dimensions: [],
    sheets: [],
    views: [],
  } as unknown as ProjectData;
}

describe('computeEdgeEdit (ID-addressed trim/extend/fillet)', () => {
  it('trims the chosen end to the crossing reference and reports lengths', () => {
    const result = computeEdgeEdit(project(), {
      operation: 'trim', memberId: 'beam-a', end: 'end', referenceId: 'beam-b',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].after.end).toEqual({ x: 3000, y: 1000, z: 3000 });
    expect(result.changes[0].after.start).toEqual({ x: 0, y: 1000, z: 3000 });
    expect(result.changes[0].lengthBefore).toBe(5000);
    expect(result.changes[0].lengthAfter).toBe(3000);
  });

  it('trims the start end symmetrically', () => {
    const result = computeEdgeEdit(project(), {
      operation: 'trim', memberId: 'beam-a', end: 'start', referenceId: 'beam-b',
    });
    expect(result.ok && result.changes[0].after.start).toEqual({ x: 3000, y: 1000, z: 3000 });
  });

  it('refuses to trim with a reference that does not cross the segment', () => {
    const result = computeEdgeEdit(project(), {
      operation: 'trim', memberId: 'beam-a', end: 'end', referenceId: 'beam-c',
    });
    expect(result).toEqual({ ok: false, error: 'no-intersection' });
  });

  it('extends the chosen end to a reference beyond it, and refuses the other end', () => {
    const ok = computeEdgeEdit(project(), {
      operation: 'extend', memberId: 'beam-a', end: 'end', referenceId: 'beam-c',
    });
    expect(ok.ok && ok.changes[0].after.end).toEqual({ x: 8000, y: 1000, z: 3000 });
    expect(ok.ok && ok.changes[0].lengthAfter).toBe(8000);

    const wrongEnd = computeEdgeEdit(project(), {
      operation: 'extend', memberId: 'beam-a', end: 'start', referenceId: 'beam-c',
    });
    expect(wrongEnd).toEqual({ ok: false, error: 'no-intersection' });
  });

  it('reports identity, type and no-change errors', () => {
    const data = project();
    expect(computeEdgeEdit(data, { operation: 'trim', memberId: 'beam-a', end: 'end', referenceId: 'beam-a' }))
      .toEqual({ ok: false, error: 'same' });
    expect(computeEdgeEdit(data, { operation: 'trim', memberId: 'nope', end: 'end', referenceId: 'beam-a' }))
      .toEqual({ ok: false, error: 'target' });
    expect(computeEdgeEdit(data, { operation: 'trim', memberId: 'beam-a', end: 'end', referenceId: 'nope' }))
      .toEqual({ ok: false, error: 'reference' });
    expect(computeEdgeEdit(data, { operation: 'fillet', memberId: 'beam-a', end: 'end', referenceId: 'wall-1' }))
      .toEqual({ ok: false, error: 'not-wall' });
    // beam-b already ends exactly where beam-a crosses nothing new: trimming beam-b at beam-a
    // moves its start to y=1000, so use a member whose end already sits on the reference.
    const touching = project();
    touching.members[0] = { ...touching.members[0], end: { x: 3000, y: 1000, z: 3000 } } as ProjectData['members'][number];
    expect(computeEdgeEdit(touching, { operation: 'trim', memberId: 'beam-a', end: 'end', referenceId: 'beam-b' }))
      .toEqual({ ok: false, error: 'no-change' });
  });

  it('fillets two walls to their intersection without mutating the input', () => {
    const data = project();
    const result = computeEdgeEdit(data, {
      operation: 'fillet', memberId: 'wall-1', end: 'end', referenceId: 'wall-2',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changes.map((c) => c.id)).toEqual(['wall-1', 'wall-2']);
    expect(result.changes[0].after.end).toEqual({ x: 6000, y: 6000, z: 0 });
    expect(result.changes[1].after.end).toEqual({ x: 6000, y: 6000, z: 0 });
    // Preview must not touch the source project.
    expect(data.members[3]).toMatchObject({ end: { x: 5000, y: 6000 } });
  });

  it('applyEdgeEdit mutates only the affected endpoints', () => {
    const data = project();
    const result = applyEdgeEdit(data, {
      operation: 'trim', memberId: 'beam-a', end: 'end', referenceId: 'beam-b',
    });
    expect(result.ok).toBe(true);
    expect(data.members[0]).toMatchObject({ start: { x: 0, y: 1000, z: 3000 }, end: { x: 3000, y: 1000, z: 3000 } });
    expect(data.members[1]).toMatchObject({ start: { x: 3000, y: 0 }, end: { x: 3000, y: 4000 } });
  });
});
