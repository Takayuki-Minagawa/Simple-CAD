import type { Translations } from './types';

export const ja: Translations = {
  appTitle: 'Structural Web CAD',
  loadPrompt: 'プロジェクトを開くか「サンプル」をクリックしてデモデータを読み込んでください',

  fileNew: '新規',
  fileOpen: '開く',
  fileSave: '保存',
  fileSample: 'サンプル',
  fileExport: '出力',

  editUndo: '元に戻す',
  editRedo: 'やり直し',

  toolSelect: '選択',
  toolPan: 'パン',
  toolColumn: '柱',
  toolBeam: '梁',
  toolWall: '壁',
  toolSlab: 'スラブ',
  toolDimension: '寸法',
  toolAnnotation: '注記',

  view2d: '2D',
  view3d: '3D',

  btnAi: 'AI',
  btnHelp: 'ヘルプ',

  panelObjects: 'オブジェクト',
  panelLayers: 'レイヤー',
  panelProperties: 'プロパティ',
  panelStory: '階',
  panelValidation: '検証',
  allStories: '全階表示',
  noSelection: '選択なし',
  objectsSelected: '個のオブジェクトを選択中',
  noProject: 'プロジェクト未読込',

  layerGrid: 'グリッド',
  layerColumn: '柱',
  layerBeam: '梁',
  layerWall: '壁',
  layerSlab: 'スラブ',
  layerOpening: '開口',
  layerDimension: '寸法線',
  layerAnnotation: '注記',

  propId: 'ID',
  propType: 'タイプ',
  propStory: '階',
  propSection: '断面',
  propMaterial: '材料',
  propText: 'テキスト',
  propLength: '長さ',
  propOffset: 'オフセット',

  statusZoom: 'ズーム',
  statusSnap: 'スナップ',
  statusTool: 'ツール',
  statusStory: '階',
  statusSelected: '選択',
  statusOn: 'ON',
  statusOff: 'OFF',

  validationRun: '実行',
  validationPrompt: '「実行」をクリックして検証',
  validationPass: 'すべてのチェックに合格しました',

  exportTitle: 'エクスポート',
  exportFormat: '形式',
  exportSheet: 'シート',
  exportCancel: 'キャンセル',
  exportExecute: 'エクスポート',
  exportExporting: 'エクスポート中...',

  aiTitle: 'AI アシスト',
  aiPromptLabel: 'AI 用プロンプトテンプレート',
  aiCopyPrompt: 'プロンプトをコピー',
  aiCopyJson: '現在の JSON をコピー',
  aiPasteLabel: 'JSON 貼り付け読み込み',
  aiPastePlaceholder: 'AI が生成した JSON をここに貼り付けてください...',
  aiImport: '読み込み',
  aiClose: '閉じる',

  viewOrtho: '平行',
  viewPersp: '透視',
  viewWire: 'ワイヤー',

  confirmUnsaved: '未保存の変更があります。続行しますか？',
  confirmLoadSample: '未保存の変更があります。サンプルを読み込みますか？',
  promptAnnotationText: 'テキストを入力:',

  themeLight: 'ライト',
  themeDark: 'ダーク',

  langJa: '日本語',
  langEn: 'English',

  helpTitle: '簡易マニュアル',
  helpClose: '閉じる',
  helpSectionOverview: '概要',
  helpOverviewText:
    'Structural Web CAD は、構造設計（建築構造）に特化した静的 Web アプリケーションです。ブラウザだけで動作し、サーバーは不要です。2D 平面図の作図・編集、Three.js による 3D 確認ビュー、SVG / PDF / DXF へのエクスポートが可能です。',
  helpSectionGettingStarted: 'はじめに',
  helpGettingStartedText:
    '1. ツールバーの「サンプル」をクリックしてデモデータを読み込みます\n2. 左パネルで階(Story)を切り替えます\n3. 描画ツールで部材を追加します\n4. 「選択」ツールでオブジェクトを選択し、右パネルでプロパティを編集します\n5. 「2D / 3D」ボタンで表示を切り替えます\n6. 「出力」ボタンで SVG / PDF / DXF にエクスポートします',
  helpSectionTools: '描画ツール',
  helpToolsText:
    '- 柱: クリックした位置に柱を配置\n- 梁: 2 点をクリックして梁を配置\n- 壁: 2 点をクリックして壁を配置\n- スラブ: 複数点をクリック → ダブルクリックで確定\n- 寸法: 2 点をクリックして寸法線を配置\n- 注記: クリックした位置にテキストを配置',
  helpSectionShortcuts: 'キーボードショートカット',
  helpShortcutsText:
    'V: 選択  |  H: パン  |  C: 柱  |  B: 梁  |  W: 壁  |  S: スラブ\nD: 寸法  |  T: 注記  |  Escape: キャンセル\nCtrl+Z: 元に戻す  |  Ctrl+Shift+Z: やり直し\nCtrl+D: 複製  |  Delete: 削除\nマウスホイール: ズーム  |  中ボタンドラッグ: パン',
  helpSectionExport: 'エクスポート',
  helpExportText:
    'ツールバーの「出力」からエクスポートダイアログを開き、SVG / PDF / DXF を選択して出力します。SVG / PDF はシート単位、DXF は階単位で出力されます。',
  helpSectionJson: 'JSON データ形式',
  helpJsonText:
    '本アプリはすべてのデータを JSON で管理します。JSON Schema 2020-12 に準拠しており、読み込み時に自動バリデーションが行われます。部材タイプ: column (柱), beam (梁), wall (壁), slab (スラブ)。単位は mm 固定です。',
  helpSectionAi: 'AI 連携',
  helpAiText:
    'ツールバーの「AI」ボタンからプロンプトテンプレートをコピーし、ChatGPT や Claude 等の LLM に渡すことで JSON データを自動生成できます。生成された JSON を貼り付けて読み込むことも可能です。',

  memberColumn: '柱',
  memberBeam: '梁',
  memberWall: '壁',
  memberSlab: 'スラブ',
  memberAnnotation: '注記',
  memberDimension: '寸法線',
};
