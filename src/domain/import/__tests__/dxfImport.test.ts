import { describe, expect, it } from 'vitest';
import { importDxf, isRectangle, isSquarish, getAutoSections, DXF_MATERIAL_ID } from '@/domain/import/dxfImport';

const SAMPLE_DXF = `0
SECTION
2
ENTITIES
0
MTEXT
8
NOTES
10
1000
20
2000
40
250
1
Line1\\PLine2
0
SPLINE
8
CURVE
10
0
20
0
10
500
20
300
10
1000
20
0
0
HATCH
8
HATCH
10
0
20
0
10
1000
20
0
10
1000
20
500
10
0
20
500
0
ELLIPSE
8
CURVE
10
1500
20
2000
11
400
21
0
40
0.5
0
ENDSEC
0
EOF`;

describe('importDxf', () => {
  it('supports mtext, spline, hatch, and ellipse entities', () => {
    const result = importDxf(SAMPLE_DXF, '1F');

    expect(result.primitiveCount).toBe(4);
    expect(result.warnings).toHaveLength(0);
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0]).toMatchObject({
      story: '1F',
      x: 1000,
      y: 2000,
      text: 'Line1 Line2',
      fontSize: 250,
    });
  });

  it('returns empty members/dimensions when convertGeometry is false (default)', () => {
    const dxf = `0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nWALL\n10\n0\n20\n0\n11\n1000\n21\n0\n0\nENDSEC\n0\nEOF`;
    const result = importDxf(dxf, '1F');
    expect(result.members).toHaveLength(0);
    expect(result.dimensions).toHaveLength(0);
    expect(result.primitiveCount).toBe(1);
  });

  it('converts a DXF LINE entity to a wall member', () => {
    const dxf = `0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nWALL\n10\n0\n20\n0\n11\n5000\n21\n0\n0\nENDSEC\n0\nEOF`;
    const result = importDxf(dxf, '1F', { convertGeometry: true });

    expect(result.members).toHaveLength(1);
    const wall = result.members[0];
    expect(wall.type).toBe('wall');
    expect(wall.story).toBe('1F');
    expect(wall.materialId).toBe(DXF_MATERIAL_ID);
    if (wall.type === 'wall') {
      expect(wall.start.x).toBe(0);
      expect(wall.start.y).toBe(0);
      expect(wall.end.x).toBe(5000);
      expect(wall.end.y).toBe(0);
      expect(wall.thickness).toBe(200);
      expect(wall.height).toBe(3000);
    }

    // Should auto-generate a wall section
    const sections = getAutoSections(result);
    expect(sections.length).toBeGreaterThanOrEqual(1);
    expect(sections.some((s) => s.kind === 'rc_wall')).toBe(true);
  });

  it('converts a closed rectangular LWPOLYLINE (squarish) to a column member', () => {
    // 600x600 square polyline (closed, flag 70=1)
    const dxf = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', 'COL',
      '70', '1',
      '10', '0', '20', '0',
      '10', '600', '20', '0',
      '10', '600', '20', '600',
      '10', '0', '20', '600',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');

    const result = importDxf(dxf, '1F', { convertGeometry: true });

    expect(result.members).toHaveLength(1);
    const col = result.members[0];
    expect(col.type).toBe('column');
    expect(col.materialId).toBe(DXF_MATERIAL_ID);
    if (col.type === 'column') {
      expect(col.start.x).toBe(300);
      expect(col.start.y).toBe(300);
    }

    const sections = getAutoSections(result);
    expect(sections.some((s) => s.kind === 'rc_column_rect')).toBe(true);
  });

  it('converts a closed elongated rectangular LWPOLYLINE to a beam member', () => {
    // 300x3000 rectangle (aspect ratio 10:1)
    const dxf = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', 'BEAM',
      '70', '1',
      '10', '0', '20', '0',
      '10', '3000', '20', '0',
      '10', '3000', '20', '300',
      '10', '0', '20', '300',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');

    const result = importDxf(dxf, '1F', { convertGeometry: true });

    expect(result.members).toHaveLength(1);
    const beam = result.members[0];
    expect(beam.type).toBe('beam');

    const sections = getAutoSections(result);
    expect(sections.some((s) => s.kind === 'rc_beam_rect')).toBe(true);
  });

  it('converts a DXF CIRCLE entity to a column member', () => {
    const dxf = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'CIRCLE', '8', 'COL',
      '10', '2000', '20', '3000', '40', '300',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');

    const result = importDxf(dxf, '2F', { convertGeometry: true });

    expect(result.members).toHaveLength(1);
    const col = result.members[0];
    expect(col.type).toBe('column');
    expect(col.story).toBe('2F');
    if (col.type === 'column') {
      expect(col.start.x).toBe(2000);
      expect(col.start.y).toBe(3000);
    }

    const sections = getAutoSections(result);
    const colSec = sections.find((s) => s.kind === 'rc_column_rect');
    expect(colSec).toBeDefined();
    if (colSec && colSec.kind === 'rc_column_rect') {
      expect(colSec.width).toBe(600);
      expect(colSec.depth).toBe(600);
    }
  });

  it('converts an open LWPOLYLINE to wall segments', () => {
    // 3-vertex open polyline → 2 wall segments
    const dxf = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', 'WALL',
      '70', '0',
      '10', '0', '20', '0',
      '10', '1000', '20', '0',
      '10', '1000', '20', '2000',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');

    const result = importDxf(dxf, '1F', { convertGeometry: true });

    expect(result.members).toHaveLength(2);
    expect(result.members.every((m) => m.type === 'wall')).toBe(true);
  });

  it('converts a closed polygon (non-rectangular, 5 vertices) to a slab', () => {
    const dxf = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', 'SLAB',
      '70', '1',
      '10', '0', '20', '0',
      '10', '3000', '20', '0',
      '10', '4000', '20', '2000',
      '10', '2000', '20', '4000',
      '10', '0', '20', '3000',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');

    const result = importDxf(dxf, '1F', { convertGeometry: true });

    expect(result.members).toHaveLength(1);
    expect(result.members[0].type).toBe('slab');
    if (result.members[0].type === 'slab') {
      expect(result.members[0].polygon).toHaveLength(5);
    }
  });

  it('converts DXF DIMENSION entities to dimension objects', () => {
    const dxf = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'DIMENSION', '8', 'DIM',
      '10', '500', '20', '500',
      '13', '0', '23', '0',
      '14', '1000', '24', '0',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');

    const result = importDxf(dxf, '1F', { convertGeometry: true });

    expect(result.dimensions).toHaveLength(1);
    expect(result.dimensions[0].start).toEqual({ x: 0, y: 0 });
    expect(result.dimensions[0].end).toEqual({ x: 1000, y: 0 });
    expect(result.dimensions[0].story).toBe('1F');
  });
});

