import type { Point2D } from '@/domain/geometry/types';
import { todayIsoDate } from '@/domain/time';
import type { Member, PlanView, Sheet, Story, View } from './types';

export function createDefaultViews(stories: Story[], members: Member[]): View[] {
  const views: View[] = stories.map((story) => {
    const extents = computeStoryExtents(story.id, members);
    return {
      id: `VIEW-${story.id}-PLAN`,
      type: 'plan',
      story: story.id,
      center: extents.center,
      width: extents.width,
      height: extents.height,
      rotation: 0,
    } satisfies PlanView;
  });

  if (stories.length > 0) {
    views.push({
      id: 'VIEW-3D-001',
      type: 'model3d',
      story: stories[0].id,
    });
  }

  return views;
}

export function createDefaultSheets(projectName: string, stories: Story[]): Sheet[] {
  return stories.map((story, index) => ({
    id: `S-${String(index + 1).padStart(3, '0')}`,
    name: `${story.name}平面図`,
    paperSize: 'A1',
    scale: '1:100',
    viewIds: [`VIEW-${story.id}-PLAN`],
    titleBlockTemplate: 'standard',
    titleBlock: {
      projectName,
      drawingTitle: `${story.name}平面図`,
      issueDate: todayIsoDate(),
    },
  }));
}

export function computeStoryExtents(
  storyId: string,
  members: Member[],
): {
  center: Point2D;
  width: number;
  height: number;
} {
  const points: Point2D[] = [];
  for (const member of members) {
    if (member.story !== storyId) continue;
    if (member.type === 'slab') {
      points.push(...member.polygon);
      continue;
    }
    points.push({ x: member.start.x, y: member.start.y }, { x: member.end.x, y: member.end.y });
  }

  if (points.length === 0) {
    return {
      center: { x: 4000, y: 3000 },
      width: 14000,
      height: 11000,
    };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    width: Math.max(maxX - minX + 4000, 8000),
    height: Math.max(maxY - minY + 4000, 6000),
  };
}
