import type { ProjectData, Member, Section, Sheet, TitleBlockTemplate, TextAlign } from '@/domain/structural/types';
import { sub2D, normalize2D, perpendicular2D, distance2D } from '@/domain/geometry/point';
import { lineTypeToDashArray } from '@/domain/rendering/lineStyle';

const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  A0: { width: 1189, height: 841 },
  A1: { width: 841, height: 594 },
  A2: { width: 594, height: 420 },
  A3: { width: 420, height: 297 },
  A4: { width: 297, height: 210 },
};

function textAlignToAnchor(align: TextAlign | undefined): string {
  switch (align) {
    case 'center': return 'middle';
    case 'right': return 'end';
    default: return 'start';
  }
}

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
  svgLines.push(renderTitleBlockSvg(sheet, data.project.name, paper.width, paper.height));

  // Content area - transform world coords to paper coords
  const titleBlockSpace = getTitleBlockReservedHeight(sheet.titleBlockTemplate ?? 'standard');
  const margin = 30;
  const drawAreaW = paper.width - 2 * margin;
  const drawAreaH = paper.height - 2 * margin - titleBlockSpace;
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
    // Spline annotation
    if (a.type === 'spline' && a.points && a.points.length >= 2) {
      const pathD = catmullRomToSvgPath(a.points);
      const strokeColor = a.color ?? '#34495e';
      svgLines.push(`  <path class="layer-annotation" d="${pathD}" fill="none" stroke="${escapeXml(strokeColor)}" stroke-width="20"/>`);
      continue;
    }

    const fs = a.fontSize ?? 300;
    const fillColor = a.color ?? '#34495e';
    const anchor = textAlignToAnchor(a.textAlign);
    const rotation = a.rotation ?? 0;
    const rotateAttr = rotation !== 0 ? ` rotate(${-rotation}, ${a.x}, ${-a.y})` : '';
    const transform = `translate(0,0) scale(1,-1) translate(0,${-2 * a.y})${rotateAttr}`;
    const lines = a.text.split('\n');

    const fwAttr = a.fontWeight === 'bold' ? ' font-weight="bold"' : '';
    const fsAttr = a.fontStyle === 'italic' ? ' font-style="italic"' : '';
    const tdAttr = a.textDecoration === 'underline' ? ' text-decoration="underline"' : '';
    const ffAttr = a.fontFamily ? ` font-family="${escapeXml(a.fontFamily)}"` : '';
    const styleAttrs = `${fwAttr}${fsAttr}${tdAttr}${ffAttr}`;

    if (lines.length <= 1) {
      svgLines.push(`  <text class="layer-annotation" x="${a.x}" y="${a.y}" font-size="${fs}" fill="${escapeXml(fillColor)}" text-anchor="${anchor}" transform="${transform}"${styleAttrs}>${escapeXml(a.text)}</text>`);
    } else {
      svgLines.push(`  <text class="layer-annotation" x="${a.x}" y="${a.y}" font-size="${fs}" fill="${escapeXml(fillColor)}" text-anchor="${anchor}" transform="${transform}"${styleAttrs}>`);
      for (let i = 0; i < lines.length; i++) {
        const dy = i === 0 ? 0 : fs * 1.2;
        svgLines.push(`    <tspan x="${a.x}" dy="${dy}">${escapeXml(lines[i])}</tspan>`);
      }
      svgLines.push(`  </text>`);
    }
  }

  svgLines.push(`</g>`);
  svgLines.push(`</svg>`);

  return svgLines.join('\n');
}

function renderMemberSvg(m: Member, sections: Section[]): string {
  const sec = sections.find((s) => s.id === m.sectionId);
  const lw = m.lineWeight ?? 20;
  const dash = lineTypeToDashArray(m.lineType);
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';

  switch (m.type) {
    case 'column': {
      const w = sec && 'width' in sec ? sec.width : 600;
      const d = sec && 'depth' in sec ? sec.depth : 600;
      const strokeColor = m.color ?? '#e74c3c';
      return `  <rect class="layer-member-column" x="${m.start.x - w / 2}" y="${m.start.y - d / 2}" width="${w}" height="${d}" fill="rgba(231,76,60,0.3)" stroke="${strokeColor}" stroke-width="${lw}"${dashAttr}/>`;
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
      const strokeColor = m.color ?? '#f39c12';
      return `  <polygon class="layer-member-beam" points="${pts}" fill="rgba(243,156,18,0.2)" stroke="${strokeColor}" stroke-width="${lw}"${dashAttr}/>`;
    }
    case 'wall': {
      const t = sec && 'thickness' in sec ? sec.thickness : m.thickness;
      const dx = m.end.x - m.start.x;
      const dy = m.end.y - m.start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return '';
      const nx = (-dy / len) * (t / 2);
      const ny = (dx / len) * (t / 2);
      const pts = `${m.start.x + nx},${m.start.y + ny} ${m.end.x + nx},${m.end.y + ny} ${m.end.x - nx},${m.end.y - ny} ${m.start.x - nx},${m.start.y - ny}`;
      const strokeColor = m.color ?? '#00bcd4';
      return `  <polygon class="layer-member-wall" points="${pts}" fill="rgba(0,188,212,0.2)" stroke="${strokeColor}" stroke-width="${lw}"${dashAttr}/>`;
    }
    case 'slab': {
      const pts = m.polygon.map((p) => `${p.x},${p.y}`).join(' ');
      const strokeColor = m.color ?? '#9b59b6';
      const slabDash = dash ?? '200 100';
      const fillColor = m.fillColor ?? 'rgba(155,89,182,0.1)';
      const opacityAttr = m.fillOpacity !== undefined ? ` fill-opacity="${m.fillOpacity}"` : '';
      return `  <polygon class="layer-member-slab" points="${pts}" fill="${fillColor}"${opacityAttr} stroke="${strokeColor}" stroke-width="${lw}" stroke-dasharray="${slabDash}"/>`;
    }
  }
}

