import { useProjectStore, useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';

function buildNextStoryId(id: string, index: number): string {
  const match = id.match(/^(\d+)F$/i);
  return match ? `${Number.parseInt(match[1], 10) + 1}F` : `${id}-COPY-${index}`;
}

export function StorySelector() {
  const data = useProjectStore((s) => s.data);
  const duplicateStory = useProjectStore((s) => s.duplicateStory);
  const { activeStory, setActiveStory } = useEditorStore();
  const { t, locale } = useI18n();

  if (!data) return null;

  const duplicateLabel = locale === 'ja' ? '複製' : 'Duplicate';

  const handleDuplicateStory = () => {
    const source = data.stories.find((story) => story.id === activeStory) ?? data.stories[0];
    if (!source) return;
    const nextId = buildNextStoryId(source.id, data.stories.length + 1);
    const createdId = duplicateStory(source.id, {
      id: nextId,
      name: nextId,
      elevation: source.elevation + source.height,
      height: source.height,
    });
    if (createdId) setActiveStory(createdId);
  };

  return (
    <div>
      <div className="panel-header">
        <span>{t.panelStory}</span>
        <button
          className="toolbar-btn"
          style={{ fontSize: 10, padding: '2px 6px', minHeight: 20 }}
          onClick={handleDuplicateStory}
        >
          {duplicateLabel}
        </button>
      </div>
      <div className="panel-content">
        <select
          className="prop-select"
          style={{ maxWidth: '100%' }}
          value={activeStory ?? ''}
          onChange={(e) => setActiveStory(e.target.value || null)}
        >
          <option value="">{t.allStories}</option>
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
