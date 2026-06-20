import { beforeEach, describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import { useProjectStore } from '@/app/store/projectStore';
import type { ProjectData } from '@/domain/structural/types';

/**
 * Runtime checks for the immer-wired side effects added in this change:
 * grid edits must re-resolve gridRef members, and member edits must follow
 * associative dimensions — without throwing inside the immer producer.
 */
describe('projectStore grid/associative wiring', () => {
  beforeEach(() => {
    const cloned = JSON.parse(JSON.stringify(sampleProject)) as ProjectData;
    useProjectStore.getState().loadProject(cloned);
  });

  it('updateGrid moves a gridRef-pinned member and does not throw', () => {
    const store = useProjectStore.getState();
    // Pin a beam to grid intersections X1/Y1 -> X2/Y1.
    const beam = store.data!.members.find((m) => m.type === 'beam');
    expect(beam).toBeDefined();
    store.updateMember(beam!.id, {
      gridRef: { startGrid: ['X1', 'Y1'], endGrid: ['X2', 'Y1'] },
    } as never);

    const gx2 = useProjectStore.getState().data!.grids.find((g) => g.name === 'X2')!;
    expect(() => useProjectStore.getState().updateGrid(gx2.id, { position: 5000 })).not.toThrow();

    const moved = useProjectStore.getState().data!.members.find((m) => m.id === beam!.id)!;
    expect(moved.type === 'beam' && moved.end.x).toBe(5000);
  });

  it('updateMember recomputes associative dimensions without throwing', () => {
    const store = useProjectStore.getState();
    const beam = store.data!.members.find((m) => m.type === 'beam')!;
    // Make the first dimension associative to that beam.
    const dim = store.data!.dimensions[0];
    expect(dim).toBeDefined();
    store.updateDimension(dim.id, { associative: true, refMemberIds: [beam.id] } as never);

    expect(() =>
      useProjectStore.getState().updateMember(beam.id, {
        start: { x: 1234, y: 0, z: 0 },
        end: { x: 9876, y: 0, z: 0 },
      } as never),
    ).not.toThrow();

    const after = useProjectStore.getState().data!;
    const movedBeam = after.members.find((m) => m.id === beam.id)!;
    const updatedDim = after.dimensions.find((d) => d.id === dim.id)!;
    // Dimension endpoints should snap onto the beam's (moved) endpoints.
    const beamPts =
      movedBeam.type === 'beam'
        ? [
            { x: movedBeam.start.x, y: movedBeam.start.y },
            { x: movedBeam.end.x, y: movedBeam.end.y },
          ]
        : [];
    expect(beamPts).toContainEqual(updatedDim.start);
    expect(beamPts).toContainEqual(updatedDim.end);
  });
});
