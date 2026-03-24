import type { ProjectData, Member, Section } from '@/domain/structural/types';
import { sub2D, normalize2D, perpendicular2D, distance2D } from '@/domain/geometry/point';

const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  A0: { width: 1189, height: 841 },
  A1: { width: 841, height: 594 },
  A2: { width: 594, height: 420 },
  A3: { width: 420, height: 297 },
  A4: { width: 297, height: 210 },
};

export function exportSvg(data: ProjectData, sheetId: string): string {
  const sheet = data.sheets.find((s) => s.id === sheetId);
  if (!sheet) throw new Error(`Sheet "${sheetId}" not found`);

  const paper = PAPER_SIZES[sheet.paperSize] ?? PAPER_SIZES.A3;
  const scaleNum = parseScale(sheet.scale);

  const view = data.views.find((v) => sheet.viewIds.includes(v.id) && v.type === 'plan');
  const storyId = view && 'story' in view ? view.story : data.stories[0]?.id;

  const members = data.members.filter((m) => m.story === storyId);
  const annotations = data.annotations.filter((a) => a.story === storyId);
  const dimensions = data.dimensions.filter((d) => d.story === storyId);

  // View center and dimensions (in mm)
  const viewCenter = view && 'center' in view ? view.center : { x: 4000, y: 3000 };

  // SVG viewBox in paper mm
  const svgLines: string[] = [];
  svgLines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${paper.width}mm" height="${paper.height}mm" viewBox="0 0 ${paper.width} ${paper.height}">`);

  // Sheet frame
  svgLines.push(`<g class="sheet-frame">`);
  svgLines.push(`  <rect x="10" y="10" width="${paper.width - 20}" height="${paper.height - 20}" fill="none" stroke="#000" stroke-width="0.5"/>`);
  svgLines.push(`</g>`);

  // Title block
  svgLines.push(`<g class="title-block">`);
  svgLines.push(`  <rect x="${paper.width - 180}" y="${paper.height - 40}" width="170" height="30" fill="none" stroke="#000" stroke-width="0.3"/>`);
  svgLines.push(`  <text x="${paper.width - 175}" y="${paper.height - 22}" font-size="5" font-family="sans-serif">${sheet.name}</text>`);
  svgLines.push(`  <text x="${paper.width - 175}" y="${paper.height - 14}" font-size="3.5" font-family="sans-serif">Scale: ${sheet.scale}</text>`);
  svgLines.push(`</g>`);

  // Content area - transform world coords to paper coords
  const margin = 30;
  const drawAreaW = paper.width - 2 * margin;
  const drawAreaH = paper.height - 2 * margin - 40; // reserve title block space
  const scale = 1 / scaleNum;

  const offsetX = margin + drawAreaW / 2 - viewCenter.x * scale;
  const offsetY = margin + drawAreaH / 2 + viewCenter.y * scale;

  svgLines.push(`<g class="view-content" transform="translate(${offsetX}, ${offsetY}) scale(${scale}, ${-scale})">`);

  // Grids
  svgLines.push(`  <g class="layer-grid">`);
  for (const g of data.grids) {
    if (g.axis === 'X') {
      svgLines.push(`    <line x1="${g.position}" y1="${-10000}" x2="${g.position}" y2="${20000}" stroke="#27ae60" stroke-width="${20}" stroke-dasharray="100 100" opacity="0.3"/>`);
    } else {
      svgLines.push(`    <line x1="${-10000}" y1="${g.position}" x2="${20000}" y2="${g.position}" stroke="#27ae60" stroke-width="${20}" stroke-dasharray="100 100" opacity="0.3"/>`);
    }
  }
  svgLines.push(`  </g>`);

  // Members
  for (const m of members) {
    svgLines.push(renderMemberSvg(m, data.sections));
  }

  // Dimensions
  for (const d of dimensions) {
    svgLines.push(renderDimensionSvg(d));
  }

  // Annotations
  for (const a of annotations) {
    const fs = a.fontSize ?? 300;
    svgLines.push(`  <text class="layer-annotation" x="${a.x}" y="${a.y}" font-size="${fs}" fill="#34495e" transform="translate(0,0) scale(1,-1) translate(0,${-2 * a.y})">${escapeXml(a.text)}</text>`);
  }

  svgLines.push(`</g>`);
  svgLines.push(`</svg>`);

  return svgLines.join('\n');
}

