import type { Story } from '@/domain/structural/types';
import type { Labels } from './masterDataHelpers';
import { NumberField, ReadonlyField, SectionHeader, TextField } from './masterDataFields';

interface StoriesSectionProps {
  stories: Story[];
  activeStory: string | null;
  currentStory: Story | undefined;
  labels: Labels;
  onAddStory: () => void;
  onDuplicateStory: () => void;
  onAddSheet: () => void;
  setActiveStory: (storyId: string | null) => void;
  updateStory: (id: string, updates: Partial<Story>) => void;
}

export function StoriesSection({
  stories,
  activeStory,
  currentStory,
  labels,
  onAddStory,
  onDuplicateStory,
  onAddSheet,
  setActiveStory,
  updateStory,
}: StoriesSectionProps) {
  return (
    <section>
      <SectionHeader
        title={labels.stories}
        actions={
          <>
            <button className="toolbar-btn" onClick={onAddStory}>{labels.addStory}</button>
            <button className="toolbar-btn" onClick={onDuplicateStory} disabled={!currentStory}>
              {labels.duplicateStory}
            </button>
            <button className="toolbar-btn" onClick={onAddSheet} disabled={!currentStory}>
              {labels.addSheet}
            </button>
          </>
        }
      />
      <div style={{ display: 'grid', gap: 8 }}>
        {stories.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            isActive={story.id === activeStory}
            labels={labels}
            onActivate={() => setActiveStory(story.id)}
            onChange={(updates) => updateStory(story.id, updates)}
          />
        ))}
      </div>
    </section>
  );
}

function StoryCard({
  story,
  isActive,
  labels,
  onActivate,
  onChange,
}: {
  story: Story;
  isActive: boolean;
  labels: Labels;
  onActivate: () => void;
  onChange: (updates: Partial<Story>) => void;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: 12,
        display: 'grid',
        gridTemplateColumns: '160px minmax(0, 1fr) 120px 120px auto',
        gap: 8,
        alignItems: 'end',
      }}
    >
      <ReadonlyField label={labels.id} value={story.id} />
      <TextField label={labels.name} value={story.name} onChange={(value) => onChange({ name: value })} />
      <NumberField label={labels.elevation} value={story.elevation} onChange={(value) => onChange({ elevation: value })} />
      <NumberField label={labels.height} value={story.height} onChange={(value) => onChange({ height: value })} />
      <button
        className={`toolbar-btn ${isActive ? 'active' : ''}`}
        onClick={onActivate}
        style={{ alignSelf: 'stretch' }}
      >
        {isActive ? labels.active : labels.activate}
      </button>
    </div>
  );
}
