import type { ProjectData, Member, Section } from '@/domain/structural/types';
import { distance2D, sub2D, normalize2D, perpendicular2D } from '@/domain/geometry/point';
import { getMemberPlanPolygon } from '@/domain/structural/memberShape';
import { validateGeometry, validateReferences } from '@/domain/validation';

/** Decimal places for DXF coordinate output. 4 dp at mm = 0.1µm — plenty. */
const DXF_DECIMALS = 4;

/**
 * Format a coordinate with fixed decimals (no full FP precision / exponent noise),
 * trimming trailing zeros so integers stay compact and parseFloat round-trips.
 */
function fmt(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const fixed = value.toFixed(DXF_DECIMALS);
  // Strip trailing zeros and a dangling decimal point.
  return fixed.replace(/\.?0+$/, '') || '0';
}

/**
 * Export DXF using manual string generation.
 * Using DXF ASCII format for maximum compatibility.
 */
export function exportDxf(data: ProjectData, storyId: string, warnings: string[] = []): string {
  const lines: string[] = [];

  for (const issue of [...validateReferences(data).errors, ...validateGeometry(data).errors]) {
    warnings.push(`Export validation: ${issue.message}`);
  }

  const bbox = computeBoundingBox(data, storyId);

  // Header section
  lines.push('0', 'SECTION', '2', 'HEADER');
  lines.push('9', '$ACADVER', '1', 'AC1015'); // AutoCAD 2000
  // Units: 4 = millimetres. Pairs with $MEASUREMENT=1 (metric) so receiving
  // CADs don't misread the drawing as inches/metres (B4 / 3-3).
  lines.push('9', '$INSUNITS', '70', '4');
  lines.push('9', '$MEASUREMENT', '70', '1');
  // Drawing extents from the bounding box (3-8).
  lines.push('9', '$EXTMIN', '10', fmt(bbox.minX), '20', fmt(bbox.minY), '30', '0');
  lines.push('9', '$EXTMAX', '10', fmt(bbox.maxX), '20', fmt(bbox.maxY), '30', '0');
  lines.push('0', 'ENDSEC');

  // Tables section (layers)
  lines.push('0', 'SECTION', '2', 'TABLES');
  lines.push('0', 'TABLE', '2', 'LAYER');

  const layerDefs = [
    { name: 'GRID', color: 3 }, // green
    { name: 'COLUMN', color: 1 }, // red
    { name: 'BEAM', color: 2 }, // yellow
    { name: 'WALL', color: 4 }, // cyan
    { name: 'SLAB', color: 6 }, // magenta
    { name: 'DIMENSION', color: 7 }, // white
    { name: 'ANNOTATION', color: 7 },
    { name: 'CONSTRUCTION', color: 8 }, // gray
    { name: 'SIMPLECAD_META', color: -7 }, // hidden metadata carrier
  ];

  for (const layer of layerDefs) {
    lines.push('0', 'LAYER');
    lines.push('2', layer.name);
    lines.push('70', '0');
    lines.push('62', String(layer.color));
    lines.push('6', 'CONTINUOUS');
  }
  lines.push('0', 'ENDTAB');
  lines.push('0', 'ENDSEC');

  // Entities section
  lines.push('0', 'SECTION', '2', 'ENTITIES');

  // Grids
  const xGrids = data.grids.filter((g) => g.axis === 'X');
  const yGrids = data.grids.filter((g) => g.axis === 'Y');
  const minX = xGrids.length ? Math.min(...xGrids.map((g) => g.position)) : 0;
  const maxX = xGrids.length ? Math.max(...xGrids.map((g) => g.position)) : 10000;
  const minY = yGrids.length ? Math.min(...yGrids.map((g) => g.position)) : 0;
  const maxY = yGrids.length ? Math.max(...yGrids.map((g) => g.position)) : 10000;

  for (const g of xGrids) {
    addLine(
      lines,
      'GRID',
      g.position,
      minY - 2000,
      g.position,
      maxY + 2000,
      encodeMetadata('GRID', g),
    );
  }
  for (const g of yGrids) {
    addLine(
      lines,
      'GRID',
      minX - 2000,
      g.position,
      maxX + 2000,
      g.position,
      encodeMetadata('GRID', g),
    );
  }

  // Members
  const members = data.members.filter((m) => m.story === storyId);
  for (const m of members) {
    if (!renderMemberDxf(lines, m, data.sections)) {
      warnings.push(`部材 ${m.id} は有効な平面形状を生成できないためDXF出力をスキップしました`);
    }
  }

  // Dimensions (decomposed to lines + text)
  const dimensions = data.dimensions.filter((d) => d.story === storyId);
  for (const [dimensionIndex, d] of dimensions.entries()) {
    const dir = normalize2D(sub2D(d.end, d.start));
    const perp = perpendicular2D(dir);
    const s = { x: d.start.x + perp.x * d.offset, y: d.start.y + perp.y * d.offset };
    const e = { x: d.end.x + perp.x * d.offset, y: d.end.y + perp.y * d.offset };
    addLine(lines, 'DIMENSION', s.x, s.y, e.x, e.y);
    // Extension lines
    addLine(lines, 'DIMENSION', d.start.x, d.start.y, s.x, s.y);
    addLine(lines, 'DIMENSION', d.end.x, d.end.y, e.x, e.y);
    // Text
    const len = distance2D(d.start, d.end);
    const text = d.text ?? len.toFixed(0);
    const mid = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
    addText(lines, 'DIMENSION', mid.x, mid.y, 250, text);
    addDimensionMetadata(lines, d, mid.x, mid.y, dimensionIndex + 1);
  }

  // Annotations
  const annotations = data.annotations.filter((a) => a.story === storyId);
  for (const a of annotations) {
    if (a.type === 'spline' && a.points && a.points.length >= 2) {
      addSpline(lines, 'ANNOTATION', a.points);
      continue;
    }
    if (a.text.includes('\n')) {
      addMText(lines, 'ANNOTATION', a.x, a.y, a.fontSize ?? 250, a.text, a.rotation);
    } else {
      addText(lines, 'ANNOTATION', a.x, a.y, a.fontSize ?? 250, a.text, a.rotation);
    }
  }

  // Construction Lines
  const constructionLines = (data.constructionLines ?? []).filter((cl) => cl.story === storyId);
  for (const cl of constructionLines) {
    const ext = 500000;
    if (cl.type === 'xline') {
      addLine(
        lines,
        'CONSTRUCTION',
        cl.origin.x - cl.direction.x * ext,
        cl.origin.y - cl.direction.y * ext,
        cl.origin.x + cl.direction.x * ext,
        cl.origin.y + cl.direction.y * ext,
        encodeMetadata('CONSTRUCTION', cl),
      );
    } else {
      addLine(
        lines,
        'CONSTRUCTION',
        cl.origin.x,
        cl.origin.y,
        cl.origin.x + cl.direction.x * ext,
        cl.origin.y + cl.direction.y * ext,
        encodeMetadata('CONSTRUCTION', cl),
      );
    }
  }

  lines.push('0', 'ENDSEC');
  lines.push('0', 'EOF');

  return lines.join('\n');
}

