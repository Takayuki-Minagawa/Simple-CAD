import type { Story } from './types';

export type ColumnPlacementDirection = 'up' | 'down';

export interface ColumnVerticalSpan {
  startZ: number;
  endZ: number;
}

export function getColumnVerticalSpan(
  stories: Story[],
  activeStoryId: string,
  direction: ColumnPlacementDirection,
): ColumnVerticalSpan | null {
  const story = stories.find((candidate) => candidate.id === activeStoryId);
  if (!story) return null;

  const storyHeight = story.height > 0 ? story.height : 3000;

  if (direction === 'up') {
    return {
      startZ: story.elevation,
      endZ: story.elevation + storyHeight,
    };
  }

  const lowerStory = stories
    .filter((candidate) => candidate.elevation < story.elevation)
    .sort((a, b) => b.elevation - a.elevation)[0];

  return {
    startZ: lowerStory?.elevation ?? story.elevation - storyHeight,
    endZ: story.elevation,
  };
}
