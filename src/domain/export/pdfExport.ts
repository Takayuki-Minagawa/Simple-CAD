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

export async function exportPdf(data: ProjectData, sheetIds: string | string[]): Promise<Blob> {
  const targetSheetIds = Array.isArray(sheetIds) ? sheetIds : [sheetIds];
  if (targetSheetIds.length === 0) throw new Error('No sheets selected');

  const sheets = targetSheetIds.map((sheetId) => {
    const sheet = data.sheets.find((item) => item.id === sheetId);
    if (!sheet) throw new Error(`Sheet "${sheetId}" not found`);
    return sheet;
  });

  const firstPaper = PAPER_SIZES[sheets[0].paperSize] ?? PAPER_SIZES.A3;
  const pdf = new jsPDF({
    orientation: firstPaper.width > firstPaper.height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [firstPaper.width, firstPaper.height],
  });

  for (let index = 0; index < sheets.length; index++) {
    const sheet = sheets[index];
    const paper = PAPER_SIZES[sheet.paperSize] ?? PAPER_SIZES.A3;
    const orientation = paper.width > paper.height ? 'landscape' : 'portrait';
    if (index > 0) {
      pdf.addPage([paper.width, paper.height], orientation);
    }

    const svgString = exportSvg(data, sheet.id);
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;

    await (pdf as unknown as { svg: (el: Element, opts: Record<string, unknown>) => Promise<void> }).svg(svgElement, {
      x: 0,
      y: 0,
      width: paper.width,
      height: paper.height,
    });
  }

  return pdf.output('blob');
}