export function exportDxfWithWarnings(
  data: ProjectData,
  storyId: string,
): { content: string; warnings: string[] } {
  const warnings: string[] = [];
  return { content: exportDxf(data, storyId, warnings), warnings };
}

function renderMemberDxf(lines: string[], m: Member, sections: Section[]): boolean {
  const sec = sections.find((s) => s.id === m.sectionId);
  const polygon = getMemberPlanPolygon(m, sec);
  if (!polygon) return false;
  const layer = memberLayerName(m);
  addLwPolyline(
    lines,
    layer,
    polygon.map((point) => [point.x, point.y]),
    true,
    encodeMetadata('MEMBER', {
      id: m.id,
      rotation: m.rotation,
      axisOffset: m.axisOffset,
      faceAlign: m.faceAlign,
      localAxis: m.localAxis,
      releases: m.releases,
      rigidZones: m.rigidZones,
    }),
  );
  return true;
}

function memberLayerName(member: Member): string {
  switch (member.type) {
    case 'column':
      return 'COLUMN';
    case 'beam':
      return 'BEAM';
    case 'wall':
      return 'WALL';
    case 'slab':
      return 'SLAB';
  }
}

function addLine(
  lines: string[],
  layer: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  metadata?: string,
) {
  lines.push('0', 'LINE');
  lines.push('8', layer);
  lines.push('10', fmt(x1), '20', fmt(y1), '30', '0');
  lines.push('11', fmt(x2), '21', fmt(y2), '31', '0');
  if (metadata) lines.push('999', metadata);
}

