import type { ProjectData, Member, Section } from '@/domain/structural/types';
import { distance2D, sub2D, normalize2D, perpendicular2D } from '@/domain/geometry/point';

/**
 * Export DXF using manual string generation.
 * Using DXF ASCII format for maximum compatibility.
 */
export function exportDxf(data: ProjectData, storyId: string): string {
  const lines: string[] = [];

  // Header section
  lines.push('0', 'SECTION', '2', 'HEADER');
  lines.push('9', '$ACADVER', '1', 'AC1015'); // AutoCAD 2000
  lines.push('0', 'ENDSEC');

  // Tables section (layers)
  lines.push('0', 'SECTION', '2', 'TABLES');
  lines.push('0', 'TABLE', '2', 'LAYER');

  const layerDefs = [
    { name: 'GRID', color: 3 },      // green
    { name: 'COLUMN', color: 1 },    // red
    { name: 'BEAM', color: 2 },      // yellow
    { name: 'WALL', color: 4 },      // cyan
    { name: 'SLAB', color: 6 },      // magenta
    { name: 'DIMENSION', color: 7 }, // white
    { name: 'ANNOTATION', color: 7 },
    { name: 'CONSTRUCTION', color: 8 }, // gray
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
    addLine(lines, 'GRID', g.position, minY - 2000, g.position, maxY + 2000);
  }
  for (const g of yGrids) {
    addLine(lines, 'GRID', minX - 2000, g.position, maxX + 2000, g.position);
  }

  // Members
  const members = data.members.filter((m) => m.story === storyId);
  for (const m of members) {
    renderMemberDxf(lines, m, data.sections);
  }

  // Dimensions (decomposed to lines + text)
  const dimensions = data.dimensions.filter((d) => d.story === storyId);
  for (const d of dimensions) {
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
      addLine(lines, 'CONSTRUCTION',
        cl.origin.x - cl.direction.x * ext, cl.origin.y - cl.direction.y * ext,
        cl.origin.x + cl.direction.x * ext, cl.origin.y + cl.direction.y * ext);
    } else {
      addLine(lines, 'CONSTRUCTION',
        cl.origin.x, cl.origin.y,
        cl.origin.x + cl.direction.x * ext, cl.origin.y + cl.direction.y * ext);
    }
  }

  lines.push('0', 'ENDSEC');
  lines.push('0', 'EOF');

  return lines.join('\n');
}

function renderMemberDxf(lines: string[], m: Member, sections: Section[]) {
  const sec = sections.find((s) => s.id === m.sectionId);

  switch (m.type) {
    case 'column': {
      const w = sec && 'width' in sec ? sec.width : 600;
      const d = sec && 'depth' in sec ? sec.depth : 600;
      const cx = m.start.x;
      const cy = m.start.y;
      addLwPolyline(lines, 'COLUMN', [
        [cx - w / 2, cy - d / 2],
        [cx + w / 2, cy - d / 2],
        [cx + w / 2, cy + d / 2],
        [cx - w / 2, cy + d / 2],
      ], true);
      break;
    }
    case 'beam': {
      const w = sec && 'width' in sec ? sec.width : 300;
      const dx = m.end.x - m.start.x;
      const dy = m.end.y - m.start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) break;
      const nx = (-dy / len) * (w / 2);
      const ny = (dx / len) * (w / 2);
      addLwPolyline(lines, 'BEAM', [
        [m.start.x + nx, m.start.y + ny],
        [m.end.x + nx, m.end.y + ny],
        [m.end.x - nx, m.end.y - ny],
        [m.start.x - nx, m.start.y - ny],
      ], true);
      break;
    }
    case 'wall': {
      const t = sec && 'thickness' in sec ? sec.thickness : m.thickness;
      const dx = m.end.x - m.start.x;
      const dy = m.end.y - m.start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) break;
      const nx = (-dy / len) * (t / 2);
      const ny = (dx / len) * (t / 2);
      addLwPolyline(lines, 'WALL', [
        [m.start.x + nx, m.start.y + ny],
        [m.end.x + nx, m.end.y + ny],
        [m.end.x - nx, m.end.y - ny],
        [m.start.x - nx, m.start.y - ny],
      ], true);
      break;
    }
    case 'slab': {
      addLwPolyline(
        lines,
        'SLAB',
        m.polygon.map((p) => [p.x, p.y]),
        true,
      );
      break;
    }
  }
}

function addLine(lines: string[], layer: string, x1: number, y1: number, x2: number, y2: number) {
  lines.push('0', 'LINE');
  lines.push('8', layer);
  lines.push('10', String(x1), '20', String(y1), '30', '0');
  lines.push('11', String(x2), '21', String(y2), '31', '0');
}

function addLwPolyline(lines: string[], layer: string, points: number[][], closed: boolean) {
  lines.push('0', 'LWPOLYLINE');
  lines.push('8', layer);
  lines.push('90', String(points.length));
  lines.push('70', closed ? '1' : '0');
  for (const [x, y] of points) {
    lines.push('10', String(x), '20', String(y));
  }
}

function addText(lines: string[], layer: string, x: number, y: number, height: number, text: string, rotation?: number) {
  const sanitized = text.replace(/\r?\n/g, ' ');
  lines.push('0', 'TEXT');
  lines.push('8', layer);
  lines.push('10', String(x), '20', String(y), '30', '0');
  lines.push('40', String(height));
  if (rotation) {
    lines.push('50', String(rotation));
  }
  lines.push('1', sanitized);
}

function addMText(lines: string[], layer: string, x: number, y: number, height: number, text: string, rotation?: number) {
  lines.push('0', 'MTEXT');
  lines.push('8', layer);
  lines.push('10', String(x), '20', String(y), '30', '0');
  lines.push('40', String(height));
  if (rotation) {
    lines.push('50', String(rotation));
  }
  const encoded = text.replace(/\r?\n/g, '\\P');
  lines.push('1', encoded);
}

function addSpline(lines: string[], layer: string, points: { x: number; y: number }[]) {
  // Export as SPLINE entity (degree 3 cubic)
  lines.push('0', 'SPLINE');
  lines.push('8', layer);
  lines.push('70', '8'); // Planar flag
  lines.push('71', '3'); // Degree 3 (cubic)
  lines.push('73', String(points.length)); // Number of control points
  for (const p of points) {
    lines.push('10', String(p.x), '20', String(p.y), '30', '0');
  }
}
