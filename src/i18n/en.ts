import type { Translations } from './types';

export const en: Translations = {
  appTitle: 'Structural Web CAD',
  loadPrompt: 'Open a project or click "Sample" to load demo data',

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
    'V: Select  |  H: Pan  |  C: Column  |  B: Beam  |  W: Wall  |  S: Slab\nD: Dimension  |  T: Text  |  Escape: Cancel\nCtrl+Z: Undo  |  Ctrl+Shift+Z: Redo\nCtrl+D: Copy with 1000 mm offset  |  Delete: Delete\nToolbar "Transform": Numeric move / copy / scale / parametric deformation\nMouse wheel: Zoom  |  Middle button drag: Pan',
  helpSectionExport: 'Export',
  helpExportText:
    'Open the export dialog from the "Export" button in the toolbar. Choose SVG / PDF / DXF format. PDF can export all sheets into a single multi-page file. SVG/PDF export by sheet, DXF exports by story.',
  helpSectionJson: 'JSON Data Format',
  helpJsonText:
    'All data is managed as JSON. The schema conforms to JSON Schema 2020-12, and automatic validation is performed on load. Member types: column, beam, wall, slab. Unit is fixed to mm.',
  helpSectionAi: 'AI Integration',
  helpAiText:
    'Copy the prompt template from the "AI" button and paste it into ChatGPT, Claude, or other LLMs to auto-generate JSON data. You can also paste generated JSON directly to import it.',

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

  selectionWindow: 'Window',
  selectionCrossing: 'Crossing',

  memberColumn: 'column',
  memberBeam: 'beam',
  memberWall: 'wall',
  memberSlab: 'slab',
  memberAnnotation: 'annotation',
  memberDimension: 'dimension',
};
