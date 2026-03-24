import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import type { ProjectData } from '@/domain/structural/types';
import { exportSvg } from './svgExport';

const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  A0: { width: 1189, height: 841 },
  A1: { width: 841, height: 594 },
  A2: { width: 594, height: 420 },
  A3: { width: 420, height: 297 },
  A4: { width: 297, height: 210 },
};

export async function exportPdf(data: ProjectData, sheetId: string): Promise<Blob> {
  const sheet = data.sheets.find((s) => s.id === sheetId);
  if (!sheet) throw new Error(`Sheet "${sheetId}" not found`);

  const paper = PAPER_SIZES[sheet.paperSize] ?? PAPER_SIZES.A3;
  const isLandscape = paper.width > paper.height;

  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [paper.width, paper.height],
  });

  // Generate SVG
  const svgString = exportSvg(data, sheetId);

  // Parse SVG to DOM element
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgElement = svgDoc.documentElement;

  // Render SVG to PDF
  await (pdf as unknown as { svg: (el: Element, opts: Record<string, unknown>) => Promise<void> }).svg(svgElement, {
    x: 0,
    y: 0,
    width: paper.width,
    height: paper.height,
  });

  return pdf.output('blob');
}