function renderMemberSvg(m: Member, sections: Section[]): string {
  const sec = sections.find((s) => s.id === m.sectionId);

  switch (m.type) {
    case 'column': {
      const w = sec && 'width' in sec ? sec.width : 600;
      const d = sec && 'depth' in sec ? sec.depth : 600;
      return `  <rect class="layer-member-column" x="${m.start.x - w / 2}" y="${m.start.y - d / 2}" width="${w}" height="${d}" fill="rgba(231,76,60,0.3)" stroke="#e74c3c" stroke-width="20"/>`;
    }
    case 'beam': {
      const w = sec && 'width' in sec ? sec.width : 300;
      const dx = m.end.x - m.start.x;
      const dy = m.end.y - m.start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return '';
      const nx = (-dy / len) * (w / 2);
      const ny = (dx / len) * (w / 2);
      const pts = `${m.start.x + nx},${m.start.y + ny} ${m.end.x + nx},${m.end.y + ny} ${m.end.x - nx},${m.end.y - ny} ${m.start.x - nx},${m.start.y - ny}`;
      return `  <polygon class="layer-member-beam" points="${pts}" fill="rgba(243,156,18,0.2)" stroke="#f39c12" stroke-width="20"/>`;
    }
    case 'wall': {
      const t = m.thickness;
      const dx = m.end.x - m.start.x;
      const dy = m.end.y - m.start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return '';
      const nx = (-dy / len) * (t / 2);
      const ny = (dx / len) * (t / 2);
      const pts = `${m.start.x + nx},${m.start.y + ny} ${m.end.x + nx},${m.end.y + ny} ${m.end.x - nx},${m.end.y - ny} ${m.start.x - nx},${m.start.y - ny}`;
      return `  <polygon class="layer-member-wall" points="${pts}" fill="rgba(0,188,212,0.2)" stroke="#00bcd4" stroke-width="20"/>`;
    }
    case 'slab': {
      const pts = m.polygon.map((p) => `${p.x},${p.y}`).join(' ');
      return `  <polygon class="layer-member-slab" points="${pts}" fill="rgba(155,89,182,0.1)" stroke="#9b59b6" stroke-width="20" stroke-dasharray="200 100"/>`;
    }
  }
}

function renderDimensionSvg(d: { start: { x: number; y: number }; end: { x: number; y: number }; offset: number; text?: string }): string {
  const dir = normalize2D(sub2D(d.end, d.start));
  const perp = perpendicular2D(dir);
  const s = { x: d.start.x + perp.x * d.offset, y: d.start.y + perp.y * d.offset };
  const e = { x: d.end.x + perp.x * d.offset, y: d.end.y + perp.y * d.offset };
  const length = distance2D(d.start, d.end);
  const text = d.text ?? length.toFixed(0);
  const mid = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };

  return [
    `  <g class="layer-dimension">`,
    `    <line x1="${s.x}" y1="${s.y}" x2="${e.x}" y2="${e.y}" stroke="#7f8c8d" stroke-width="15"/>`,
    `    <circle cx="${s.x}" cy="${s.y}" r="50" fill="#7f8c8d"/>`,
    `    <circle cx="${e.x}" cy="${e.y}" r="50" fill="#7f8c8d"/>`,
    `    <text x="${mid.x}" y="${mid.y}" text-anchor="middle" dominant-baseline="central" font-size="250" fill="#7f8c8d" transform="translate(0,0) scale(1,-1) translate(0,${-2 * mid.y})">${text}</text>`,
    `  </g>`,
  ].join('\n');
}

function parseScale(scale: string): number {
  const match = scale.match(/^1:(\d+)$/);
  return match ? parseInt(match[1], 10) : 100;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
