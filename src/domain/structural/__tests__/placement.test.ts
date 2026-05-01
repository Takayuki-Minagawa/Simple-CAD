import { describe, expect, it } from 'vitest';
import { getColumnVerticalSpan } from '../placement';
import type { Story } from '../types';

const stories: Story[] = [
  { id: '1F', name: '1F', elevation: 0, height: 3000 },
  { id: '2F', name: '2F', elevation: 3000, height: 3200 },
  { id: '3F', name: '3F', elevation: 6200, height: 3000 },
];

describe('getColumnVerticalSpan', () => {
  it('places an upward column from the active story elevation', () => {
    expect(getColumnVerticalSpan(stories, '2F', 'up')).toEqual({
      startZ: 3000,
      endZ: 6200,
    });
  });

  it('places a downward column to the nearest lower story elevation', () => {
    expect(getColumnVerticalSpan(stories, '2F', 'down')).toEqual({
      startZ: 0,
      endZ: 3000,
    });
  });

  it('uses the story height below the lowest story when no lower story exists', () => {
    expect(getColumnVerticalSpan(stories, '1F', 'down')).toEqual({
      startZ: -3000,
      endZ: 0,
    });
  });
});
