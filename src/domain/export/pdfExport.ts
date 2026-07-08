import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import type { ProjectData } from '@/domain/structural/types';
import { getPaperDimensions } from '@/domain/drawing/paper';
import { exportSvg } from './svgExport';

export async function exportPdf(data: ProjectData, sheetIds: string | string[]): Promise<Blob> {
  const targetSheetIds = Array.isArray(sheetIds) ? sheetIds : [sheetIds];
  if (targetSheetIds.length === 0) throw new Error('No sheets selected');

  const sheets = targetSheetIds.map((sheetId) => {
    const sheet = data.sheets.find((item) => item.id === sheetId);
    if (!sheet) throw new Error(`Sheet "${sheetId}" not found`);
    return sheet;
  });

  const firstPaper = getPaperDimensions(sheets[0].paperSize);
  const pdf = new jsPDF({
    orientation: firstPaper.width > firstPaper.height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [firstPaper.width, firstPaper.height],
  });

  for (let index = 0; index < sheets.length; index++) {
    const sheet = sheets[index];
    const paper = getPaperDimensions(sheet.paperSize);
    const orientation = paper.width > paper.height ? 'landscape' : 'portrait';
    if (index > 0) {
      pdf.addPage([paper.width, paper.height], orientation);
    }

    const svgString = exportSvg(data, sheet.id);
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;

    await (
      pdf as unknown as { svg: (el: Element, opts: Record<string, unknown>) => Promise<void> }
    ).svg(svgElement, {
      x: 0,
      y: 0,
      width: paper.width,
      height: paper.height,
    });
  }

  return pdf.output('blob');
}
