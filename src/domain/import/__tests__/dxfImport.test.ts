import { describe, expect, it } from 'vitest';
import { importDxf } from '@/domain/import/dxfImport';

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
});