function addDimensionMetadata(
  lines: string[],
  dimension: ProjectData['dimensions'][number],
  lineX: number,
  lineY: number,
  anonymousBlockIndex: number,
) {
  lines.push('0', 'DIMENSION');
  lines.push('8', 'SIMPLECAD_META');
  // Group 2 (anonymous block name) and group 70 (dimension type) are required
  // by strict DXF readers even though this hidden entity only carries our
  // round-trip metadata; visible dimension graphics are emitted above.
  lines.push('2', `*D${anonymousBlockIndex}`);
  lines.push('70', '0');
  lines.push('10', fmt(lineX), '20', fmt(lineY), '30', '0');
  lines.push('13', fmt(dimension.start.x), '23', fmt(dimension.start.y), '33', '0');
  lines.push('14', fmt(dimension.end.x), '24', fmt(dimension.end.y), '34', '0');
  if (dimension.text) lines.push('1', dimension.text.replace(/\r?\n/g, ' '));
  lines.push(
    '999',
    encodeMetadata('DIMENSION', {
      id: dimension.id,
      color: dimension.color,
      lineWeight: dimension.lineWeight,
      lineType: dimension.lineType,
    }),
  );
}

function encodeMetadata(kind: string, value: unknown): string {
  return `SIMPLECAD_${kind}:${encodeURIComponent(JSON.stringify(value))}`;
}

function addLwPolyline(
  lines: string[],
  layer: string,
  points: number[][],
  closed: boolean,
  metadata?: string,
) {
  lines.push('0', 'LWPOLYLINE');
  lines.push('8', layer);
  lines.push('90', String(points.length));
  lines.push('70', closed ? '1' : '0');
  for (const [x, y] of points) {
    lines.push('10', fmt(x), '20', fmt(y));
  }
  if (metadata) lines.push('999', metadata);
}

function addText(
  lines: string[],
  layer: string,
  x: number,
  y: number,
  height: number,
  text: string,
  rotation?: number,
) {
  const sanitized = text.replace(/\r?\n/g, ' ');
  lines.push('0', 'TEXT');
  lines.push('8', layer);
  lines.push('10', fmt(x), '20', fmt(y), '30', '0');
  lines.push('40', fmt(height));
  if (rotation) {
    lines.push('50', fmt(rotation));
  }
  lines.push('1', sanitized);
}

function addMText(
  lines: string[],
  layer: string,
  x: number,
  y: number,
  height: number,
  text: string,
  rotation?: number,
) {
  lines.push('0', 'MTEXT');
  lines.push('8', layer);
  lines.push('10', fmt(x), '20', fmt(y), '30', '0');
  lines.push('40', fmt(height));
  if (rotation) {
    lines.push('50', fmt(rotation));
  }
  const encoded = text.replace(/\r?\n/g, '\\P');
  lines.push('1', encoded);
}

function addSpline(lines: string[], layer: string, points: { x: number; y: number }[]) {
  // Valid open clamped B-spline. Degree must be lower than control-point count,
  // and DXF requires an explicit knot count/vector.
  const degree = Math.min(3, points.length - 1);
  const knotCount = points.length + degree + 1;
  const interiorCount = knotCount - (degree + 1) * 2;
  const knots = [
    ...Array<number>(degree + 1).fill(0),
    ...Array.from({ length: Math.max(interiorCount, 0) }, (_, index) =>
      (index + 1) / (interiorCount + 1),
    ),
    ...Array<number>(degree + 1).fill(1),
  ];
  lines.push('0', 'SPLINE');
  lines.push('8', layer);
  lines.push('70', '8'); // Planar flag
  lines.push('71', String(degree));
  lines.push('72', String(knots.length));
  lines.push('73', String(points.length)); // Number of control points
  lines.push('74', '0');
  for (const knot of knots) lines.push('40', fmt(knot));
  for (const p of points) {
    lines.push('10', fmt(p.x), '20', fmt(p.y), '30', '0');
  }
  lines.push('210', '0', '220', '0', '230', '1');
}

/** Compute the 2D bounding box of all renderable geometry for `storyId`. */
function computeBoundingBox(
  data: ProjectData,
  storyId: string,
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const acc = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const g of data.grids) {
    if (g.axis === 'X') acc(g.position, 0);
    else acc(0, g.position);
  }
  for (const m of data.members) {
    if (m.story !== storyId) continue;
    const section = data.sections.find((item) => item.id === m.sectionId);
    const polygon = getMemberPlanPolygon(m, section);
    if (!polygon) continue;
    for (const p of polygon) acc(p.x, p.y);
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return { minX, minY, maxX, maxY };
}
