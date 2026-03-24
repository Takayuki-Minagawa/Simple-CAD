import { useProjectStore, useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';

export function ObjectTreePanel() {
  const data = useProjectStore((s) => s.data);
  const { selectedIds, setSelectedIds, activeStory } = useEditorStore();
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

  return (
    <div>
      <div className="panel-header">{t.panelObjects}</div>
      <div className="panel-content">
        {Object.entries(membersByType).map(([type, members]) => (
          <div key={type}>
            <div className="tree-group-label">{typeLabels[type]} ({members.length})</div>
            {members.map((m) => (
              <div
                key={m.id}
                className={`tree-node ${selectedIds.includes(m.id) ? 'selected' : ''}`}
                onClick={() => setSelectedIds([m.id])}
              >
                {m.id}
              </div>
            ))}
          </div>
        ))}
        <div className="tree-group-label">{t.memberAnnotation} ({annotations.length})</div>
        {annotations.map((a) => (
          <div
            key={a.id}
            className={`tree-node ${selectedIds.includes(a.id) ? 'selected' : ''}`}
            onClick={() => setSelectedIds([a.id])}
          >
            {a.id}: {a.text}
          </div>
        ))}
        <div className="tree-group-label">{t.memberDimension} ({dimensions.length})</div>
        {dimensions.map((d) => (
          <div
            key={d.id}
            className={`tree-node ${selectedIds.includes(d.id) ? 'selected' : ''}`}
            onClick={() => setSelectedIds([d.id])}
          >
            {d.id}
          </div>
        ))}
      </div>
    </div>
  );
}
