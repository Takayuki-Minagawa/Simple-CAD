import {
  DxfWriter,
  Units,
  point3d,
  type EntitiesManager,
  type Dxfier,
  MText,
} from '@tarikjabiri/dxf';
import { DEFAULT_DXF_VERSION, isDxfVersion, type DxfVersion } from '@/domain/dxf/format';
import type { ProjectData, Member, Section } from '@/domain/structural/types';
import { distance2D, sub2D, normalize2D, perpendicular2D } from '@/domain/geometry/point';
import { getMemberPlanPolygon } from '@/domain/structural/memberShape';
import { validateGeometry, validateReferences } from '@/domain/validation';

/** Decimal places for DXF coordinate output. 4 dp at mm = 0.1µm — plenty. */
const DXF_DECIMALS = 4;

export interface DxfExportOptions {
  version?: DxfVersion;
}

/**
 * Format a coordinate with fixed decimals (no full FP precision / exponent noise),
 * trimming trailing zeros so integers stay compact and parseFloat round-trips.
 */
function fmt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const fixed = value.toFixed(DXF_DECIMALS);
  // Strip trailing zeros and a dangling decimal point.
  return Number(fixed);
}

/**
 * Export UTF-8 text DXF with complete tables, ownership handles and subclasses.
 * All target generations support all entities emitted here.
 */
