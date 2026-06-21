import type { Story } from '@/domain/structural/types';
import type { Labels } from './masterDataHelpers';
import { chainStoryElevations } from './masterDataHelpers';
import { NumberField, ReadonlyField, SectionHeader, TextField } from './masterDataFields';

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
}: StoriesSectionProps) {
  // When chaining is on, editing one story re-derives all upper elevations.
  const applyChain = () => {
    for (const update of chainStoryElevations(stories)) {
      updateStory(update.id, { elevation: update.elevation });
    }
  };

  const handleChange = (id: string, updates: Partial<Story>) => {
    updateStory(id, updates);
    if (elChainMode && ('height' in updates || 'elevation' in updates)) {
      // Re-chain on the next tick using the freshly-applied store state.
      // Calling synchronously here would use the stale `stories` snapshot for
      // the just-edited story, so we recompute from intended values instead.
      const next = stories.map((s) => (s.id === id ? { ...s, ...updates } : s));
      for (const update of chainStoryElevations(next)) {
        updateStory(update.id, { elevation: update.elevation });
      }
    }
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
        {stories.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            isActive={story.id === activeStory}
            labels={labels}
            elChainMode={elChainMode}
            onActivate={() => setActiveStory(story.id)}
            onChange={(updates) => handleChange(story.id, updates)}
          />
        ))}
      </div>
    </section>
  );
}

function OptionalNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
      <input
        className="prop-input"
        style={{ maxWidth: '100%' }}
        type="number"
        value={value ?? ''}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === '' ? undefined : Number(raw));
        }}
      />
    </label>
  );
}

function StoryCard({
  story,
  isActive,
  labels,
  elChainMode,
  onActivate,
  onChange,
}: {
  story: Story;
  isActive: boolean;
  labels: Labels;
  elChainMode: boolean;
  onActivate: () => void;
  onChange: (updates: Partial<Story>) => void;
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
          gridTemplateColumns: '160px minmax(0, 1fr) 120px 120px auto',
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
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8, alignItems: 'end' }}>
        <OptionalNumberField label={labels.deadLoad} value={story.deadLoad} onChange={(value) => onChange({ deadLoad: value })} />
        <OptionalNumberField label={labels.liveLoad} value={story.liveLoad} onChange={(value) => onChange({ liveLoad: value })} />
      </div>
    </div>
  );
}