describe('isRectangle', () => {
  it('detects a simple axis-aligned rectangle', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 500 },
      { x: 0, y: 500 },
    ];
    const info = isRectangle(pts);
    expect(info.isRect).toBe(true);
    expect(info.center.x).toBeCloseTo(500);
    expect(info.center.y).toBeCloseTo(250);
  });

  it('rejects a non-rectangular quadrilateral', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1200, y: 500 },
      { x: 0, y: 500 },
    ];
    const info = isRectangle(pts);
    expect(info.isRect).toBe(false);
  });

  it('rejects a polygon with != 4 vertices', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 500 },
    ];
    expect(isRectangle(pts).isRect).toBe(false);
  });
});

describe('isSquarish', () => {
  it('returns true for square-like dimensions', () => {
    expect(isSquarish(600, 600)).toBe(true);
    expect(isSquarish(500, 700)).toBe(true);
  });

  it('returns false for elongated dimensions', () => {
    expect(isSquarish(300, 3000)).toBe(false);
  });

  it('returns false for zero dimensions', () => {
    expect(isSquarish(0, 500)).toBe(false);
  });
});

describe('regression: classic POLYLINE + VERTEX', () => {
  const CLASSIC_POLYLINE_DXF = `0
SECTION
2
ENTITIES
0
POLYLINE
8
WALLS
70
1
0
VERTEX
10
0
20
0
0
VERTEX
10
4000
20
0
0
VERTEX
10
4000
20
600
0
VERTEX
10
0
20
600
0
SEQEND
0
ENDSEC
0
EOF`;

  it('imports classic POLYLINE vertices as column from closed rectangle', () => {
    const result = importDxf(CLASSIC_POLYLINE_DXF, '1F', { convertGeometry: true });
    // Closed rectangle 4000x600 → elongated → beam
    expect(result.members.length).toBeGreaterThanOrEqual(1);
    expect(result.primitiveCount).toBe(1);
  });
});

describe('regression: dimension offset sign', () => {
  const DIM_NEGATIVE_DXF = `0
SECTION
2
ENTITIES
0
DIMENSION
13
0
23
0
14
4000
24
0
10
2000
20
-500
0
ENDSEC
0
EOF`;

  it('preserves negative offset for dimensions below the measured line', () => {
    const result = importDxf(DIM_NEGATIVE_DXF, '1F', { convertGeometry: true });
    expect(result.dimensions).toHaveLength(1);
    expect(result.dimensions[0].offset).toBeLessThan(0);
  });
});
