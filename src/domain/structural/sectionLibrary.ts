import type { SteelBeamHSection, SteelColumnHSection } from './types';

export interface HSectionLibraryEntry {
  id: string;
  designation: string;
  depth: number;
  width: number;
  tw: number;
  tf: number;
}

/**
 * Frequently used JIS rolled H-section dimensions (mm). This is a geometry
 * library, not a strength catalogue: grade-dependent capacities still belong
 * to the selected material and the downstream structural-analysis system.
 */
export const JIS_H_SECTION_LIBRARY: readonly HSectionLibraryEntry[] = [
  { id: 'H100x100x6x8', designation: 'H-100×100×6×8', depth: 100, width: 100, tw: 6, tf: 8 },
  { id: 'H150x150x7x10', designation: 'H-150×150×7×10', depth: 150, width: 150, tw: 7, tf: 10 },
  { id: 'H200x100x5_5x8', designation: 'H-200×100×5.5×8', depth: 200, width: 100, tw: 5.5, tf: 8 },
  { id: 'H200x200x8x12', designation: 'H-200×200×8×12', depth: 200, width: 200, tw: 8, tf: 12 },
  { id: 'H250x125x6x9', designation: 'H-250×125×6×9', depth: 250, width: 125, tw: 6, tf: 9 },
  { id: 'H300x150x6_5x9', designation: 'H-300×150×6.5×9', depth: 300, width: 150, tw: 6.5, tf: 9 },
  { id: 'H300x300x10x15', designation: 'H-300×300×10×15', depth: 300, width: 300, tw: 10, tf: 15 },
  { id: 'H350x175x7x11', designation: 'H-350×175×7×11', depth: 350, width: 175, tw: 7, tf: 11 },
  { id: 'H400x200x8x13', designation: 'H-400×200×8×13', depth: 400, width: 200, tw: 8, tf: 13 },
  { id: 'H400x400x13x21', designation: 'H-400×400×13×21', depth: 400, width: 400, tw: 13, tf: 21 },
  { id: 'H450x200x9x14', designation: 'H-450×200×9×14', depth: 450, width: 200, tw: 9, tf: 14 },
  { id: 'H500x200x10x16', designation: 'H-500×200×10×16', depth: 500, width: 200, tw: 10, tf: 16 },
  { id: 'H588x300x12x20', designation: 'H-588×300×12×20', depth: 588, width: 300, tw: 12, tf: 20 },
  { id: 'H600x200x11x17', designation: 'H-600×200×11×17', depth: 600, width: 200, tw: 11, tf: 17 },
  { id: 'H700x300x13x24', designation: 'H-700×300×13×24', depth: 700, width: 300, tw: 13, tf: 24 },
] as const;

export function instantiateHSection(
  entry: HSectionLibraryEntry,
  kind: 's_column_h' | 's_beam_h',
  id: string,
): SteelColumnHSection | SteelBeamHSection {
  return {
    id,
    kind,
    width: entry.width,
    depth: entry.depth,
    tw: entry.tw,
    tf: entry.tf,
  };
}

export function uniqueHSectionId(
  entry: HSectionLibraryEntry,
  kind: 's_column_h' | 's_beam_h',
  existingIds: Iterable<string>,
): string {
  const used = new Set(existingIds);
  const prefix = kind === 's_column_h' ? 'SEC-C' : 'SEC-B';
  const base = `${prefix}-${entry.id}`;
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