function renderDimensionSvg(d: { start: { x: number; y: number }; end: { x: number; y: number }; offset: number; text?: string; color?: string; lineWeight?: number; lineType?: import('@/domain/structural/types').LineType }): string {
  const dir = normalize2D(sub2D(d.end, d.start));
  const perp = perpendicular2D(dir);
  const s = { x: d.start.x + perp.x * d.offset, y: d.start.y + perp.y * d.offset };
  const e = { x: d.end.x + perp.x * d.offset, y: d.end.y + perp.y * d.offset };
  const length = distance2D(d.start, d.end);
  const text = d.text ?? length.toFixed(0);
  const mid = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
  const color = d.color ?? '#7f8c8d';
  const lw = d.lineWeight ?? 15;
  const dash = lineTypeToDashArray(d.lineType);
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';

  const textSize = 250;
  const arrowLen = textSize * 0.4;
  const arrowHalf = arrowLen * 0.35;

  const startArrow = `${s.x},${s.y} ${s.x + dir.x * arrowLen + perp.x * arrowHalf},${s.y + dir.y * arrowLen + perp.y * arrowHalf} ${s.x + dir.x * arrowLen - perp.x * arrowHalf},${s.y + dir.y * arrowLen - perp.y * arrowHalf}`;
  const endArrow = `${e.x},${e.y} ${e.x - dir.x * arrowLen + perp.x * arrowHalf},${e.y - dir.y * arrowLen + perp.y * arrowHalf} ${e.x - dir.x * arrowLen - perp.x * arrowHalf},${e.y - dir.y * arrowLen - perp.y * arrowHalf}`;

  return [
    `  <g class="layer-dimension">`,
    `    <line x1="${s.x}" y1="${s.y}" x2="${e.x}" y2="${e.y}" stroke="${color}" stroke-width="${lw}"${dashAttr}/>`,
    `    <polygon points="${startArrow}" fill="${color}"/>`,
    `    <polygon points="${endArrow}" fill="${color}"/>`,
    `    <text x="${mid.x}" y="${mid.y}" text-anchor="middle" dominant-baseline="central" font-size="${textSize}" fill="${color}" transform="translate(0,0) scale(1,-1) translate(0,${-2 * mid.y})">${text}</text>`,
    `  </g>`,
  ].join('\n');
}

function parseScale(scale: string): number {
  const match = scale.match(/^1:(\d+)$/);
  return match ? parseInt(match[1], 10) : 100;
}

function getTitleBlockReservedHeight(template: TitleBlockTemplate): number {
  switch (template) {
    case 'compact':
      return 34;
    case 'minimal':
      return 22;
    default:
      return 44;
  }
}

