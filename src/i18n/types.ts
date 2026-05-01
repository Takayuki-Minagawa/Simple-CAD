export type Locale = 'ja' | 'en';

export interface Translations {
  // App
  appTitle: string;
  loadPrompt: string;

  // Toolbar - Menu labels
  menuFile: string;
  menuEdit: string;
  menuDraw: string;
  menuView: string;
  menuTools: string;

  // Toolbar - File
  fileNew: string;
  fileOpen: string;
  fileSave: string;
  fileSample: string;
  fileExport: string;

  // Toolbar - Edit
  editUndo: string;
  editRedo: string;

  // Toolbar - Tools
  toolSelect: string;
  toolPan: string;
  toolColumn: string;
  toolBeam: string;
  toolWall: string;
  toolSlab: string;
  toolDimension: string;
  toolAnnotation: string;

  // Toolbar - View
  view2d: string;
  view3d: string;

  // Toolbar - Misc
  btnAi: string;
  btnHelp: string;

  // Panels
  panelObjects: string;
  panelLayers: string;
  panelProperties: string;
  panelStory: string;
  panelValidation: string;
  panelControls: string;
  panelLeftToggle: string;
  panelRightToggle: string;
  allStories: string;
  noSelection: string;
  objectsSelected: string;
  noProject: string;

  // Layers
  layerGrid: string;
  layerColumn: string;
  layerBeam: string;
  layerWall: string;
  layerSlab: string;
  layerOpening: string;
  layerDimension: string;
  layerAnnotation: string;

  // Property
  propId: string;
  propType: string;
  propStory: string;
  propSection: string;
  propMaterial: string;
  propText: string;
  propLength: string;
  propOffset: string;
  propColor: string;
  propLineWeight: string;
  propLineType: string;
  propTextAlign: string;
  propFillColor: string;
  propFillOpacity: string;
  propRotation: string;

  // Status bar
  statusZoom: string;
  statusSnap: string;
  statusTool: string;
  statusStory: string;
  statusSelected: string;
  statusOn: string;
  statusOff: string;

  // Validation
  validationRun: string;
  validationPrompt: string;
  validationPass: string;

  // Export dialog
  exportTitle: string;
  exportFormat: string;
  exportSheet: string;
  exportCancel: string;
  exportExecute: string;
  exportExporting: string;

  // AI dialog
  aiTitle: string;
  aiPromptLabel: string;
  aiCopyPrompt: string;
  aiCopyJson: string;
  aiPasteLabel: string;
  aiPastePlaceholder: string;
  aiImport: string;
  aiClose: string;
  aiGuideShow: string;
  aiGuideHide: string;
  aiGuideTitle: string;
  aiGuideSteps: string;
  aiGuideTipsTitle: string;
  aiGuideTips: string;

  // 3D viewer
  viewOrtho: string;
  viewPersp: string;
  viewWire: string;

  // Confirmations
  confirmUnsaved: string;
  confirmLoadSample: string;
  promptAnnotationText: string;

  // Theme
  themeLight: string;
  themeDark: string;

  // Language
  langJa: string;
  langEn: string;

  // Help / Manual
  helpTitle: string;
  helpClose: string;
  helpSectionOverview: string;
  helpOverviewText: string;
  helpSectionGettingStarted: string;
  helpGettingStartedText: string;
  helpSectionTools: string;
  helpToolsText: string;
  helpSectionShortcuts: string;
  helpShortcutsText: string;
  helpSectionExport: string;
  helpExportText: string;
  helpSectionJson: string;
  helpJsonText: string;
  helpSectionAi: string;
  helpAiText: string;

  // Transform modes
  transformOffset: string;
  transformMirror: string;
  transformArray: string;
  transformOffsetDistance: string;
  transformMirrorAxis: string;
  transformMirrorCopy: string;
  transformAxisHorizontal: string;
  transformAxisVertical: string;
  transformAxisCustom: string;
  transformAxisAngle: string;
  transformArrayRows: string;
  transformArrayColumns: string;
  transformArrayRowSpacing: string;
  transformArrayColSpacing: string;

  // Coordinate input
  coordInputPlaceholder: string;
  coordInputLabel: string;

  // Zoom
  zoomExtents: string;
  zoomSelection: string;
  inputAssist: string;
  memberSnap: string;
  columnZDown: string;
  columnZUp: string;
  inputAssistTooltip: string;
  memberSnapTooltip: string;
  columnZDownTooltip: string;
  columnZUpTooltip: string;

  // Rectangle selection
  selectionWindow: string;
  selectionCrossing: string;

  // member type labels
  memberColumn: string;
  memberBeam: string;
  memberWall: string;
  memberSlab: string;
  memberAnnotation: string;
  memberDimension: string;

  // Trim/Extend
  toolTrim: string;
  toolExtend: string;
  toolFillet: string;
  trimPrompt: string;
  extendPrompt: string;
  filletPrompt: string;

  // Measurement
  propArea: string;
  propPerimeter: string;

  // Vertex editing
  propVertices: string;
  vertexAdd: string;
  vertexRemove: string;

  // Grouping
  groupCreate: string;
  groupUngroup: string;
  groupName: string;
  groupPromptName: string;

  // Print Preview
  printPreview: string;
  printPreviewTitle: string;
  printPreviewClose: string;
  printPreviewEmpty: string;

  // Snap additions
  snapPerpendicular: string;
  snapNearest: string;

  // Construction Lines
  toolXline: string;
  layerConstruction: string;

  // Spline
  toolSpline: string;

  // Text Formatting
  propFontWeight: string;
  propFontStyle: string;
  propTextDecoration: string;
  propFontFamily: string;

  // External References
  xrefTitle: string;
  xrefImport: string;
  xrefRemove: string;

  // Viewports
  viewportTitle: string;
  viewportAdd: string;
  viewportRemove: string;

  // Drawing Templates
  templatePickerTitle: string;
  templateA1Structure: string;
  templateA3Detail: string;
  templateBlankA1: string;
  templateSelectPrompt: string;
}
