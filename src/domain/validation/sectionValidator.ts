import type { ProjectData, Section } from '@/domain/structural/types';
import type { ValidationError, ValidationResult } from './types';

const MIN_RC_COLUMN_WIDTH = 200;
const MIN_RC_BEAM_WIDTH = 150;
const MIN_RC_BEAM_DEPTH = 200;
const MIN_RC_SLAB_OR_WALL_THICKNESS = 50;
const MIN_COLUMN_BEAM_COVER = 30;
const MIN_SLAB_WALL_COVER = 20;

/**
 * Engineering plausibility checks. Code-dependent minima remain warnings,
 * while geometrically impossible plate/tube proportions are hard errors.
 */
export function validateSections(data: ProjectData): ValidationResult {
  const errors: ValidationError[] = [];
  for (const section of data.sections) validateSection(section, errors);
  return { ok: errors.every((issue) => issue.level !== 'error'), errors };
}

function validateSection(section: Section, errors: ValidationError[]) {
  const path = `/sections/${section.id}`;
  const warn = (message: string) => errors.push({ level: 'warning', message, path });
  const error = (message: string) => errors.push({ level: 'error', message, path });

  switch (section.kind) {
    case 'rc_column_rect':
      if (section.width < MIN_RC_COLUMN_WIDTH || section.depth < MIN_RC_COLUMN_WIDTH) {
        warn(`Section "${section.id}": RC柱の幅・せいが ${MIN_RC_COLUMN_WIDTH}mm 未満です`);
      }
      checkCover(section, MIN_COLUMN_BEAM_COVER, warn);
      break;
    case 'rc_beam_rect':
      if (section.width < MIN_RC_BEAM_WIDTH || section.depth < MIN_RC_BEAM_DEPTH) {
        warn(`Section "${section.id}": RC梁は幅 ${MIN_RC_BEAM_WIDTH}mm、せい ${MIN_RC_BEAM_DEPTH}mm を目安に確認してください`);
      }
      checkCover(section, MIN_COLUMN_BEAM_COVER, warn);
      break;
    case 'rc_slab':
    case 'rc_wall':
      if (section.thickness < MIN_RC_SLAB_OR_WALL_THICKNESS) {
        warn(`Section "${section.id}": RC厚さが ${MIN_RC_SLAB_OR_WALL_THICKNESS}mm 未満です`);
      }
      checkCover(section, MIN_SLAB_WALL_COVER, warn);
      break;
    case 's_column_h':
    case 's_beam_h':
      if (section.width < 50 || section.depth < 50) {
        warn(`Section "${section.id}": H形鋼の幅・せいが 50mm 未満です`);
      }
      if (section.tw === undefined || section.tf === undefined) {
        warn(`Section "${section.id}": H形鋼の tw/tf が未設定です`);
      }
      if (section.tw !== undefined && section.tw >= section.width) {
        error(`Section "${section.id}": H形鋼の tw は幅 B より小さくする必要があります`);
      }
      if (section.tf !== undefined && section.tf * 2 >= section.depth) {
        error(`Section "${section.id}": H形鋼の 2tf はせい H より小さくする必要があります`);
      }
      break;
    case 's_pipe':
      if (section.diameter < 20 || section.thickness < 1) {
        warn(`Section "${section.id}": 鋼管の径または厚さが極端に小さい値です`);
      }
      if (section.thickness * 2 >= section.diameter) {
        error(`Section "${section.id}": 鋼管の 2t は外径 D より小さくする必要があります`);
      }
      break;
  }
}

function checkCover(
  section: Extract<Section, { kind: 'rc_column_rect' | 'rc_beam_rect' | 'rc_slab' | 'rc_wall' }>,
  minimum: number,
  warn: (message: string) => void,
) {
  if (section.cover !== undefined && section.cover < minimum) {
    warn(`Section "${section.id}": かぶり ${section.cover}mm が確認目安 ${minimum}mm 未満です`);
  }
}
