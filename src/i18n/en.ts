import type { Translations } from './types';

export const en: Translations = {
  appTitle: 'Structural Web CAD',
  loadPrompt: 'Open a project or click "Sample" to load demo data',

  menuFile: 'File',
  menuEdit: 'Edit',
  menuDraw: 'Draw',
  menuView: 'View',
  menuTools: 'Tools',

  fileNew: 'New',
  fileOpen: 'Open',
  fileSave: 'Save',
  fileSample: 'Sample',
  fileExport: 'Export',

  editUndo: 'Undo',
  editRedo: 'Redo',

  toolSelect: 'Select',
  toolPan: 'Pan',
  toolColumn: 'Column',
  toolBeam: 'Beam',
  toolWall: 'Wall',
  toolSlab: 'Slab',
  toolDimension: 'Dim',
  toolAnnotation: 'Text',

  view2d: '2D',
  view3d: '3D',

  btnAi: 'AI',
  btnHelp: 'Help',

  panelObjects: 'Objects',
  panelLayers: 'Layers',
  panelProperties: 'Properties',
  panelStory: 'Story',
  panelValidation: 'Validation',
  panelControls: 'Panel controls',
  panelLeftToggle: 'Show story, objects, and layers panel',
  panelRightToggle: 'Show properties and validation panel',
  allStories: 'All stories',
  noSelection: 'No selection',
  objectsSelected: 'objects selected',
  noProject: 'No project loaded',

  layerGrid: 'Grid',
  layerColumn: 'Column',
  layerBeam: 'Beam',
  layerWall: 'Wall',
  layerSlab: 'Slab',
  layerOpening: 'Opening',
  layerDimension: 'Dimension',
  layerAnnotation: 'Annotation',

  propId: 'ID',
  propType: 'Type',
  propStory: 'Story',
  propSection: 'Section',
  propMaterial: 'Material',
  propText: 'Text',
  propLength: 'Length',
  propOffset: 'Offset',
  propColor: 'Color',
  propLineWeight: 'Line Weight',
  propLineType: 'Line Type',
  propTextAlign: 'Align',
  propFillColor: 'Fill Color',
  propFillOpacity: 'Fill Opacity',
  propRotation: 'Rotation',

  statusZoom: 'Zoom',
  statusSnap: 'Snap',
  statusTool: 'Tool',
  statusStory: 'Story',
  statusSelected: 'Selected',
  statusOn: 'ON',
  statusOff: 'OFF',

  validationRun: 'Run',
  validationPrompt: 'Click "Run" to validate',
  validationPass: 'All checks passed',

  exportTitle: 'Export',
  exportFormat: 'Format',
  exportSheet: 'Sheet',
  exportCancel: 'Cancel',
  exportExecute: 'Export',
  exportExporting: 'Exporting...',

  aiTitle: 'AI Assist',
  aiPromptLabel: 'Prompt template for AI',
  aiCopyPrompt: 'Copy Prompt',
  aiCopyJson: 'Copy Current JSON',
  aiPasteLabel: 'Paste JSON to import',
  aiPastePlaceholder: 'Paste AI-generated JSON here...',
  aiImport: 'Import',
  aiClose: 'Close',
  aiGuideShow: 'Show guide',
  aiGuideHide: 'Hide guide',
  aiGuideTitle: 'How to use (3 steps)',
  aiGuideSteps:
    '① Click "Copy Prompt" → paste into ChatGPT or Claude\n' +
    '② Describe the building you want in natural language\n' +
    '   e.g. "1F 8m×6m RC, columns 600×600, beams 300×600"\n' +
    '③ Paste the JSON returned by the AI and click "Import"',
  aiGuideTipsTitle: 'Tips',
  aiGuideTips:
    '• Use "Copy Current JSON" to share your project with the AI for modifications\n' +
    '• If errors appear, share the red error text with the AI to fix the JSON\n' +
    '• After importing, verify in 2D/3D views and fine-tune in the Properties panel',

  viewOrtho: 'Ortho',
  viewPersp: 'Persp',
  viewWire: 'Wire',

  confirmUnsaved: 'You have unsaved changes. Continue?',
  confirmLoadSample: 'You have unsaved changes. Load sample?',
  promptAnnotationText: 'Enter text:',

  themeLight: 'Light',
  themeDark: 'Dark',

  langJa: '日本語',
  langEn: 'English',

  helpTitle: 'Quick Manual',
  helpClose: 'Close',
  helpSectionOverview: 'Overview',
  helpOverviewText:
    'Structural Web CAD is a static web application specialized for structural engineering design. It runs entirely in the browser with no server required. You can create/edit 2D plan drawings, inspect 3D models with clip sections, export to SVG / PDF / DXF, and import DXF annotations.',
  helpSectionGettingStarted: 'Getting Started',
  helpGettingStartedText:
    '1. Click "Sample" in the toolbar to load demo data\n2. Switch floors in the Story panel and duplicate the active story when you need another level\n3. Use drawing tools to add structural members\n4. Open "Masters" to edit materials, sections, sheets, and title blocks\n5. Toggle between "2D / 3D" views and use the clip slider in 3D when needed\n6. Click "Export" to output SVG / PDF / DXF',
  helpSectionTools: 'Drawing Tools',
  helpToolsText:
    '- Column: Click to place a column\n- Beam: Click 2 points to place a beam\n- Wall: Click 2 points to place a wall\n- Slab: Click multiple points → double-click to close\n- Dim: Click 2 points to place a dimension line\n- Text: Click to place an annotation\n- Transform: Apply numeric move / copy / scale / parametric deformation to the current selection',
  helpSectionShortcuts: 'Keyboard Shortcuts',
  helpShortcutsText:
    'V: Select  |  H: Pan  |  C: Column  |  B: Beam  |  W: Wall  |  S: Slab\nD: Dimension  |  T: Text  |  Escape: Cancel\nZ: Zoom Extents  |  Shift+Z: Zoom Selection  |  Shift while drawing: 45-degree constraint\nCtrl+Z: Undo  |  Ctrl+Shift+Z: Redo\nCtrl+D: Copy with 1000 mm offset  |  Delete: Delete\nToolbar "Transform": Numeric move / copy / scale / parametric deformation\nMouse wheel: Zoom  |  Middle button drag: Pan',
  helpSectionExport: 'Export',
  helpExportText:
    'Open the export dialog from the "Export" button in the toolbar. Choose SVG / PDF / DXF format. PDF can export all sheets into a single multi-page file. SVG/PDF export by sheet, DXF exports by story.',
  helpSectionJson: 'JSON Data Format',
  helpJsonText:
    'All data is managed as JSON. The schema conforms to JSON Schema 2020-12, and automatic validation is performed on load. Member types: column, beam, wall, slab. Unit is fixed to mm.',
  helpSectionAi: 'AI Integration',
  helpAiText:
    'Click "Tools → AI" in the toolbar to open the AI Assist panel.\n\n' +
    '■ How to use (3 steps)\n' +
    '1. Click "Copy Prompt" to copy the prompt template, then paste it into an external AI such as ChatGPT or Claude.\n' +
    '2. Describe the building you want to create in natural language.\n' +
    '   e.g. "1F 8m×6m RC, columns 600×600, beams 300×600, slab thickness 180"\n' +
    '3. Paste the JSON returned by the AI into the text area and click "Import".\n\n' +
    '■ Additional features\n' +
    '• "Copy Current JSON": Share your current project with the AI to request modifications.\n' +
    '• Error display: If import fails, share the red error text with the AI to fix the JSON.\n' +
    '• After importing, verify in 2D/3D views and fine-tune in the Properties panel.\n\n' +
    'Note: No AI engine is built into this app. It works via copy & paste with external AI services.',

  transformOffset: 'Offset',
  transformMirror: 'Mirror',
  transformArray: 'Array',
  transformOffsetDistance: 'Distance',
  transformMirrorAxis: 'Axis',
  transformMirrorCopy: 'Copy',
  transformAxisHorizontal: 'Horizontal',
  transformAxisVertical: 'Vertical',
  transformAxisCustom: 'Custom Angle',
  transformAxisAngle: 'Angle',
  transformArrayRows: 'Rows',
  transformArrayColumns: 'Columns',
  transformArrayRowSpacing: 'Row Spacing',
  transformArrayColSpacing: 'Column Spacing',

  coordInputPlaceholder: 'x,y or @dx,dy or @dist<angle',
  coordInputLabel: 'Coordinate',

  zoomExtents: 'Zoom Extents',
  zoomSelection: 'Zoom Selection',
  inputAssist: 'Input Assist',
  memberSnap: 'Member Snap',
  columnZDown: 'Column Z: Down',
  columnZUp: 'Column Z: Up',
  inputAssistTooltip: 'Dim existing members while drawing and prioritize grid input',
  memberSnapTooltip: 'Snap to existing members while drawing',
  columnZDownTooltip: 'Place columns downward from the active story level',
  columnZUpTooltip: 'Place columns upward from the active story level',

  selectionWindow: 'Window',
  selectionCrossing: 'Crossing',

  memberColumn: 'column',
  memberBeam: 'beam',
  memberWall: 'wall',
  memberSlab: 'slab',
  memberAnnotation: 'annotation',
  memberDimension: 'dimension',

  // Trim/Extend
  toolTrim: 'Trim',
  toolExtend: 'Extend',
  toolFillet: 'Fillet',
  trimPrompt: 'Click near the end of a member to trim',
  extendPrompt: 'Click a member to extend, then click the target member',
  filletPrompt: 'Click two walls to clean their intersection',

  // Measurement
  propArea: 'Area',
  propPerimeter: 'Perimeter',

  // Vertex editing
  propVertices: 'Vertices',
  vertexAdd: 'Add',
  vertexRemove: 'Remove',

  // Grouping
  groupCreate: 'Group',
  groupUngroup: 'Ungroup',
  groupName: 'Group',
  groupPromptName: 'Enter group name:',

  // Print Preview
  printPreview: 'Preview',
  printPreviewTitle: 'Print Preview',
  printPreviewClose: 'Close',
  printPreviewEmpty: 'No preview available',

  // Snap additions
  snapPerpendicular: 'Perpendicular',
  snapNearest: 'Nearest',

  // Construction Lines
  toolXline: 'XLine',
  layerConstruction: 'Construction',

  // Spline
  toolSpline: 'Spline',

  // Text Formatting
  propFontWeight: 'Bold',
  propFontStyle: 'Italic',
  propTextDecoration: 'Underline',
  propFontFamily: 'Font',

  // External References
  xrefTitle: 'External References',
  xrefImport: 'Import Xref',
  xrefRemove: 'Remove',

  // Viewports
  viewportTitle: 'Viewports',
  viewportAdd: 'Add Viewport',
  viewportRemove: 'Remove',

  // Drawing Templates
  templatePickerTitle: 'Select Template',
  templateA1Structure: 'A1 Structure (1:100)',
  templateA3Detail: 'A3 Detail (1:50)',
  templateBlankA1: 'Blank A1',
  templateSelectPrompt: 'Choose a template for the new project:',
};
