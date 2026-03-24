import { useProjectStore, useEditorStore } from '@/app/store';

export function ObjectTreePanel() {
  const data = useProjectStore((s) => s.data);
  const { selectedIds, setSelectedIds, activeStory } = useEditorStore();

  if (!data) return <div className="panel-content">No project loaded</div>;

  const membersByType = {
    column: data.members.filter((m) => m.type === 'column' && (!activeStory || m.story === activeStory)),
    beam: data.members.filter((m) => m.type === 'beam' && (!activeStory || m.story === activeStory)),
    wall: data.members.filter((m) => m.type === 'wall' && (!activeStory || m.story === activeStory)),
    slab: data.members.filter((m) => m.type === 'slab' && (!activeStory || m.story === activeStory)),
  };

  const annotations = data.annotations.filter((a) => !activeStory || a.story === activeStory);
  const dimensions = data.dimensions.filter((d) => !activeStory || d.story === activeStory);

  return (
    <div>
      <div className="panel-header">Objects</div>
      <div className="panel-content">
        {Object.entries(membersByType).map(([type, members]) => (
          <div key={type}>
            <div className="tree-group-label">
              {type} ({members.length})
            </div>
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
        <div className="tree-group-label">annotations ({annotations.length})</div>
        {annotations.map((a) => (
          <div
            key={a.id}
            className={`tree-node ${selectedIds.includes(a.id) ? 'selected' : ''}`}
            onClick={() => setSelectedIds([a.id])}
          >
            {a.id}: {a.text}
          </div>
        ))}
        <div className="tree-group-label">dimensions ({dimensions.length})</div>
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
