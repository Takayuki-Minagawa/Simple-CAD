import { useProjectStore, useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { isEntityLayerInteractive } from '@/domain/rendering/layerLock';
import { useShallow } from 'zustand/react/shallow';

export function ObjectTreePanel() {
  const data = useProjectStore((s) => s.data);
  const { selectedIds, setSelectedIds, activeStory, layerLocked, layerVisibility } = useEditorStore(
    useShallow((state) => ({
      selectedIds: state.selectedIds,
      setSelectedIds: state.setSelectedIds,
      activeStory: state.activeStory,
      layerLocked: state.layerLocked,
      layerVisibility: state.layerVisibility,
    })),
  );
  const { t } = useI18n();

  if (!data) return <div className="panel-content">{t.noProject}</div>;

  const membersByType = {
    column: data.members.filter((m) => m.type === 'column' && (!activeStory || m.story === activeStory)),
    beam: data.members.filter((m) => m.type === 'beam' && (!activeStory || m.story === activeStory)),
    wall: data.members.filter((m) => m.type === 'wall' && (!activeStory || m.story === activeStory)),
    slab: data.members.filter((m) => m.type === 'slab' && (!activeStory || m.story === activeStory)),
  };

  const typeLabels: Record<string, string> = {
    column: t.memberColumn,
    beam: t.memberBeam,
    wall: t.memberWall,
    slab: t.memberSlab,
  };

  const annotations = data.annotations.filter((a) => !activeStory || a.story === activeStory);
  const dimensions = data.dimensions.filter((d) => !activeStory || d.story === activeStory);
  const memberById = new Map(data.members.map((member) => [member.id, member]));
  const openings = data.openings.filter((opening) => {
    const host = memberById.get(opening.memberId);
    return host && (!activeStory || host.story === activeStory);
  });

  return (
    <div>
      <div className="panel-header">{t.panelObjects}</div>
      <div className="panel-content">
        {Object.entries(membersByType).map(([type, members]) => (
          <div key={type}>
            <div className="tree-group-label">{typeLabels[type]} ({members.length})</div>
            {members.map((m) => {
              const interactive = isEntityLayerInteractive(
                data,
                m.id,
                layerLocked,
                layerVisibility,
              );
              return (
                <div
                  key={m.id}
                  className={`tree-node ${selectedIds.includes(m.id) ? 'selected' : ''}`}
                  style={!interactive ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                  onClick={() => { if (interactive) setSelectedIds([m.id]); }}
                >
                  {m.id}
                </div>
              );
            })}
          </div>
        ))}
        <div className="tree-group-label">{t.memberAnnotation} ({annotations.length})</div>
        {annotations.map((a) => {
          const interactive = isEntityLayerInteractive(
            data,
            a.id,
            layerLocked,
            layerVisibility,
          );
          return (
            <div
              key={a.id}
              className={`tree-node ${selectedIds.includes(a.id) ? 'selected' : ''}`}
              style={!interactive ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
              onClick={() => { if (interactive) setSelectedIds([a.id]); }}
            >
              {a.id}: {a.text}
            </div>
          );
        })}
        <div className="tree-group-label">{t.memberDimension} ({dimensions.length})</div>
        {dimensions.map((d) => {
          const interactive = isEntityLayerInteractive(
            data,
            d.id,
            layerLocked,
            layerVisibility,
          );
          return (
            <div
              key={d.id}
              className={`tree-node ${selectedIds.includes(d.id) ? 'selected' : ''}`}
              style={!interactive ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
              onClick={() => { if (interactive) setSelectedIds([d.id]); }}
            >
              {d.id}
            </div>
          );
        })}
        <div className="tree-group-label">{t.layerOpening} ({openings.length})</div>
        {openings.map((opening) => {
          const interactive = isEntityLayerInteractive(
            data,
            opening.id,
            layerLocked,
            layerVisibility,
          );
          return (
            <div
              key={opening.id}
              className={`tree-node ${selectedIds.includes(opening.id) ? 'selected' : ''}`}
              style={!interactive ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
              onClick={() => { if (interactive) setSelectedIds([opening.id]); }}
            >
              {opening.id}: {opening.type}
            </div>
          );
        })}
      </div>
    </div>
  );
}
