import type { Member, Story } from '@/domain/structural/types';
import type { ModelExtents } from './sectionMath';
import type { ViewerLabels } from './viewerLabels';

interface ViewerInfoPanelProps {
  labels: ViewerLabels;
  showAllStories: boolean;
  stories: Story[];
  activeStory: string | null;
  extents: ModelExtents;
  filteredMembers: Member[];
}

export function ViewerInfoPanel({
  labels,
  showAllStories,
  stories,
  activeStory,
  extents,
  filteredMembers,
}: ViewerInfoPanelProps) {
  const activeStoryRecord = stories.find((story) => story.id === activeStory) ?? null;
  const memberCounts = filteredMembers.reduce(
    (counts, member) => {
      counts.total += 1;
      counts[member.type] += 1;
      return counts;
    },
    { total: 0, column: 0, beam: 0, wall: 0, slab: 0 },
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 10,
        minWidth: 188,
        padding: '8px 10px',
        borderRadius: 8,
        background: 'rgba(16, 24, 40, 0.78)',
        color: '#fff',
        display: 'grid',
        gap: 4,
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ color: 'rgba(255,255,255,0.72)' }}>{labels.display}</span>
        <strong>{showAllStories ? labels.allStories : labels.currentStory}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ color: 'rgba(255,255,255,0.72)' }}>{labels.story}</span>
        <strong>{activeStoryRecord ? `${activeStoryRecord.name} EL ${Math.round(activeStoryRecord.elevation)}` : labels.allStories}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ color: 'rgba(255,255,255,0.72)' }}>{labels.zRange}</span>
        <strong>{Math.round(extents.zMin)} - {Math.round(extents.zMax)}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 10px', paddingTop: 3, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <span style={{ color: 'rgba(255,255,255,0.72)' }}>{labels.members}</span>
        <strong>{memberCounts.total}</strong>
        <span>{labels.columns}</span>
        <span>{memberCounts.column}</span>
        <span>{labels.beams}</span>
        <span>{memberCounts.beam}</span>
        <span>{labels.walls}</span>
        <span>{memberCounts.wall}</span>
        <span>{labels.slabs}</span>
        <span>{memberCounts.slab}</span>
      </div>
    </div>
  );
}
