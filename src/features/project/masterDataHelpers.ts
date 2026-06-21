import type { Grid, LoadCase, Material, Section, Sheet, Story, TitleBlockTemplate } from '@/domain/structural/types';

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
  // ── Material strength props (2-2) ──
  elasticModulus: string;
  unitWeight: string;
  fc: string;
  steelF: string;
  fy: string;
  preset: string;
  applyPreset: string;
  // ── Section library (2-3) ──
  diameter: string;
  tw: string;
  tf: string;
  cover: string;
  mainDiameter: string;
  mainCount: string;
  hoopDiameter: string;
  hoopSpacing: string;
  rebar: string;
  // ── Story loads (2-5) ──
  deadLoad: string;
  liveLoad: string;
  elChainMode: string;
  // ── Grids (2-1) ──
  grids: string;
  addGrid: string;
  axis: string;
  position: string;
  // ── Load cases (2-7) ──
  loadCases: string;
  addLoadCase: string;
  factor: string;
}

export const TEMPLATE_OPTIONS: TitleBlockTemplate[] = ['standard', 'compact', 'minimal'];
export const MATERIAL_TYPES: Material['type'][] = ['concrete', 'steel', 'wood', 'other'];
export const SECTION_KIND_OPTIONS: SectionKindDraft[] = [
  'rc_column_rect',
  'rc_beam_rect',
  'rc_slab',
  'rc_wall',
  's_column_h',
  's_beam_h',
  's_pipe',
];
export const LOAD_CASE_TYPES: LoadCase['type'][] = ['dead', 'live', 'snow', 'wind', 'seismic', 'other'];
export const GRID_AXES: Grid['axis'][] = ['X', 'Y'];

/** Section kinds that carry RC cover + rebar (optional reinforcement inputs). */
export function sectionHasRebar(kind: Section['kind']): boolean {
  return kind === 'rc_column_rect' || kind === 'rc_beam_rect';
}

/** Section kinds that carry only a concrete cover (no rebar group). */
export function sectionHasCover(kind: Section['kind']): boolean {
  return (
    kind === 'rc_column_rect' || kind === 'rc_beam_rect' || kind === 'rc_slab' || kind === 'rc_wall'
  );
}

/** Steel H-shape kinds expose width=B, depth=H and optional tw/tf. */
export function sectionIsSteelH(kind: Section['kind']): boolean {
  return kind === 's_column_h' || kind === 's_beam_h';
}

// ── Material strength presets (2-2) ──

export interface MaterialPreset {
  id: string;
  label: string;
  values: Partial<Material> & { type: Material['type'] };
}

/** JIS-aligned material presets. Values are nominal (N/mm² unless noted). */
export const MATERIAL_PRESETS: MaterialPreset[] = [
  // Concrete: Fc with typical unit weight ≈ 24 kN/m³, Ec via 3.35e4*(γ/24)^2*(Fc/60)^(1/3) ~ rounded.
  { id: 'FC21', label: 'FC21', values: { type: 'concrete', Fc: 21, unitWeight: 24, elasticModulus: 21500, poissonRatio: 0.2 } },
  { id: 'FC24', label: 'FC24', values: { type: 'concrete', Fc: 24, unitWeight: 24, elasticModulus: 22500, poissonRatio: 0.2 } },
  { id: 'FC27', label: 'FC27', values: { type: 'concrete', Fc: 27, unitWeight: 24, elasticModulus: 23500, poissonRatio: 0.2 } },
  { id: 'FC30', label: 'FC30', values: { type: 'concrete', Fc: 30, unitWeight: 24, elasticModulus: 24500, poissonRatio: 0.2 } },
  // Steel: F value / Fy with E ≈ 205000, unit weight ≈ 78.5 kN/m³.
  { id: 'SN400', label: 'SN400', values: { type: 'steel', F: 235, Fy: 235, elasticModulus: 205000, shearModulus: 79000, poissonRatio: 0.3, unitWeight: 78.5 } },
  { id: 'SN490', label: 'SN490', values: { type: 'steel', F: 325, Fy: 325, elasticModulus: 205000, shearModulus: 79000, poissonRatio: 0.3, unitWeight: 78.5 } },
];

/** Apply a preset onto an existing material, preserving id/name. */
export function applyMaterialPreset(material: Material, preset: MaterialPreset): Material {
  return { ...material, ...preset.values, id: material.id, name: material.name };
}

/**
 * Recompute upper-story elevations so each story's EL = previous story's EL + height.
 * Stories are processed in their current array order. The first story's EL is kept.
 * Returns a list of { id, elevation } updates to apply.
 */
export function chainStoryElevations(stories: Story[]): { id: string; elevation: number }[] {
  const updates: { id: string; elevation: number }[] = [];
  let prev: Story | undefined;
  for (const story of stories) {
    const elevation = prev ? prev.elevation + prev.height : story.elevation;
    if (elevation !== story.elevation) updates.push({ id: story.id, elevation });
    prev = { ...story, elevation };
  }
  return updates;
}
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
      elasticModulus: 'ヤング係数 E',
      unitWeight: '単位重量 γ',
      fc: 'Fc',
      steelF: 'F値',
      fy: 'Fy',
      preset: 'プリセット',
      applyPreset: '適用',
      diameter: '径 D',
      tw: 'ウェブ厚 tw',
      tf: 'フランジ厚 tf',
      cover: 'かぶり',
      mainDiameter: '主筋径',
      mainCount: '主筋本数',
      hoopDiameter: 'せん断補強筋径',
      hoopSpacing: 'せん断補強筋間隔',
      rebar: '配筋',
      deadLoad: '固定荷重',
      liveLoad: '積載荷重',
      elChainMode: 'EL自動連鎖',
      grids: '通り芯',
      addGrid: '通り芯追加',
      axis: '方向',
      position: '位置',
      loadCases: '荷重ケース',
      addLoadCase: '荷重ケース追加',
      factor: '係数',
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
    elasticModulus: 'Elastic modulus E',
    unitWeight: 'Unit weight γ',
    fc: 'Fc',
    steelF: 'F value',
    fy: 'Fy',
    preset: 'Preset',
    applyPreset: 'Apply',
    diameter: 'Diameter D',
    tw: 'Web thickness tw',
    tf: 'Flange thickness tf',
    cover: 'Cover',
    mainDiameter: 'Main bar Ø',
    mainCount: 'Main bar count',
    hoopDiameter: 'Hoop Ø',
    hoopSpacing: 'Hoop spacing',
    rebar: 'Rebar',
    deadLoad: 'Dead load',
    liveLoad: 'Live load',
    elChainMode: 'Auto-chain EL',
    grids: 'Grids',
    addGrid: 'Add Grid',
    axis: 'Axis',
    position: 'Position',
    loadCases: 'Load Cases',
    addLoadCase: 'Add Load Case',
    factor: 'Factor',
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
    case 's_column_h':
      return 'Steel H Column';
    case 's_beam_h':
      return 'Steel H Beam';
    case 's_pipe':
      return 'Steel Pipe';
  }
}
