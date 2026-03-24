import { useProjectStore, useEditorStore } from '@/app/store';

export function StorySelector() {
  const data = useProjectStore((s) => s.data);
  const { activeStory, setActiveStory } = useEditorStore();

  if (!data) return null;

  return (
    <div>
      <div className="panel-header">Story</div>
      <div className="panel-content">
        <select
          className="prop-select"
          style={{ maxWidth: '100%' }}
          value={activeStory ?? ''}
          onChange={(e) => setActiveStory(e.target.value || null)}
        >
          <option value="">All stories</option>
          {data.stories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} (EL: {s.elevation})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
