import type { Translations } from './types';

export const ja: Translations = {
  appTitle: 'Structural Web CAD',
  loadPrompt: 'プロジェクトを開くか「サンプル」をクリックしてデモデータを読み込んでください',

  menuFile: 'ファイル',
  menuEdit: '編集',
  menuDraw: '描画',
  menuView: '表示',
  menuTools: 'ツール',

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
  panelControls: 'パネル切替',
  panelLeftToggle: '階・オブジェクト・レイヤーパネルを表示',
  panelRightToggle: 'プロパティ・検証パネルを表示',
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
  propColor: '色',
  propLineWeight: '線幅',
  propLineType: '線種',
  propTextAlign: '配置',
  propFillColor: '塗り色',
  propFillOpacity: '塗り透過',
  propRotation: '回転',

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
  aiGuideShow: '使い方を見る',
  aiGuideHide: '使い方を閉じる',
  aiGuideTitle: '使い方（3ステップ）',
  aiGuideSteps:
    '① 「プロンプトをコピー」→ ChatGPT や Claude に貼り付け\n' +
    '② 続けて作りたい建物の仕様を自然言語で入力\n' +
    '   例: 「1階 8m×6m RC造、柱600×600、梁300×600」\n' +
    '③ AI が返した JSON をここに貼り付けて「読み込み」をクリック',
  aiGuideTipsTitle: '活用のヒント',
  aiGuideTips:
    '・「現在の JSON をコピー」で今のプロジェクトを AI に渡し、修正を依頼できます\n' +
    '・エラーが出たら赤字の内容を AI に伝えて修正してもらいましょう\n' +
    '・読み込み後は 2D/3D ビューで確認し、プロパティパネルで微調整できます',

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
    'Structural Web CAD は、構造設計（建築構造）に特化した静的 Web アプリケーションです。ブラウザだけで動作し、サーバーは不要です。2D 平面図の作図・編集、Three.js による 3D 確認ビュー、断面クリップ、SVG / PDF / DXF へのエクスポート、DXF 注記取り込みが可能です。',
  helpSectionGettingStarted: 'はじめに',
  helpGettingStartedText:
    '1. ツールバーの「サンプル」をクリックしてデモデータを読み込みます\n2. 左パネルで階(Story)を切り替え、必要なら「複製」で上階を作ります\n3. 描画ツールで部材を追加します\n4. 「マスタ」から materials / sections / sheets とタイトルブロックを編集します\n5. 「2D / 3D」ボタンで表示を切り替え、3D では断面スライダでクリップ表示できます\n6. 「出力」ボタンで SVG / PDF / DXF にエクスポートします',
  helpSectionTools: '描画ツール',
  helpToolsText:
    '- 柱: クリックした位置に柱を配置\n- 梁: 2 点をクリックして梁を配置\n- 壁: 2 点をクリックして壁を配置\n- スラブ: 複数点をクリック → ダブルクリックまたは Enter で確定\n- 寸法: 2 点をクリックして寸法線を配置\n- 注記: クリックした位置にテキストを配置\n- 変形: 選択した要素へ移動 / 複写 / 縮尺 / パラメトリック変形を数値指定で適用',
  helpSectionShortcuts: 'キーボードショートカット',
  helpShortcutsText:
    'V: 選択  |  H: パン  |  C: 柱  |  B: 梁  |  W: 壁  |  S: スラブ\nD: 寸法  |  T: 注記  |  Escape: キャンセル  |  Enter: スラブ/スプライン確定\nZ: 全体表示  |  Shift+Z: 選択範囲表示  |  作図中 Shift: 45度拘束\nCtrl+Z: 元に戻す  |  Ctrl+Shift+Z: やり直し\nCtrl+D: 1000mm オフセットで複写  |  Delete: 削除\nツールバー「変形」: 数値指定の移動 / 複写 / 縮尺 / パラメトリック変形\nマウスホイール: ズーム  |  中ボタンドラッグ: パン',
  helpSectionExport: 'エクスポート',
  helpExportText:
    'ツールバーの「出力」からエクスポートダイアログを開き、SVG / PDF / DXF を選択して出力します。PDF は全シートを1つの複数ページ PDF にまとめて出力できます。SVG / PDF はシート単位、DXF は階単位で出力されます。',
  helpSectionJson: 'JSON データ形式',
  helpJsonText:
    '本アプリはすべてのデータを JSON で管理します。JSON Schema 2020-12 に準拠しており、読み込み時に自動バリデーションが行われます。部材タイプ: column (柱), beam (梁), wall (壁), slab (スラブ)。単位は mm 固定です。',
  helpSectionAi: 'AI 連携',
  helpAiText:
    'ツールバーの「ツール → AI」をクリックすると AI アシストパネルが開きます。\n\n' +
    '■ 使い方（3 ステップ）\n' +
    '1. 「プロンプトをコピー」ボタンでプロンプトをクリップボードにコピーし、ChatGPT や Claude 等の外部 AI に貼り付けます。\n' +
    '2. 続けて作りたい建物の仕様を自然言語で入力します。\n' +
    '   例: 「1階 8m×6m RC造、柱600×600、梁300×600、スラブ厚180」\n' +
    '3. AI が返した JSON をパネルのテキストエリアに貼り付け、「読み込み」ボタンをクリックします。\n\n' +
    '■ 補助機能\n' +
    '・「現在の JSON をコピー」: 今のプロジェクトの JSON を AI に渡して修正を依頼できます。\n' +
    '・エラー表示: 読み込み失敗時は赤字のエラー内容を AI に伝えて修正できます。\n' +
    '・読み込み後は 2D/3D ビューで確認し、プロパティパネルで微調整できます。\n\n' +
    '※ 本アプリ内に AI エンジンは搭載されていません。外部 AI とのコピー＆ペーストで連携する仕組みです。',

  transformOffset: 'オフセット',
  transformMirror: 'ミラー',
  transformArray: '配列複写',
  transformOffsetDistance: '距離',
  transformMirrorAxis: '軸',
  transformMirrorCopy: '複写',
  transformAxisHorizontal: '水平',
  transformAxisVertical: '垂直',
  transformAxisCustom: 'カスタム角度',
  transformAxisAngle: '角度',
  transformArrayRows: '行数',
  transformArrayColumns: '列数',
  transformArrayRowSpacing: '行間隔',
  transformArrayColSpacing: '列間隔',

  coordInputPlaceholder: 'x,y または @dx,dy または @距離<角度',
  coordInputLabel: '座標',

  zoomExtents: '全体表示',
  zoomSelection: '選択範囲表示',
  inputAssist: '入力補助',
  memberSnap: '部材スナップ',
  columnZDown: '柱Z: 下',
  columnZUp: '柱Z: 上',
  inputAssistTooltip: '作図中に既存部材を薄くし、グリッド入力を優先します',
  memberSnapTooltip: '作図中も既存部材へスナップします',
  columnZDownTooltip: '柱を現階レベルから下向きに配置します',
  columnZUpTooltip: '柱を現階レベルから上向きに配置します',

  guideColumnPlace: '柱の配置位置をクリック',
  guideBeamStart: '梁の始点をクリック',
  guideBeamEnd: '梁の終点をクリック',
  guideWallStart: '壁の始点をクリック',
  guideWallEnd: '壁の終点をクリック',
  guideSlabStart: 'スラブの1点目をクリック',
  guideSlabNext: '次の頂点をクリック、ダブルクリックまたは Enter で確定',
  guideDimensionStart: '寸法の始点をクリック',
  guideDimensionEnd: '寸法の終点をクリック',
  guideAnnotationPlace: '注記を配置する位置をクリック',
  guideXlineStart: '補助線の基点をクリック',
  guideXlineDirection: '補助線の方向点をクリック',
  guideSplineStart: 'スプラインの1点目をクリック',
  guideSplineNext: '次の点をクリック、ダブルクリックまたは Enter で確定',
  guideTrimPrompt: '部材の端付近をクリックしてトリム',
  guideExtendSource: '延長する部材をクリック',
  guideExtendTarget: '延長先の部材をクリック',

  selectionWindow: 'ウィンドウ選択',
  selectionCrossing: 'クロス選択',

  memberColumn: '柱',
  memberBeam: '梁',
  memberWall: '壁',
  memberSlab: 'スラブ',
  memberAnnotation: '注記',
  memberDimension: '寸法線',

  // Trim/Extend
  toolTrim: 'トリム',
  toolExtend: '延長',
  toolFillet: 'フィレット',
  trimPrompt: '部材の端付近をクリックしてトリム',
  extendPrompt: '延長する部材をクリック、次にターゲット部材をクリック',
  filletPrompt: '2つの壁をクリックして交差をクリーン',

  // Measurement
  propArea: '面積',
  propPerimeter: '周長',

  // Vertex editing
  propVertices: '頂点',
  vertexAdd: '追加',
  vertexRemove: '削除',

  // Grouping
  groupCreate: 'グループ化',
  groupUngroup: 'グループ解除',
  groupName: 'グループ',
  groupPromptName: 'グループ名を入力:',

  // Print Preview
  printPreview: 'プレビュー',
  printPreviewTitle: '印刷プレビュー',
  printPreviewClose: '閉じる',
  printPreviewEmpty: 'プレビューなし',

  // Snap additions
  snapPerpendicular: '垂直',
  snapNearest: '最近点',

  // Construction Lines
  toolXline: '補助線',
  layerConstruction: '補助線',

  // Spline
  toolSpline: 'スプライン',

  // Text Formatting
  propFontWeight: '太字',
  propFontStyle: '斜体',
  propTextDecoration: '下線',
  propFontFamily: 'フォント',

  // External References
  xrefTitle: '外部参照',
  xrefImport: '外部参照取込',
  xrefRemove: '削除',

  // Viewports
  viewportTitle: 'ビューポート',
  viewportAdd: 'ビューポート追加',
  viewportRemove: '削除',

  // Drawing Templates
  templatePickerTitle: 'テンプレート選択',
  templateA1Structure: 'A1 構造図 (1:100)',
  templateA3Detail: 'A3 詳細図 (1:50)',
  templateBlankA1: '白紙 A1',
  templateSelectPrompt: '新規プロジェクトのテンプレートを選択してください:',
};
