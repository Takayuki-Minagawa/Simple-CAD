import type { PaperSize, TitleBlockTemplate } from '@/domain/structural/types';

export interface PaperDimensions {
  width: number;
  height: number;
}

export const PAPER_SIZES: Record<PaperSize, PaperDimensions> = {
  A0: { width: 1189, height: 841 },
  A1: { width: 841, height: 594 },
  A2: { width: 594, height: 420 },
  A3: { width: 420, height: 297 },
  A4: { width: 297, height: 210 },
};

export function getPaperDimensions(paperSize: PaperSize): PaperDimensions {
  return PAPER_SIZES[paperSize] ?? PAPER_SIZES.A3;
}

export function parseDrawingScale(scale: string): number {
  const match = scale.match(/^1:(\d+)$/);
  const parsed = match ? Number.parseInt(match[1], 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

export function getTitleBlockReservedHeight(template: TitleBlockTemplate): number {
  switch (template) {
    case 'compact':
      return 34;
    case 'minimal':
      return 22;
    default:
      return 44;
  }
}
