import { useEditorStore } from '@/app/store';
import type { EditorTool } from '@/app/store';
import { useI18n } from '@/i18n';
import { getToolStatusLabel } from '@/app/toolMetadata';

export function ToolButtonGroups() {
  const { activeTool, setActiveTool, setSelectedIds } = useEditorStore();
  const { t } = useI18n();

  const toolBtn = (tool: EditorTool, label: string) => (
    <button
      className={`toolbar-btn ${activeTool === tool ? 'active' : ''}`}
      onClick={() => {
        setActiveTool(tool);
        if (tool !== 'select') setSelectedIds([]);
      }}
      title={getToolStatusLabel(tool, t)}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* ── Direct tool buttons (Select / Pan) ── */}
      <div className="toolbar-group">
        {toolBtn('select', t.toolSelect)}
        {toolBtn('pan', t.toolPan)}
      </div>

      {/* ── Direct drawing tools ── */}
      <div className="toolbar-group">
        {toolBtn('column', t.toolColumn)}
        {toolBtn('beam', t.toolBeam)}
        {toolBtn('wall', t.toolWall)}
        {toolBtn('slab', t.toolSlab)}
        {toolBtn('dimension', t.toolDimension)}
        {toolBtn('annotation', t.toolAnnotation)}
      </div>
    </>
  );
}
