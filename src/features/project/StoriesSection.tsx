import type { Story } from '@/domain/structural/types';
import type { Labels } from './masterDataHelpers';
import { chainStoryElevations } from './masterDataHelpers';
import {
  NumberField,
  OptionalNumberField,
  ReadonlyField,
  SectionHeader,
  TextField,
} from './masterDataFields';

interface StoriesSectionProps {
  stories: Story[];
  activeStory: string | null;
  currentStory: Story | undefined;
  labels: Labels;
  elChainMode: boolean;
  setElChainMode: (value: boolean) => void;
  onAddStory: () => void;
  onDuplicateStory: () => void;
  onAddSheet: () => void;
  setActiveStory: (storyId: string | null) => void;
  updateStory: (id: string, updates: Partial<Story>) => void;
  updateStories: (updates: Array<{ id: string; updates: Partial<Story> }>) => void;
  onDeleteStory: (id: string) => void;
  onMoveStory: (id: string, direction: -1 | 1) => void;
}

export function StoriesSection({
  stories,
  activeStory,
  currentStory,
  labels,
  elChainMode,
  setElChainMode,
  onAddStory,
  onDuplicateStory,
  onAddSheet,
  setActiveStory,
  updateStory,
  updateStories,
  onDeleteStory,
  onMoveStory,
}: StoriesSectionProps) {
  // When chaining is on, editing one story re-derives all upper elevations.
  const applyChain = () => {
    updateStories(
      chainStoryElevations(stories).map((update) => ({
        id: update.id,
        updates: { elevation: update.elevation },
      })),
    );
  };

  const handleChange = (id: string, updates: Partial<Story>) => {
    if (elChainMode && ('height' in updates || 'elevation' in updates)) {
      const next = stories.map((s) => (s.id === id ? { ...s, ...updates } : s));
      const combined = new Map<string, Partial<Story>>([[id, updates]]);
      for (const update of chainStoryElevations(next)) {
        combined.set(update.id, {
          ...(combined.get(update.id) ?? {}),
          elevation: update.elevation,
        });
      }
      updateStories(
        [...combined].map(([storyId, storyUpdates]) => ({ id: storyId, updates: storyUpdates })),
      );
      return;
    }
    updateStory(id, updates);
  };

  return (
    <section>
      <SectionHeader
        title={labels.stories}
        actions={
          <>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}
            >
              <input
                type="checkbox"
                checked={elChainMode}
                onChange={(event) => {
                  setElChainMode(event.target.checked);
                  if (event.target.checked) applyChain();
                }}
              />
              {labels.elChainMode}
            </label>
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
        {stories.map((story, index) => (
          <StoryCard
            key={story.id}
            story={story}
            isActive={story.id === activeStory}
            labels={labels}
            elChainMode={elChainMode}
            onActivate={() => setActiveStory(story.id)}
            onChange={(updates) => handleChange(story.id, updates)}
            onDelete={() => onDeleteStory(story.id)}
            onMoveUp={() => onMoveStory(story.id, -1)}
            onMoveDown={() => onMoveStory(story.id, 1)}
            canMoveUp={index > 0}
            canMoveDown={index < stories.length - 1}
            canDelete={stories.length > 1}
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
  elChainMode,
  onActivate,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  canDelete,
}: {
  story: Story;
  isActive: boolean;
  labels: Labels;
  elChainMode: boolean;
  onActivate: () => void;
  onChange: (updates: Partial<Story>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: 12,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '160px minmax(0, 1fr) 120px 120px auto auto',
          gap: 8,
          alignItems: 'end',
        }}
      >
        <ReadonlyField label={labels.id} value={story.id} />
        <TextField label={labels.name} value={story.name} onChange={(value) => onChange({ name: value })} />
        {elChainMode ? (
          <ReadonlyField label={labels.elevation} value={String(story.elevation)} />
        ) : (
          <NumberField label={labels.elevation} value={story.elevation} onChange={(value) => onChange({ elevation: value })} />
        )}
        <NumberField label={labels.height} value={story.height} onChange={(value) => onChange({ height: value })} />
        <button
          className={`toolbar-btn ${isActive ? 'active' : ''}`}
          onClick={onActivate}
          style={{ alignSelf: 'stretch' }}
        >
          {isActive ? labels.active : labels.activate}
        </button>
        <div style={{ display: 'flex', gap: 4, alignSelf: 'stretch' }}>
          <button
            className="toolbar-btn"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`${story.name}: ${labels.moveUp}`}
            title={labels.moveUp}
          >
            ↑
          </button>
          <button
            className="toolbar-btn"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`${story.name}: ${labels.moveDown}`}
            title={labels.moveDown}
          >
            ↓
          </button>
          <button
            className="toolbar-btn"
            onClick={onDelete}
            disabled={!canDelete}
            aria-label={`${story.name}: ${labels.deleteStory}`}
            title={labels.deleteStory}
          >
            ×
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8, alignItems: 'end' }}>
        <OptionalNumberField label={labels.deadLoad} value={story.deadLoad} onChange={(value) => onChange({ deadLoad: value })} />
        <OptionalNumberField label={labels.liveLoad} value={story.liveLoad} onChange={(value) => onChange({ liveLoad: value })} />
      </div>
    </div>
  );
}