export function exportDxf(
  data: ProjectData,
  storyId: string,
  warnings: string[] = [],
  options: DxfExportOptions = {},
): string {
  const version = options.version ?? DEFAULT_DXF_VERSION;
  if (!isDxfVersion(version)) throw new Error(`未対応のDXF出力形式: ${version}`);
  if (!data.stories.some((story) => story.id === storyId)) {
    throw new Error(`DXF出力対象の階がありません: ${storyId}`);
  }
  const writer = new DxfWriter();
  const lines = writer.modelSpace;
  writer.setUnits(Units.Millimeters);
  writer.tables.addAppId('SIMPLECAD');

  for (const issue of [...validateReferences(data).errors, ...validateGeometry(data).errors]) {
    warnings.push(`Export validation: ${issue.message}`);
  }

  const bbox = computeBoundingBox(data, storyId);

  writer.setVariable('$ACADVER', { 1: version });
  if (version === 'AC1015') writer.setVariable('$DWGCODEPAGE', { 3: 'ANSI_1252' });
  writer.setVariable('$MEASUREMENT', { 70: 1 });
  writer.setVariable('$EXTMIN', { 10: fmt(bbox.minX), 20: fmt(bbox.minY), 30: 0 });
  writer.setVariable('$EXTMAX', { 10: fmt(bbox.maxX), 20: fmt(bbox.maxY), 30: 0 });

  const layerDefs = [
    { name: 'GRID', color: 3 }, // green
    { name: 'COLUMN', color: 1 }, // red
    { name: 'BEAM', color: 2 }, // yellow
    { name: 'WALL', color: 4 }, // cyan
    { name: 'SLAB', color: 6 }, // magenta
    { name: 'DIMENSION', color: 7 }, // white
    { name: 'ANNOTATION', color: 7 },
    { name: 'CONSTRUCTION', color: 8 }, // gray
  ];

  for (const layer of layerDefs) {
    writer.addLayer(layer.name, layer.color, 'Continuous');
  }

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

  // Native dimensions reference actual graphical blocks, so other CADs can
  // display them without repairing a dangling *D block reference.
  const dimensions = data.dimensions.filter((d) => d.story === storyId);
  for (const [dimensionIndex, d] of dimensions.entries()) {
    const dir = normalize2D(sub2D(d.end, d.start));
    const perp = perpendicular2D(dir);
    const s = { x: d.start.x + perp.x * d.offset, y: d.start.y + perp.y * d.offset };
    const e = { x: d.end.x + perp.x * d.offset, y: d.end.y + perp.y * d.offset };
    const block = writer.addBlock(`SIMPLECAD_DIM_${dimensionIndex + 1}`);
    addLine(block, '0', s.x, s.y, e.x, e.y);
    addLine(block, '0', d.start.x, d.start.y, s.x, s.y);
    addLine(block, '0', d.end.x, d.end.y, e.x, e.y);
    const text = d.text ?? distance2D(d.start, d.end).toFixed(0);
    const mid = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
    addText(block, '0', mid.x, mid.y, 250, text);
    const entity = lines.addAlignedDim(
      point3d(fmt(d.start.x), fmt(d.start.y), 0),
      point3d(fmt(d.end.x), fmt(d.end.y), 0),
      {
        blockName: block.name,
        definitionPoint: point3d(fmt(mid.x), fmt(mid.y), 0),
        middlePoint: point3d(fmt(mid.x), fmt(mid.y), 0),
        layerName: 'DIMENSION',
        styleName: 'Standard',
        text: d.text?.replace(/\r?\n/g, ' '),
      },
    );
    addMetadata(
      entity,
      encodeMetadata('DIMENSION', {
        id: d.id,
        color: d.color,
        lineWeight: d.lineWeight,
        lineType: d.lineType,
      }),
    );
  }

  // Annotations
  const annotations = data.annotations.filter((a) => a.story === storyId);
  for (const a of annotations) {
    if (a.type === 'spline' && a.points && a.points.length >= 2) {
      addSpline(lines, 'ANNOTATION', a.points);
      continue;
    }
    if (a.text.includes('\n') || a.text.length > 250) {
      addMText(
        lines,
        'ANNOTATION',
        a.x,
        a.y,
        a.fontSize ?? 250,
        a.text,
        a.rotation,
        version === 'AC1015',
      );
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

  const content = writer.stringify();
  // Pre-2007 DXF uses a legacy code page. ASCII Unicode escapes preserve
  // Japanese without pretending an AutoCAD 2000 file is UTF-8.
  return version === 'AC1015' ? escapeUnicode(content) : content;
}

function escapeUnicode(content: string): string {
  return content.replace(
    /[\u0080-\uffff]/g,
    (char) => `\\U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
  );
}

export function exportDxfWithWarnings(
  data: ProjectData,
  storyId: string,
  options: DxfExportOptions = {},
): { content: string; warnings: string[] } {
  const warnings: string[] = [];
  return { content: exportDxf(data, storyId, warnings, options), warnings };
}

function renderMemberDxf(lines: EntitiesManager, m: Member, sections: Section[]): boolean {
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
  lines: EntitiesManager,
  layer: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  metadata?: string,
) {
  const entity = lines.addLine(point3d(fmt(x1), fmt(y1), 0), point3d(fmt(x2), fmt(y2), 0), {
    layerName: layer,
  });
  if (metadata) addMetadata(entity, metadata);
}

/** Registered, chunked XDATA survives CAD saves, unlike DXF comments. */
function addMetadata(entity: Pick<ReturnType<DxfWriter['addLine']>, 'addXData'>, metadata: string) {
  const xdata = entity.addXData('SIMPLECAD');
  // @tarikjabiri/dxf 2.8.9's stringChunksSplit drops the last character of
  // each chunk. Emit these ASCII chunks directly through the public Dxfier.
  xdata.dxfy = (dx) => {
    dx.push(1001, 'SIMPLECAD');
    for (let offset = 0; offset < metadata.length; offset += 250) {
      dx.push(1000, metadata.slice(offset, offset + 250));
    }
  };
}

function encodeMetadata(kind: string, value: unknown): string {
  return `SIMPLECAD_${kind}:${encodeURIComponent(JSON.stringify(value))}`;
}

function addLwPolyline(
  lines: EntitiesManager,
  layer: string,
  points: number[][],
  closed: boolean,
  metadata?: string,
) {
  const entity = lines.addLWPolyline(
    points.map(([x, y]) => ({ point: { x: fmt(x), y: fmt(y) } })),
    { layerName: layer, flags: closed ? 1 : 0 },
  );
  if (metadata) addMetadata(entity, metadata);
}

function addText(
  lines: EntitiesManager,
  layer: string,
  x: number,
  y: number,
  height: number,
  text: string,
  rotation?: number,
) {
  lines.addText(point3d(fmt(x), fmt(y), 0), fmt(height), text.replace(/\r?\n/g, ' '), {
    layerName: layer,
    rotation,
  });
}

function addMText(
  lines: EntitiesManager,
  layer: string,
  x: number,
  y: number,
  height: number,
  text: string,
  rotation?: number,
  legacy = false,
) {
  // Escape literal formatting characters before encoding paragraph breaks.
  let encoded = text.replace(/\\/g, '\\\\').replace(/[{}]/g, '\\$&').replace(/\r?\n/g, '\\P');
  if (legacy) encoded = escapeUnicode(encoded);
  lines.addEntity(
    new ChunkedMText(point3d(fmt(x), fmt(y), 0), fmt(height), encoded, {
      layerName: layer,
      rotation,
      width: 0,
    }),
  );
}

/** MTEXT requires group 3 chunks followed by one final group 1. */
class ChunkedMText extends MText {
  protected dxfyChild(dx: Dxfier): void {
    dx.point3d(this.position);
    dx.push(40, this.height);
    dx.push(41, this.width);
    dx.push(71, this.attachmentPoint ?? 1);
    const encoder = new TextEncoder();
    let chunk = '';
    let bytes = 0;
    for (const char of this.value) {
      const size = encoder.encode(char).length;
      if (bytes + size > 250) {
        dx.push(3, chunk);
        chunk = '';
        bytes = 0;
      }
      chunk += char;
      bytes += size;
    }
    dx.push(1, chunk);
    // A direction vector avoids the inconsistent angle-unit descriptions
    // for MTEXT group 50 across CAD implementations.
    if (this.rotation !== undefined) {
      const angle = (this.rotation * Math.PI) / 180;
      dx.push(11, Math.cos(angle));
      dx.push(21, Math.sin(angle));
      dx.push(31, 0);
    }
    dx.textStyle(this.textStyle);
  }
}

function addSpline(lines: EntitiesManager, layer: string, points: { x: number; y: number }[]) {
  // Valid open clamped B-spline. Degree must be lower than control-point count,
  // and DXF requires an explicit knot count/vector.
  const degree = Math.min(3, points.length - 1);
  const knotCount = points.length + degree + 1;
  const interiorCount = knotCount - (degree + 1) * 2;
  const knots = [
    ...Array<number>(degree + 1).fill(0),
    ...Array.from(
      { length: Math.max(interiorCount, 0) },
      (_, index) => (index + 1) / (interiorCount + 1),
    ),
    ...Array<number>(degree + 1).fill(1),
  ];
  lines.addSpline(
    {
      controlPoints: points.map((p) => point3d(fmt(p.x), fmt(p.y), 0)),
      degreeCurve: degree,
      flags: 8,
      knots: knots.map(fmt),
    },
    { layerName: layer, extrusion: point3d(0, 0, 1) },
  );
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
