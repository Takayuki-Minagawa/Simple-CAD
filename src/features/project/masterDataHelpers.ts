import type { Material, Section, Sheet, Story, TitleBlockTemplate } from '@/domain/structural/types';

export type SectionKindDraft = Section['kind'];

export interface Labels {
  title: string;
  close: string;
  stories: string;
  addStory: string;
  duplicateStory: string;
  addSheet: string;
  activate: string;
  active: string;
  materials: string;
  sections: string;
  sheets: string;
  id: string;
  name: string;
  elevation: string;
  height: string;
  type: string;
  delete: string;
  inUse: string;
  paperSize: string;
  scale: string;
  template: string;
  projectName: string;
  drawingTitle: string;
  drawnBy: string;
  checkedBy: string;
  issueDate: string;
  revision: string;
  note: string;
  width: string;
  depth: string;
  thickness: string;
  kind: string;
  noSheets: string;
  addMaterial: string;
  addSection: string;
  viewports: string;
  addViewport: string;
  removeViewport: string;
  viewId: string;
  x: string;
  y: string;
}

export const TEMPLATE_OPTIONS: TitleBlockTemplate[] = ['standard', 'compact', 'minimal'];
export const MATERIAL_TYPES: Material['type'][] = ['concrete', 'steel', 'wood', 'other'];
export const SECTION_KIND_OPTIONS: SectionKindDraft[] = ['rc_column_rect', 'rc_beam_rect', 'rc_slab', 'rc_wall'];
export const PAPER_SIZES: Sheet['paperSize'][] = ['A0', 'A1', 'A2', 'A3', 'A4'];

export function getLabels(locale: 'ja' | 'en'): Labels {
  if (locale === 'ja') {
    return {
      title: 'マスタ編集',
      close: '閉じる',
      stories: 'Stories',
      addStory: '階を追加',
      duplicateStory: 'アクティブ階を複製',
      addSheet: 'シート追加',
      activate: '表示',
      active: '編集中',
      materials: 'Materials',
      sections: 'Sections',
      sheets: 'Sheets / Title Block',
      id: 'ID',
      name: '名称',
      elevation: 'EL',
      height: '高さ',
      type: '種別',
      delete: '削除',
      inUse: '使用中',
      paperSize: '用紙',
      scale: '縮尺',
      template: 'テンプレート',
      projectName: '工事名',
      drawingTitle: '図面名',
      drawnBy: '作図',
      checkedBy: '確認',
      issueDate: '日付',
      revision: '改訂',
      note: '備考',
      width: '幅',
      depth: 'せい',
      thickness: '厚さ',
      kind: '区分',
      noSheets: 'シートがありません。アクティブ階から追加してください。',
      addMaterial: '材料追加',
      addSection: '断面追加',
      viewports: 'ビューポート',
      addViewport: 'ビューポート追加',
      removeViewport: '削除',
      viewId: 'ビューID',
      x: 'X',
      y: 'Y',
    };
  }

  return {
    title: 'Masters',
    close: 'Close',
    stories: 'Stories',
    addStory: 'Add Story',
    duplicateStory: 'Duplicate Active Story',
    addSheet: 'Add Sheet',
    activate: 'Activate',
    active: 'Active',
    materials: 'Materials',
    sections: 'Sections',
    sheets: 'Sheets / Title Block',
    id: 'ID',
    name: 'Name',
    elevation: 'Elevation',
    height: 'Height',
    type: 'Type',
    delete: 'Delete',
    inUse: 'In use',
    paperSize: 'Paper',
    scale: 'Scale',
    template: 'Template',
    projectName: 'Project',
    drawingTitle: 'Drawing',
    drawnBy: 'Drawn by',
    checkedBy: 'Checked by',
    issueDate: 'Issue date',
    revision: 'Revision',
    note: 'Note',
    width: 'Width',
    depth: 'Depth',
    thickness: 'Thickness',
    kind: 'Kind',
    noSheets: 'No sheets yet. Add one from the active story.',
    addMaterial: 'Add Material',
    addSection: 'Add Section',
    viewports: 'Viewports',
    addViewport: 'Add Viewport',
    removeViewport: 'Remove',
    viewId: 'View ID',
    x: 'X',
    y: 'Y',
  };
}

export function buildNextStory(source?: Story, existing?: Story[]): Story {
  const stories = existing ?? [];
  if (!source) {
    return { id: '1F', name: '1F', elevation: 0, height: 3000 };
  }

  const match = source.id.match(/^(\d+)F$/i);
  const nextIndex = match ? Number.parseInt(match[1], 10) + 1 : stories.length + 1;
  const nextId = match ? `${nextIndex}F` : `${source.id}-COPY`;
  return {
    id: nextId,
    name: nextId,
    elevation: source.elevation + source.height,
    height: source.height,
  };
}

export function sectionKindLabel(kind: Section['kind']) {
  switch (kind) {
    case 'rc_column_rect':
      return 'RC Column';
    case 'rc_beam_rect':
      return 'RC Beam';
    case 'rc_slab':
      return 'RC Slab';
    case 'rc_wall':
      return 'RC Wall';
  }
}
