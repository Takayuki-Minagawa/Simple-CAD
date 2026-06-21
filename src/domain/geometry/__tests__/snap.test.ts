import { describe, it, expect } from 'vitest';
import {
  findSnap,
  buildSnapCandidatesFromMembers,
  buildSnapCandidatesFromConstructionLines,
  type SnapCandidate,
} from '../snap';
import type { SnapMode } from '@/app/store/editorStore';

const ALL_MODES: SnapMode[] = [
  'grid',
  'endpoint',
  'midpoint',
  'intersection',
  'perpendicular',
  'nearest',
];

describe('findSnap — intersection snap', () => {
  it('snaps to the crossing point of two members', () => {
    // Horizontal edge y=0 and vertical edge x=0 cross at origin.
    const candidates = buildSnapCandidatesFromMembers([
      { id: 'h', type: 'beam', start: { x: -100, y: 0 }, end: { x: 100, y: 0 } },
      { id: 'v', type: 'beam', start: { x: 0, y: -100 }, end: { x: 0, y: 100 } },
    ]);

    // Cursor near the intersection but off the endpoints/midpoints.
    const result = findSnap({ x: 3, y: 4 }, candidates, ['intersection'], 100, 15, 1);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('intersection');
    expect(result!.point.x).toBeCloseTo(0, 6);
    expect(result!.point.y).toBeCloseTo(0, 6);
  });

  it('does not snap to intersection outside the snap radius', () => {
    const candidates = buildSnapCandidatesFromMembers([
      { id: 'h', type: 'beam', start: { x: -100, y: 0 }, end: { x: 100, y: 0 } },
      { id: 'v', type: 'beam', start: { x: 0, y: -100 }, end: { x: 0, y: 100 } },
    ]);
    // worldRadius = 15 / 1 = 15; cursor 50 away from origin.
    const result = findSnap({ x: 50, y: 0 }, candidates, ['intersection'], 100, 15, 1);
    // Endpoint/midpoint disabled here, so far cursor yields no intersection snap.
    expect(result).toBeNull();
  });

  it('returns null when segments do not cross (parallel)', () => {
    const candidates = buildSnapCandidatesFromMembers([
      { id: 'a', type: 'beam', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      { id: 'b', type: 'beam', start: { x: 0, y: 50 }, end: { x: 100, y: 50 } },
    ]);
    const result = findSnap({ x: 50, y: 25 }, candidates, ['intersection'], 100, 15, 1);
    expect(result).toBeNull();
  });
});

describe('findSnap — priority tiers', () => {
  it('prefers a top-tier endpoint over a closer midpoint', () => {
    // Endpoint at (0,0) is 5 away; midpoint at (3,0) is 2 away (closer).
    // A midpoint candidate is on a different member so both are active.
    const candidates: SnapCandidate[] = [
      { id: 'ep', endpoints: [{ x: 0, y: 0 }], midpoints: [] },
      { id: 'mp', endpoints: [], midpoints: [{ x: 3, y: 0 }] },
    ];
    const result = findSnap({ x: 5, y: 0 }, candidates, ALL_MODES, 100, 15, 1);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('endpoint');
    expect(result!.point).toEqual({ x: 0, y: 0 });
  });

  it('prefers a top-tier intersection over a closer nearest/edge point', () => {
    // Two crossing edges -> intersection at origin (distance 5 from cursor).
    // A separate edge passes very close to the cursor (nearest would be ~1 away).
    const candidates: SnapCandidate[] = [
      {
        id: 'cross1',
        endpoints: [],
        midpoints: [],
        edges: [[{ x: -100, y: 0 }, { x: 100, y: 0 }]],
      },
      {
        id: 'cross2',
        endpoints: [],
        midpoints: [],
        edges: [[{ x: 0, y: -100 }, { x: 0, y: 100 }]],
      },
      {
        // A short non-crossing edge passing ~1 unit from the cursor; nearest
        // would pick it, but it must lose to the top-tier intersection.
        id: 'near',
        endpoints: [],
        midpoints: [],
        edges: [[{ x: 3, y: 6 }, { x: 100, y: 6 }]],
      },
    ];
    const result = findSnap({ x: 4, y: 5 }, candidates, ALL_MODES, 100, 15, 1);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('intersection');
    expect(result!.point.x).toBeCloseTo(0, 6);
    expect(result!.point.y).toBeCloseTo(0, 6);
  });

  it('falls through to a lower tier when no top-tier candidate is in range', () => {
    const candidates: SnapCandidate[] = [
      { id: 'mp', endpoints: [], midpoints: [{ x: 0, y: 0 }] },
    ];
    const result = findSnap({ x: 2, y: 0 }, candidates, ALL_MODES, 100, 15, 1);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('midpoint');
  });

  it('compares by distance within the top tier', () => {
    const candidates: SnapCandidate[] = [
      { id: 'far', endpoints: [{ x: 10, y: 0 }], midpoints: [] },
      { id: 'near', endpoints: [{ x: 2, y: 0 }], midpoints: [] },
    ];
    const result = findSnap({ x: 0, y: 0 }, candidates, ['endpoint'], 100, 15, 1);
    expect(result!.sourceId).toBe('near');
  });
});

describe('buildSnapCandidatesFromConstructionLines', () => {
  it('turns an xline into a pseudo-edge clipped both ways from origin', () => {
    const candidates = buildSnapCandidatesFromConstructionLines([
      { id: 'xl1', type: 'xline', origin: { x: 0, y: 0 }, direction: { x: 1, y: 0 } },
    ]);
    expect(candidates).toHaveLength(1);
    const edge = candidates[0].edges![0];
    // Back end is negative x, forward end positive x (extends both directions).
    expect(edge[0].x).toBeLessThan(0);
    expect(edge[1].x).toBeGreaterThan(0);
    expect(edge[0].y).toBeCloseTo(0, 6);
    expect(edge[1].y).toBeCloseTo(0, 6);
  });

  it('turns a ray into a pseudo-edge starting at its origin', () => {
    const candidates = buildSnapCandidatesFromConstructionLines([
      { id: 'r1', type: 'ray', origin: { x: 5, y: 5 }, direction: { x: 0, y: 2 } },
    ]);
    const edge = candidates[0].edges![0];
    // Ray starts exactly at origin, extends only forward (+y).
    expect(edge[0]).toEqual({ x: 5, y: 5 });
    expect(edge[1].y).toBeGreaterThan(5);
    expect(edge[1].x).toBeCloseTo(5, 6);
  });

  it('normalizes non-unit directions', () => {
    const candidates = buildSnapCandidatesFromConstructionLines(
      [{ id: 'xl', type: 'xline', origin: { x: 0, y: 0 }, direction: { x: 3, y: 4 } }],
      100,
    );
    const edge = candidates[0].edges![0];
    // Forward point should be clipLength (100) along the unit direction (0.6, 0.8).
    expect(edge[1].x).toBeCloseTo(60, 6);
    expect(edge[1].y).toBeCloseTo(80, 6);
  });

  it('skips degenerate directions', () => {
    const candidates = buildSnapCandidatesFromConstructionLines([
      { id: 'bad', type: 'xline', origin: { x: 0, y: 0 }, direction: { x: 0, y: 0 } },
    ]);
    expect(candidates).toHaveLength(0);
  });

  it('construction-line edges participate in nearest snap', () => {
    const candidates = buildSnapCandidatesFromConstructionLines([
      { id: 'xl', type: 'xline', origin: { x: 0, y: 0 }, direction: { x: 1, y: 0 } },
    ]);
    // Cursor slightly above the y=0 line snaps onto it via nearest.
    const result = findSnap({ x: 50, y: 3 }, candidates, ['nearest'], 100, 15, 1);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('nearest');
    expect(result!.point.y).toBeCloseTo(0, 6);
    expect(result!.point.x).toBeCloseTo(50, 6);
  });

  it('two construction lines produce an intersection snap', () => {
    const candidates = buildSnapCandidatesFromConstructionLines([
      { id: 'h', type: 'xline', origin: { x: 0, y: 0 }, direction: { x: 1, y: 0 } },
      { id: 'v', type: 'xline', origin: { x: 10, y: 0 }, direction: { x: 0, y: 1 } },
    ]);
    const result = findSnap({ x: 12, y: 3 }, candidates, ['intersection'], 100, 15, 1);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('intersection');
    expect(result!.point.x).toBeCloseTo(10, 6);
    expect(result!.point.y).toBeCloseTo(0, 6);
  });
});