function renderTitleBlockSvg(sheet: Sheet, projectName: string, paperWidth: number, paperHeight: number): string {
  const template = sheet.titleBlockTemplate ?? 'standard';
  const titleBlock = {
    projectName: sheet.titleBlock?.projectName ?? projectName,
    drawingTitle: sheet.titleBlock?.drawingTitle ?? sheet.name,
    drawnBy: sheet.titleBlock?.drawnBy ?? '',
    checkedBy: sheet.titleBlock?.checkedBy ?? '',
    issueDate: sheet.titleBlock?.issueDate ?? '',
    revision: sheet.titleBlock?.revision ?? '',
    note: sheet.titleBlock?.note ?? '',
  };

  switch (template) {
    case 'compact':
      return [
        `<g class="title-block compact">`,
        `  <rect x="10" y="${paperHeight - 24}" width="${paperWidth - 20}" height="14" fill="none" stroke="#000" stroke-width="0.3"/>`,
        `  <line x1="${paperWidth - 150}" y1="${paperHeight - 24}" x2="${paperWidth - 150}" y2="${paperHeight - 10}" stroke="#000" stroke-width="0.3"/>`,
        `  <line x1="${paperWidth - 95}" y1="${paperHeight - 24}" x2="${paperWidth - 95}" y2="${paperHeight - 10}" stroke="#000" stroke-width="0.3"/>`,
        `  <line x1="${paperWidth - 50}" y1="${paperHeight - 24}" x2="${paperWidth - 50}" y2="${paperHeight - 10}" stroke="#000" stroke-width="0.3"/>`,
        `  <text x="16" y="${paperHeight - 15}" font-size="5" font-family="sans-serif">${escapeXml(titleBlock.projectName)}</text>`,
        `  <text x="${paperWidth - 144}" y="${paperHeight - 15}" font-size="4.2" font-family="sans-serif">${escapeXml(titleBlock.drawingTitle)}</text>`,
        `  <text x="${paperWidth - 89}" y="${paperHeight - 15}" font-size="3.2" font-family="sans-serif">Scale ${escapeXml(sheet.scale)}</text>`,
        `  <text x="${paperWidth - 44}" y="${paperHeight - 15}" font-size="3.2" font-family="sans-serif">Rev ${escapeXml(titleBlock.revision)}</text>`,
        titleBlock.note
          ? `  <text x="16" y="${paperHeight - 11}" font-size="2.8" font-family="sans-serif">${escapeXml(titleBlock.note)}</text>`
          : '',
        `</g>`,
      ].filter(Boolean).join('\n');
    case 'minimal':
      return [
        `<g class="title-block minimal">`,
        `  <text x="12" y="${paperHeight - 12}" font-size="5" font-family="sans-serif">${escapeXml(titleBlock.drawingTitle)}</text>`,
        `  <text x="${paperWidth - 70}" y="${paperHeight - 12}" font-size="3.5" font-family="sans-serif">${escapeXml(sheet.scale)}</text>`,
        `</g>`,
      ].join('\n');
    default:
      return [
        `<g class="title-block standard">`,
        `  <rect x="${paperWidth - 190}" y="${paperHeight - 44}" width="180" height="34" fill="none" stroke="#000" stroke-width="0.3"/>`,
        `  <line x1="${paperWidth - 95}" y1="${paperHeight - 44}" x2="${paperWidth - 95}" y2="${paperHeight - 10}" stroke="#000" stroke-width="0.3"/>`,
        `  <line x1="${paperWidth - 190}" y1="${paperHeight - 24}" x2="${paperWidth - 10}" y2="${paperHeight - 24}" stroke="#000" stroke-width="0.3"/>`,
        `  <line x1="${paperWidth - 140}" y1="${paperHeight - 24}" x2="${paperWidth - 140}" y2="${paperHeight - 10}" stroke="#000" stroke-width="0.3"/>`,
        `  <line x1="${paperWidth - 60}" y1="${paperHeight - 24}" x2="${paperWidth - 60}" y2="${paperHeight - 10}" stroke="#000" stroke-width="0.3"/>`,
        `  <text x="${paperWidth - 184}" y="${paperHeight - 33}" font-size="3" font-family="sans-serif">${escapeXml(titleBlock.projectName)}</text>`,
        `  <text x="${paperWidth - 184}" y="${paperHeight - 27}" font-size="5" font-family="sans-serif">${escapeXml(titleBlock.drawingTitle)}</text>`,
        `  <text x="${paperWidth - 184}" y="${paperHeight - 17}" font-size="3" font-family="sans-serif">Drawn ${escapeXml(titleBlock.drawnBy)}</text>`,
        `  <text x="${paperWidth - 134}" y="${paperHeight - 17}" font-size="3" font-family="sans-serif">Checked ${escapeXml(titleBlock.checkedBy)}</text>`,
        `  <text x="${paperWidth - 89}" y="${paperHeight - 17}" font-size="3" font-family="sans-serif">Date ${escapeXml(titleBlock.issueDate)}</text>`,
        `  <text x="${paperWidth - 54}" y="${paperHeight - 17}" font-size="3" font-family="sans-serif">Scale ${escapeXml(sheet.scale)}</text>`,
        `  <text x="${paperWidth - 184}" y="${paperHeight - 12}" font-size="3" font-family="sans-serif">Sheet ${escapeXml(sheet.id)}</text>`,
        `  <text x="${paperWidth - 134}" y="${paperHeight - 12}" font-size="3" font-family="sans-serif">Rev ${escapeXml(titleBlock.revision)}</text>`,
        titleBlock.note
          ? `  <text x="${paperWidth - 89}" y="${paperHeight - 12}" font-size="3" font-family="sans-serif">${escapeXml(titleBlock.note)}</text>`
          : '',
        `</g>`,
      ].filter(Boolean).join('\n');
  }
}

function catmullRomToSvgPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;
  }
  const d: string[] = [`M ${pts[0].x},${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }
  return d.join(' ');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
