import { useEditorStore, useProjectStore } from '@/app/store';
import type { EditorTool } from '@/app/store';
import { openJsonFile, saveFile } from '@/libs/fileSystem';
import { importProjectJson } from '@/domain/import/jsonImport';
import { exportProjectJson } from '@/domain/export/jsonExport';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';

interface Props {
  onExport: () => void;
  onAiAssist: () => void;
}

export function MainToolbar({ onExport, onAiAssist }: Props) {
  const { data, isDirty, fileHandle, loadProject, newProject, setFileHandle, markClean } =
    useProjectStore();
  const { viewMode, setViewMode, activeTool, setActiveTool, setSelectedIds } = useEditorStore();

  const handleNew = () => {
    if (isDirty && !confirm('未保存の変更があります。新規作成しますか？')) return;
    newProject();
  };

  const handleOpen = async () => {
    try {
      const result = await openJsonFile();
      const imported = importProjectJson(result.content);
      if (!imported.ok) {
        alert('バリデーションエラー:\n' + imported.errors.map((e) => e.message).join('\n'));
        return;
      }
      loadProject(imported.data);
      if (result.handle) setFileHandle(result.handle);
    } catch {
      // User cancelled
    }
  };

  const handleSave = async () => {
    if (!data) return;
    const json = exportProjectJson(data);
    try {
      const handle = await saveFile(json, `${data.project.name}.json`, 'application/json', fileHandle);
      if (handle) setFileHandle(handle);
      markClean();
    } catch {
      // User cancelled
    }
  };

  const handleSample = () => {
    if (isDirty && !confirm('未保存の変更があります。サンプルを読み込みますか？')) return;
    loadProject(sampleProject as unknown as ProjectData);
  };

  const handleUndo = () => {
    useProjectStore.temporal.getState().undo();
  };

  const handleRedo = () => {
    useProjectStore.temporal.getState().redo();
  };

  const toolBtn = (tool: EditorTool, label: string) => (
    <button
      className={`toolbar-btn ${activeTool === tool ? 'active' : ''}`}
      onClick={() => {
        setActiveTool(tool);
        if (tool !== 'select') setSelectedIds([]);
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="main-toolbar">
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleNew}>New</button>
        <button className="toolbar-btn" onClick={handleOpen}>Open</button>
        <button className="toolbar-btn" onClick={handleSave} disabled={!data}>
          Save{isDirty ? ' *' : ''}
        </button>
        <button className="toolbar-btn" onClick={handleSample}>Sample</button>
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleUndo} disabled={!data}>Undo</button>
        <button className="toolbar-btn" onClick={handleRedo} disabled={!data}>Redo</button>
      </div>

      <div className="toolbar-group">
        {toolBtn('select', 'Select')}
        {toolBtn('pan', 'Pan')}
      </div>

      <div className="toolbar-group">
        {toolBtn('column', 'Column')}
        {toolBtn('beam', 'Beam')}
        {toolBtn('wall', 'Wall')}
        {toolBtn('slab', 'Slab')}
        {toolBtn('dimension', 'Dim')}
        {toolBtn('annotation', 'Text')}
      </div>

      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${viewMode === '2d' ? 'active' : ''}`}
          onClick={() => setViewMode('2d')}
        >
          2D
        </button>
        <button
          className={`toolbar-btn ${viewMode === '3d' ? 'active' : ''}`}
          onClick={() => setViewMode('3d')}
        >
          3D
        </button>
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onExport} disabled={!data}>Export</button>
        <button className="toolbar-btn" onClick={onAiAssist}>AI</button>
      </div>
    </div>
  );
}
