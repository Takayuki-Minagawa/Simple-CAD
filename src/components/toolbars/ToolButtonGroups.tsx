import { useEditorStore } from '@/app/store';
import type { EditorTool } from '@/app/store';
import { useI18n } from '@/i18n';
import { getToolStatusLabel } from '@/app/toolMetadata';

export function ToolButtonGroups() {
  const activeTool = useEditorStore((state) => state.activeTool);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const { t } = useI18n();

  const toolBtn = (tool: EditorTool, label: string) => (
    <button
      type="button"
      className={`toolbar-btn ${activeTool === tool ? 'active' : ''}`}
      aria-pressed={activeTool === tool}
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
        {toolBtn('opening', t.layerOpening)}
        {toolBtn('dimension', t.toolDimension)}
        {toolBtn('annotation', t.toolAnnotation)}
      </div>

      <div className="toolbar-group">
        {toolBtn('trim', t.toolTrim)}
        {toolBtn('extend', t.toolExtend)}
        {toolBtn('fillet', t.toolFillet)}
      </div>
    </>
  );
}
